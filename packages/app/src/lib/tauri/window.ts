import { getAppRuntime } from "../../runtime";

export type NativeSettingsWindowTarget = "exportPandocPath";

export type NativeEditorWindowRestoreState = {
  filePath: string | null;
  label: string;
  openFilePaths: string[];
};

export type SetNativeEditorWindowRestoreStateInput = {
  filePath: string | null;
  openFilePaths: string[];
};

export function openSettingsWindow(target?: NativeSettingsWindowTarget) {
  return getAppRuntime().window.openSettingsWindow(target);
}

export function listenNativeSettingsWindowTarget(onTarget: (target: NativeSettingsWindowTarget) => unknown) {
  return getAppRuntime().window.listenSettingsWindowTarget(onTarget);
}

export function openNativeExternalUrl(url: string) {
  return getAppRuntime().window.openExternalUrl(url);
}

export function setNativeWindowTitle(title: string) {
  return getAppRuntime().window.setWindowTitle(title);
}

export function setNativeEditorWindowRestoreState(input: SetNativeEditorWindowRestoreStateInput) {
  return getAppRuntime().window.setEditorWindowRestoreState(input);
}

export function listNativeEditorWindowRestoreStates() {
  return getAppRuntime().window.listEditorWindowRestoreStates();
}

export function closeNativeWindow() {
  return getAppRuntime().window.closeWindow();
}

export function minimizeNativeWindow() {
  return getAppRuntime().window.minimizeWindow();
}

export function toggleNativeWindowMaximized() {
  return getAppRuntime().window.toggleWindowMaximized();
}
