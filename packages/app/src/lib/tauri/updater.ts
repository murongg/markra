import { getAppRuntime } from "../../runtime";

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

export function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
  return getAppRuntime().updater.checkAppUpdate();
}
