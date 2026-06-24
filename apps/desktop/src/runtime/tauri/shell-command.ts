import { invoke } from "@tauri-apps/api/core";

export type NativeShellCommandStatusValue =
  | "conflict"
  | "installed"
  | "missing"
  | "needsRepair"
  | "unavailable";

export type NativeShellCommandStatus = {
  commandPath: string | null;
  targetPath: string | null;
  status: NativeShellCommandStatusValue;
};

function normalizeNativeShellCommandStatus(value: unknown): NativeShellCommandStatus {
  if (typeof value !== "object" || value === null) {
    return { commandPath: null, targetPath: null, status: "unavailable" };
  }

  const status = value as Partial<NativeShellCommandStatus>;
  const statusValue = status.status;

  return {
    commandPath: typeof status.commandPath === "string" && status.commandPath.trim() ? status.commandPath : null,
    targetPath: typeof status.targetPath === "string" && status.targetPath.trim() ? status.targetPath : null,
    status: statusValue === "conflict" ||
      statusValue === "installed" ||
      statusValue === "missing" ||
      statusValue === "needsRepair" ||
      statusValue === "unavailable"
      ? statusValue
      : "unavailable"
  };
}

export async function getNativeShellCommandStatus() {
  return normalizeNativeShellCommandStatus(await invoke("get_shell_command_status"));
}

export async function installNativeShellCommand() {
  return normalizeNativeShellCommandStatus(await invoke("install_shell_command"));
}

export async function uninstallNativeShellCommand() {
  return normalizeNativeShellCommandStatus(await invoke("uninstall_shell_command"));
}
