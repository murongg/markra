import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  createCustomAiProvider,
  createDefaultAiSettings,
  fetchAiProviderModels,
  testAiProviderConnection
} from "@markra/providers";
import { t, type I18nKey } from "@markra/shared";
import {
  getStoredAiSettings,
  getStoredEditorPreferences,
  getStoredExportSettings,
  getStoredWebSearchSettings,
  defaultEditorPreferences,
  defaultExportSettings,
  defaultWebSearchSettings,
  resetWelcomeDocumentState,
  saveStoredAiSettings,
  saveStoredEditorPreferences,
  saveStoredExportSettings,
  saveStoredWebSearchSettings,
  normalizeExportSettings,
  normalizeWebSearchSettings,
  type AiProviderConfig,
  type AiProviderModel,
  type AiProviderSettings,
  type EditorPreferences,
  type ExportSettings,
  type WebSearchSettings
} from "../lib/settings/app-settings";
import {
  listenAppEditorPreferencesChanged,
  notifyAppAiSettingsChanged,
  notifyAppEditorPreferencesChanged,
  notifyAppExportSettingsChanged,
  notifyAppWebSearchSettingsChanged
} from "../lib/settings/settings-events";
import {
  deleteNativeMarkdownTemplateFile,
  readNativeMarkdownTemplateFile,
  requestNativeAiJson,
  writeNativeMarkdownTemplateFile
} from "../lib/tauri";
import {
  loadMarkdownTemplatesFromEntries,
  markdownTemplateEntryFromTemplate,
  type MarkdownTemplate
} from "../lib/templates";
import { useAppLanguage } from "./useAppLanguage";
import { useAppTheme } from "./useAppTheme";

export type SettingsCategory =
  | "general"
  | "ai"
  | "providers"
  | "web"
  | "storage"
  | "appearance"
  | "editor"
  | "templates"
  | "keyboardShortcuts"
  | "export";

export function useSettingsWindowState() {
  const appTheme = useAppTheme();
  const appLanguage = useAppLanguage();
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>("general");
  const [aiSettings, setAiSettings] = useState<AiProviderSettings>(() => createDefaultAiSettings());
  const [aiSettingsSaved, setAiSettingsSaved] = useState(false);
  const [editorPreferences, setEditorPreferences] = useState<EditorPreferences>(defaultEditorPreferences);
  const [markdownTemplates, setMarkdownTemplates] = useState<MarkdownTemplate[]>([]);
  const [exportSettings, setExportSettings] = useState<ExportSettings>(defaultExportSettings);
  const [webSearchSettings, setWebSearchSettings] = useState<WebSearchSettings>(defaultWebSearchSettings);
  const [selectedAiProviderId, setSelectedAiProviderId] = useState<string | undefined>(
    () => createDefaultAiSettings().defaultProviderId
  );
  const [welcomeReset, setWelcomeReset] = useState(false);
  const translate = useCallback((key: I18nKey) => t(appLanguage.language, key), [appLanguage.language]);
  const selectedAiProvider = useMemo(
    () => aiSettings.providers.find((provider) => provider.id === selectedAiProviderId) ?? aiSettings.providers[0],
    [aiSettings.providers, selectedAiProviderId]
  );

  useLayoutEffect(() => {
    document.documentElement.dataset.window = "settings";

    return () => {
      delete document.documentElement.dataset.window;
    };
  }, []);

  useLayoutEffect(() => {
    document.title = translate("settings.title");
  }, [translate]);

  useEffect(() => {
    let cancelled = false;

    getStoredAiSettings().then((settings) => {
      if (cancelled) return;
      setAiSettings(settings);
      setSelectedAiProviderId(settings.defaultProviderId ?? settings.providers[0]?.id);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getStoredWebSearchSettings().then((settings) => {
      if (!cancelled) setWebSearchSettings(settings);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    getStoredExportSettings().then((settings) => {
      if (!cancelled) setExportSettings(settings);
    }).catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let stopListening: (() => unknown) | null = null;

    getStoredEditorPreferences().then((preferences) => {
      if (cancelled) return;

      setEditorPreferences(preferences);
      loadMarkdownTemplatesFromEntries(preferences.markdownTemplates, readNativeMarkdownTemplateFile)
        .then((templates) => {
          if (!cancelled) setMarkdownTemplates(templates);
        })
        .catch(() => {
          if (!cancelled) setMarkdownTemplates([]);
        });
    }).catch(() => {});

    listenAppEditorPreferencesChanged((preferences) => {
      if (cancelled) return;

      setEditorPreferences(preferences);
      loadMarkdownTemplatesFromEntries(preferences.markdownTemplates, readNativeMarkdownTemplateFile)
        .then((templates) => {
          if (!cancelled) setMarkdownTemplates(templates);
        })
        .catch(() => {
          if (!cancelled) setMarkdownTemplates([]);
        });
    }).then((cleanup) => {
      if (cancelled) {
        cleanup();
        return;
      }

      stopListening = cleanup;
    }).catch(() => {});

    return () => {
      cancelled = true;
      stopListening?.();
    };
  }, []);

  const handleResetWelcomeDocument = useCallback(() => {
    resetWelcomeDocumentState().then(() => {
      setWelcomeReset(true);
    }).catch(() => {});
  }, []);

  const handleAddAiProvider = useCallback(() => {
    setAiSettingsSaved(false);
    setAiSettings((currentSettings) => {
      const provider = createCustomAiProvider(currentSettings.providers.length + 1);
      setSelectedAiProviderId(provider.id);

      return {
        ...currentSettings,
        providers: [...currentSettings.providers, provider]
      };
    });
  }, []);

  const handleUpdateAiSettings = useCallback((settings: AiProviderSettings) => {
    setAiSettingsSaved(false);
    setAiSettings(settings);
  }, []);

  const handleSaveAiSettings = useCallback(() => {
    const settingsToSave = {
      ...aiSettings,
      defaultProviderId: selectedAiProvider?.id ?? aiSettings.defaultProviderId,
      defaultModelId: selectedAiProvider?.defaultModelId ?? aiSettings.defaultModelId
    };

    saveStoredAiSettings(settingsToSave).then(() => {
      setAiSettings(settingsToSave);
      setAiSettingsSaved(true);
      notifyAppAiSettingsChanged(settingsToSave).catch(() => {});
    }).catch(() => {});
  }, [aiSettings, selectedAiProvider]);

  const handleTestAiProvider = useCallback((provider: AiProviderConfig) =>
    testAiProviderConnection(provider, requestNativeAiJson), []);

  const handleFetchAiProviderModels = useCallback((provider: AiProviderConfig): Promise<AiProviderModel[]> => {
    return fetchAiProviderModels(provider, requestNativeAiJson);
  }, []);

  const handleUpdateEditorPreferences = useCallback((preferences: EditorPreferences) => {
    setEditorPreferences(preferences);
    saveStoredEditorPreferences(preferences)
      .then(() => notifyAppEditorPreferencesChanged(preferences))
      .catch(() => {});
  }, []);

  const handleSaveMarkdownTemplate = useCallback((template: MarkdownTemplate) => {
    const entry = markdownTemplateEntryFromTemplate(template);
    const nextPreferences = {
      ...editorPreferences,
      markdownTemplates: editorPreferences.markdownTemplates.some((storedTemplate) => storedTemplate.id === entry.id)
        ? editorPreferences.markdownTemplates.map((storedTemplate) => storedTemplate.id === entry.id ? entry : storedTemplate)
        : [...editorPreferences.markdownTemplates, entry]
    };
    const nextTemplate = {
      ...template,
      fileName: entry.fileName
    };

    setEditorPreferences(nextPreferences);
    setMarkdownTemplates((currentTemplates) =>
      currentTemplates.some((storedTemplate) => storedTemplate.id === nextTemplate.id)
        ? currentTemplates.map((storedTemplate) => storedTemplate.id === nextTemplate.id ? nextTemplate : storedTemplate)
        : [...currentTemplates, nextTemplate]
    );

    writeNativeMarkdownTemplateFile(entry.fileName, template.content)
      .then(() => saveStoredEditorPreferences(nextPreferences))
      .then(() => notifyAppEditorPreferencesChanged(nextPreferences))
      .catch(() => {});
  }, [editorPreferences]);

  const handleDeleteMarkdownTemplate = useCallback((template: MarkdownTemplate) => {
    const entry = editorPreferences.markdownTemplates.find((storedTemplate) => storedTemplate.id === template.id);
    const nextPreferences = {
      ...editorPreferences,
      markdownTemplates: editorPreferences.markdownTemplates.filter((storedTemplate) => storedTemplate.id !== template.id)
    };

    setEditorPreferences(nextPreferences);
    setMarkdownTemplates((currentTemplates) =>
      currentTemplates.filter((storedTemplate) => storedTemplate.id !== template.id)
    );

    const deleteTemplateFile = entry
      ? deleteNativeMarkdownTemplateFile(entry.fileName)
      : Promise.resolve();

    deleteTemplateFile
      .then(() => saveStoredEditorPreferences(nextPreferences))
      .then(() => notifyAppEditorPreferencesChanged(nextPreferences))
      .catch(() => {});
  }, [editorPreferences]);

  const handleUpdateExportSettings = useCallback((settings: ExportSettings) => {
    const normalizedSettings = normalizeExportSettings(settings);
    setExportSettings(normalizedSettings);
    saveStoredExportSettings(normalizedSettings)
      .then(() => notifyAppExportSettingsChanged(normalizedSettings))
      .catch(() => {});
  }, []);

  const handleUpdateWebSearchSettings = useCallback((settings: WebSearchSettings) => {
    const normalizedSettings = normalizeWebSearchSettings(settings);
    setWebSearchSettings(normalizedSettings);
    saveStoredWebSearchSettings(normalizedSettings)
      .then(() => notifyAppWebSearchSettingsChanged(normalizedSettings))
      .catch(() => {});
  }, []);

  return {
    activeCategory,
    aiSettings,
    aiSettingsSaved,
    appLanguage,
    appTheme,
    editorPreferences,
    exportSettings,
    handleAddAiProvider,
    handleFetchAiProviderModels,
    handleResetWelcomeDocument,
    handleSaveAiSettings,
    handleTestAiProvider,
    handleCreateMarkdownTemplate: handleSaveMarkdownTemplate,
    handleDeleteMarkdownTemplate,
    handleUpdateMarkdownTemplate: handleSaveMarkdownTemplate,
    handleUpdateAiSettings,
    handleUpdateEditorPreferences,
    handleUpdateExportSettings,
    handleUpdateWebSearchSettings,
    selectedAiProvider,
    setActiveCategory,
    setSelectedAiProviderId,
    markdownTemplates,
    translate,
    webSearchSettings,
    welcomeReset
  };
}
