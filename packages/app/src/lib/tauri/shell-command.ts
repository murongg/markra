import { getAppRuntime } from "../../runtime";

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

export function getNativeShellCommandStatus() {
  return getAppRuntime().shellCommand.getShellCommandStatus();
}

export function installNativeShellCommand() {
  return getAppRuntime().shellCommand.installShellCommand();
}

export function uninstallNativeShellCommand() {
  return getAppRuntime().shellCommand.uninstallShellCommand();
}
