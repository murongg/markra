import { act, renderHook, waitFor } from "@testing-library/react";
import { showAppToast } from "../lib/app-toast";
import {
  defaultEditorPreferences
} from "../lib/settings/app-settings";
import {
  configureAppRuntime,
  createDefaultAppRuntime,
  resetAppRuntimeForTests
} from "../runtime";
import {
  canonicalizeEditorFontFamilyPreference,
  shellCommandActionFailureMessage,
  useSettingsWindowState
} from "./useSettingsWindowState";

vi.mock("../lib/app-toast", () => ({
  showAppToast: vi.fn()
}));

const mockedShowAppToast = vi.mocked(showAppToast);

describe("settings window import and export", () => {
  beforeEach(() => {
    mockedShowAppToast.mockReset();
    resetAppRuntimeForTests();
  });

  afterEach(() => {
    resetAppRuntimeForTests();
  });

  it("exports the current app settings to a Markra settings file", async () => {
    const defaultRuntime = createDefaultAppRuntime();
    const saveSettingsFile = vi.fn(async (input) => ({
      name: input.suggestedName,
      path: `/mock-files/${input.suggestedName}`
    }));
    configureAppRuntime({
      ...defaultRuntime,
      files: {
        ...defaultRuntime.files,
        saveSettingsFile
      }
    });
    const { result } = renderHook(() => useSettingsWindowState());

    await act(async () => {
      await result.current.handleExportSettings();
    });

    expect(saveSettingsFile).toHaveBeenCalledWith({
      suggestedName: "markra-settings.json",
      contents: expect.any(String)
    });
    expect(JSON.parse(saveSettingsFile.mock.calls[0][0].contents)).toMatchObject({
      format: "markra-settings",
      version: 1
    });
    expect(mockedShowAppToast).toHaveBeenCalledWith({
      message: "Settings exported.",
      status: "success"
    });
  });

  it("imports settings from a selected Markra settings file and refreshes the panel state", async () => {
    const defaultRuntime = createDefaultAppRuntime();
    const importedSettings = {
      format: "markra-settings",
      version: 1,
      exportedAt: "2030-01-02T03:04:05.000Z",
      settings: {
        editorPreferences: {
          ...defaultEditorPreferences,
          bodyFontSize: 20
        },
        language: "zh-CN"
      }
    };
    const openSettingsFile = vi.fn(async () => ({
      content: JSON.stringify(importedSettings),
      name: "markra-settings.json",
      path: "/mock-files/markra-settings.json"
    }));
    configureAppRuntime({
      ...defaultRuntime,
      files: {
        ...defaultRuntime.files,
        openSettingsFile
      }
    });
    const { result } = renderHook(() => useSettingsWindowState());

    await act(async () => {
      await result.current.handleImportSettings();
    });

    expect(openSettingsFile).toHaveBeenCalledWith({ title: "Import Markra settings" });
    await waitFor(() => {
      expect(result.current.editorPreferences.bodyFontSize).toBe(20);
    });
    expect(mockedShowAppToast).toHaveBeenCalledWith({
      message: "Settings imported.",
      status: "success"
    });
  });
});

describe("settings window shell command errors", () => {
  it("includes native shell command failure details when available", () => {
    expect(shellCommandActionFailureMessage("Could not update the markra command.", "Registry write failed")).toBe(
      "Could not update the markra command. Registry write failed"
    );
    expect(shellCommandActionFailureMessage("Could not update the markra command.", new Error("Access denied"))).toBe(
      "Could not update the markra command. Access denied"
    );
  });

  it("falls back to the generic shell command error", () => {
    expect(shellCommandActionFailureMessage("Could not update the markra command.", "")).toBe(
      "Could not update the markra command."
    );
  });
});

describe("settings window editor font migration", () => {
  it("maps a saved localized font label to the CSS font family name", () => {
    expect(canonicalizeEditorFontFamilyPreference({
      ...defaultEditorPreferences,
      editorFontFamily: {
        family: "示例衬线",
        source: "system"
      }
    }, [
      { family: "ExampleSerif", label: "示例衬线" },
      { family: "ExampleSans", label: "示例黑体" }
    ])).toEqual({
      ...defaultEditorPreferences,
      editorFontFamily: {
        family: "ExampleSerif",
        source: "system"
      }
    });
  });

  it("does not migrate canonical or ambiguous font family names", () => {
    expect(canonicalizeEditorFontFamilyPreference({
      ...defaultEditorPreferences,
      editorFontFamily: {
        family: "ExampleSerif",
        source: "system"
      }
    }, [
      { family: "ExampleSerif", label: "示例衬线" }
    ])).toBeNull();

    expect(canonicalizeEditorFontFamilyPreference({
      ...defaultEditorPreferences,
      editorFontFamily: {
        family: "示例衬线",
        source: "system"
      }
    }, [
      { family: "ExampleSerif", label: "示例衬线" },
      { family: "ExampleSerifAlt", label: "示例衬线" }
    ])).toBeNull();
  });
});
