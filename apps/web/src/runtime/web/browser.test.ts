import { createBrowserPrint } from "./browser";

describe("browser runtime helpers", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("keeps the print frame mounted until the browser finishes printing", async () => {
    const printFile = createBrowserPrint(document);
    const printPromise = printFile({
      contents: "<!doctype html><title>Draft</title><h1>Draft</h1>",
      name: "draft.pdf",
      type: "text/html;charset=utf-8"
    });
    const frame = document.querySelector("iframe") as HTMLIFrameElement | null;

    expect(frame).not.toBeNull();
    const printWindow = frame?.contentWindow;
    if (!frame || !printWindow) throw new Error("print frame should have a window");

    const focus = vi.spyOn(printWindow, "focus").mockImplementation(() => {});
    const print = vi.spyOn(printWindow, "print").mockImplementation(() => {});

    frame.dispatchEvent(new Event("load"));
    await printPromise;

    expect(focus).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);
    expect(frame.isConnected).toBe(true);

    printWindow.dispatchEvent(new Event("afterprint"));

    expect(frame.isConnected).toBe(false);
  });

  it("adds browser print margins from the exported page settings", async () => {
    const printFile = createBrowserPrint(document);
    const printPromise = printFile({
      contents: [
        "<!doctype html>",
        "<html>",
        "<head><style>@page {\n  size: 148mm 210mm;\n  margin: 12mm;\n}</style></head>",
        '<body><main class="markdown-export"><h1>Mock export</h1></main></body>',
        "</html>"
      ].join(""),
      name: "mock-export.pdf",
      type: "text/html;charset=utf-8"
    });
    const frame = document.querySelector("iframe") as HTMLIFrameElement | null;

    expect(frame).not.toBeNull();
    const printWindow = frame?.contentWindow;
    if (!frame || !printWindow) throw new Error("print frame should have a window");

    vi.spyOn(printWindow, "focus").mockImplementation(() => {});
    vi.spyOn(printWindow, "print").mockImplementation(() => {});

    expect(frame.srcdoc).toContain("@page { margin: 0 !important; }");
    expect(frame.srcdoc).toContain("padding: 12mm !important");

    frame.dispatchEvent(new Event("load"));
    await printPromise;
    printWindow.dispatchEvent(new Event("afterprint"));
  });
});
