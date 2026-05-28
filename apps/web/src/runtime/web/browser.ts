import type { WebDownloadFile, WebRuntimeOptions } from "./types";

type BrowserPickerGlobals = typeof globalThis & {
  showDirectoryPicker?: WebRuntimeOptions["showDirectoryPicker"];
  showOpenFilePicker?: WebRuntimeOptions["showOpenFilePicker"];
  showSaveFilePicker?: WebRuntimeOptions["showSaveFilePicker"];
};

export function resolveBrowserPicker<K extends keyof BrowserPickerGlobals>(key: K) {
  return (globalThis as BrowserPickerGlobals)[key];
}

export function confirmWithBrowser(message: string) {
  if (typeof globalThis.confirm === "function") return globalThis.confirm(message);

  return false;
}

export function createBrowserDownload(documentOverride?: Document) {
  return async ({ contents, name, type }: WebDownloadFile) => {
    const documentTarget = documentOverride ?? globalThis.document;
    const blob = new Blob([contents], { type });
    const url = URL.createObjectURL(blob);
    const link = documentTarget.createElement("a");

    link.href = url;
    link.download = name;
    link.rel = "noopener";
    link.style.display = "none";
    documentTarget.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };
}

function htmlFallbackName(name: string) {
  return name.replace(/\.pdf$/iu, ".html") || "markra-export.html";
}

const defaultBrowserPrintMargin = "18mm";
const cssLengthValue = String.raw`(?:0|(?:\d+(?:\.\d+)?)(?:mm|cm|in|px|pt|pc|rem|em|%)?)`;
const cssMarginValuePattern = new RegExp(`^${cssLengthValue}(?:\\s+${cssLengthValue}){0,3}$`, "iu");

function normalizeBrowserPrintMargin(value: string | undefined) {
  const margin = value?.trim() ?? "";

  return cssMarginValuePattern.test(margin) ? margin : defaultBrowserPrintMargin;
}

function extractBrowserPrintMargin(contents: string) {
  const match = contents.match(/@page\s*\{[^}]*\bmargin\s*:\s*([^;}]+)\s*;?/iu);

  return normalizeBrowserPrintMargin(match?.[1]);
}

function createBrowserPrintStyles(contents: string) {
  const margin = extractBrowserPrintMargin(contents);

  return `<style data-markra-browser-print>
@media print {
  @page { margin: 0 !important; }

  body {
    margin: 0 !important;
  }

  .markdown-export {
    box-sizing: border-box !important;
    padding: ${margin} !important;
    -webkit-box-decoration-break: clone;
    box-decoration-break: clone;
  }

  .markdown-export-page-header,
  .markdown-export-page-footer {
    right: ${margin} !important;
    left: ${margin} !important;
  }
}
</style>`;
}

function createBrowserPrintDocument(contents: string) {
  const styles = createBrowserPrintStyles(contents);

  return /<\/head>/iu.test(contents)
    ? contents.replace(/<\/head>/iu, `${styles}</head>`)
    : `${styles}${contents}`;
}

export function createBrowserPrint(documentOverride?: Document) {
  return async ({ contents, name, type }: WebDownloadFile) => {
    const documentTarget = documentOverride ?? globalThis.document;
    const windowTarget = documentTarget?.defaultView ?? globalThis.window;
    if (!documentTarget || !windowTarget) return;

    const frame = documentTarget.createElement("iframe");
    const fallbackDownload = createBrowserDownload(documentOverride);

    frame.title = name;
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "1px";
    frame.style.height = "1px";
    frame.style.border = "0";
    frame.style.opacity = "0";
    frame.style.pointerEvents = "none";
    frame.setAttribute("aria-hidden", "true");
    frame.srcdoc = createBrowserPrintDocument(String(contents));

    await new Promise<void>((resolve) => {
      let settled = false;
      let loadTimeout: number | null = null;
      const resolveReady = () => {
        if (settled) return;

        settled = true;
        if (loadTimeout !== null) windowTarget.clearTimeout(loadTimeout);
        resolve();
      };

      frame.addEventListener("load", resolveReady, { once: true });
      documentTarget.body.appendChild(frame);
      loadTimeout = windowTarget.setTimeout(resolveReady, 700);
    });

    const printWindow = frame.contentWindow;
    if (!printWindow || typeof printWindow.print !== "function") {
      frame.remove();
      await fallbackDownload({
        contents,
        name: htmlFallbackName(name),
        type
      });
      return;
    }

    let cleanupTimeout: number | null = null;
    const cleanup = () => {
      printWindow.removeEventListener("afterprint", cleanup);
      windowTarget.removeEventListener("afterprint", cleanup);
      if (cleanupTimeout !== null) windowTarget.clearTimeout(cleanupTimeout);
      frame.remove();
    };

    try {
      printWindow.addEventListener("afterprint", cleanup, { once: true });
      windowTarget.addEventListener("afterprint", cleanup, { once: true });
      cleanupTimeout = windowTarget.setTimeout(cleanup, 60_000);
      printWindow.focus();
      printWindow.print();
    } catch {
      cleanup();
      await fallbackDownload({
        contents,
        name: htmlFallbackName(name),
        type
      });
    }
  };
}

export async function pickBrowserDirectoryFiles(documentOverride?: Document) {
  const documentTarget = documentOverride ?? globalThis.document;
  if (!documentTarget) return [];

  return new Promise<File[]>((resolve) => {
    const input = documentTarget.createElement("input");
    const finish = () => {
      resolve(Array.from(input.files ?? []));
      input.remove();
    };

    input.type = "file";
    input.multiple = true;
    input.style.display = "none";
    input.setAttribute("directory", "");
    input.setAttribute("webkitdirectory", "");
    input.addEventListener("change", finish, { once: true });
    input.addEventListener("cancel", finish, { once: true });
    documentTarget.body.appendChild(input);
    input.click();
  });
}
