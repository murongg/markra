import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { getStoredNetworkSettings, saveStoredWorkspaceState } from "@markra/app/settings";
import { listNativeEditorWindowRestoreStates } from "./window";

const localUpdaterProxyUrls = [
  "http://127.0.0.1:7890",
  "http://127.0.0.1:7897",
  "http://127.0.0.1:1087",
  "http://127.0.0.1:10809",
  "http://127.0.0.1:6152"
] as const;

export type NativeAppUpdateProgress = {
  contentLength: number | null;
  downloaded: number;
  progress: number | null;
};

export type NativeAppUpdate = {
  body?: string;
  currentVersion: string;
  date?: string;
  downloadAndInstall: (callbacks?: { onProgress?: (progress: NativeAppUpdateProgress) => unknown }) => Promise<unknown>;
  restart: () => Promise<unknown>;
  version: string;
};

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

async function checkWithLocalProxyFallback() {
  const proxies = await updaterProxyUrls();

  for (const proxy of proxies) {
    try {
      return await check({ proxy });
    } catch {
      // Local proxies are optional; fall through to the next candidate or direct check.
    }
  }

  return check();
}

async function updaterProxyUrls() {
  try {
    const settings = await getStoredNetworkSettings();
    const configuredProxy = settings.proxyEnabled ? settings.proxyUrl.trim() : "";
    if (!configuredProxy) return [...localUpdaterProxyUrls];

    return [configuredProxy, ...localUpdaterProxyUrls.filter((proxy) => proxy !== configuredProxy)];
  } catch {
    return [...localUpdaterProxyUrls];
  }
}

function resolveProgress(downloaded: number, contentLength: number | null) {
  if (!contentLength || contentLength <= 0) return null;

  return Math.min(100, Math.round((downloaded / contentLength) * 100));
}

function emitProgress({
  contentLength,
  downloaded,
  onProgress
}: {
  contentLength: number | null;
  downloaded: number;
  onProgress?: (progress: NativeAppUpdateProgress) => unknown;
}) {
  onProgress?.({
    contentLength,
    downloaded,
    progress: resolveProgress(downloaded, contentLength)
  });
}

async function persistEditorWindowRestoreSnapshot() {
  try {
    const openWindows = await listNativeEditorWindowRestoreStates();
    await saveStoredWorkspaceState({ openWindows });
  } catch {
    // Relaunching for an installed update should not be blocked by opportunistic restore state.
  }
}

export async function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
  if (!isTauriRuntime()) return null;

  const update = await checkWithLocalProxyFallback();
  if (!update) return null;

  return {
    body: update.body,
    currentVersion: update.currentVersion,
    date: update.date,
    async downloadAndInstall(callbacks = {}) {
      let contentLength: number | null = null;
      let downloaded = 0;

      await update.downloadAndInstall((event: DownloadEvent) => {
        if (event.event === "Started") {
          contentLength = event.data.contentLength ?? null;
          downloaded = 0;
          emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
          return;
        }

        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
          return;
        }

        if (event.event === "Finished") {
          if (contentLength !== null) downloaded = contentLength;
          emitProgress({ contentLength, downloaded, onProgress: callbacks.onProgress });
        }
      });
    },
    async restart() {
      await persistEditorWindowRestoreSnapshot();
      await relaunch();
    },
    version: update.version
  };
}
