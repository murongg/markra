import { useCallback, useEffect, useMemo, useState } from "react";
import {
  normalizeAiModelCapabilities,
  type AiModelCapability,
  type AiProviderConfig,
  type AiProviderModel,
  type AiProviderSettings
} from "@markra/providers";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

export type AiProviderActionState = {
  message?: string;
  pending?: "models" | "test";
  status: "error" | "idle" | "success";
};

export type AiProviderModelDraft = {
  capabilities: AiModelCapability[];
  id: string;
  name: string;
};

export type UseAiProviderSettingsPanelStateOptions = {
  selectedProviderId?: string;
  settings: AiProviderSettings;
  translate: Translate;
  onFetchModels: (provider: AiProviderConfig) => Promise<AiProviderModel[]>;
  onSelectProvider: (providerId: string) => unknown;
  onTestProvider: (provider: AiProviderConfig) => Promise<{ message: string; ok: boolean }>;
  onUpdateSettings: (settings: AiProviderSettings) => unknown;
};

export function updateAiProviderSettingsProvider(
  settings: AiProviderSettings,
  providerId: string,
  updater: (provider: AiProviderConfig) => AiProviderConfig
): AiProviderSettings {
  return {
    ...settings,
    providers: settings.providers.map((provider) => (provider.id === providerId ? updater(provider) : provider))
  };
}

export function createEmptyAiProviderModelDraft(): AiProviderModelDraft {
  return {
    capabilities: ["text"],
    id: "",
    name: ""
  };
}

function createModelDraftFromModel(model: AiProviderModel): AiProviderModelDraft {
  return {
    capabilities: [...model.capabilities],
    id: model.id,
    name: model.name
  };
}

export function useAiProviderSettingsPanelState({
  settings,
  selectedProviderId,
  translate,
  onFetchModels,
  onSelectProvider,
  onTestProvider,
  onUpdateSettings
}: UseAiProviderSettingsPanelStateOptions) {
  const [actionState, setActionState] = useState<AiProviderActionState>({ status: "idle" });
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [editModelDraft, setEditModelDraft] = useState<AiProviderModelDraft>(() => createEmptyAiProviderModelDraft());
  const [isAddingModel, setIsAddingModel] = useState(false);
  const [modelDraft, setModelDraft] = useState<AiProviderModelDraft>(() => createEmptyAiProviderModelDraft());
  const [providerSearch, setProviderSearch] = useState("");
  const selectedProvider = settings.providers.find((provider) => provider.id === selectedProviderId) ?? settings.providers[0];
  const modelOptions = selectedProvider?.models ?? [];
  const isCustomProvider = Boolean(selectedProvider?.id.startsWith("custom-provider-"));

  const visibleProviders = useMemo(() => {
    const normalizedProviderSearch = providerSearch.trim().toLowerCase();

    return normalizedProviderSearch
      ? settings.providers.filter((provider) => provider.name.toLowerCase().includes(normalizedProviderSearch))
      : settings.providers;
  }, [providerSearch, settings.providers]);

  const updateSelectedProvider = useCallback(
    (updater: (provider: AiProviderConfig) => AiProviderConfig) => {
      if (!selectedProvider) return;
      onUpdateSettings(updateAiProviderSettingsProvider(settings, selectedProvider.id, updater));
    },
    [onUpdateSettings, selectedProvider, settings]
  );

  const canAddModel = modelDraft.id.trim().length > 0 && modelDraft.capabilities.length > 0;
  const trimmedEditModelId = editModelDraft.id.trim();
  const canSaveEditedModel =
    Boolean(editingModelId) &&
    trimmedEditModelId.length > 0 &&
    editModelDraft.capabilities.length > 0 &&
    !modelOptions.some((model) => model.id !== editingModelId && model.id === trimmedEditModelId);

  useEffect(() => {
    setEditingModelId(null);
    setEditModelDraft(createEmptyAiProviderModelDraft());
    setIsAddingModel(false);
    setModelDraft(createEmptyAiProviderModelDraft());
  }, [selectedProvider?.id]);

  const handleTestProvider = useCallback(() => {
    if (!selectedProvider) return;

    setActionState({ pending: "test", status: "idle" });
    onTestProvider(selectedProvider)
      .then((result) => {
        setActionState({
          message: result.ok ? translate("settings.ai.apiConnected") : result.message,
          status: result.ok ? "success" : "error"
        });
      })
      .catch((error: unknown) => {
        setActionState({ message: error instanceof Error ? error.message : String(error), status: "error" });
      });
  }, [onTestProvider, selectedProvider, translate]);

  const handleFetchModels = useCallback(() => {
    if (!selectedProvider) return;

    setActionState({ pending: "models", status: "idle" });
    onFetchModels(selectedProvider)
      .then((models) => {
        const enabledByModelId = new Map(selectedProvider.models.map((model) => [model.id, model.enabled]));
        const fetchedModelIds = new Set(models.map((model) => model.id));
        const mergedModels = models.map((model) => ({
          ...model,
          enabled: enabledByModelId.get(model.id) ?? model.enabled
        })).concat(selectedProvider.models.filter((model) => !fetchedModelIds.has(model.id)));
        const defaultModelId = mergedModels.some((model) => model.id === selectedProvider.defaultModelId)
          ? selectedProvider.defaultModelId
          : mergedModels[0]?.id;

        onUpdateSettings({
          ...updateAiProviderSettingsProvider(settings, selectedProvider.id, (provider) => ({
            ...provider,
            defaultModelId,
            models: mergedModels
          })),
          defaultModelId,
          defaultProviderId: selectedProvider.id
        });
        setActionState({ message: translate("settings.ai.modelsUpdated"), status: "success" });
      })
      .catch((error: unknown) => {
        setActionState({ message: error instanceof Error ? error.message : String(error), status: "error" });
      });
  }, [onFetchModels, onUpdateSettings, selectedProvider, settings, translate]);

  const handleAddModel = useCallback(() => {
    if (!selectedProvider) return;

    const id = modelDraft.id.trim();
    if (!id) return;

    const model: AiProviderModel = {
      capabilities: normalizeAiModelCapabilities(modelDraft.capabilities),
      enabled: true,
      id,
      name: modelDraft.name.trim() || id
    };

    onUpdateSettings(
      updateAiProviderSettingsProvider(settings, selectedProvider.id, (provider) => {
        const hasModel = provider.models.some((item) => item.id === model.id);
        const models = hasModel
          ? provider.models.map((item) => (item.id === model.id ? model : item))
          : [...provider.models, model];

        return {
          ...provider,
          defaultModelId: provider.defaultModelId || model.id,
          models
        };
      })
    );
    setIsAddingModel(false);
    setModelDraft(createEmptyAiProviderModelDraft());
  }, [modelDraft, onUpdateSettings, selectedProvider, settings]);

  const handleStartAddModel = useCallback(() => {
    setEditingModelId(null);
    setEditModelDraft(createEmptyAiProviderModelDraft());
    setIsAddingModel(true);
  }, []);

  const handleCancelAddModel = useCallback(() => {
    setIsAddingModel(false);
    setModelDraft(createEmptyAiProviderModelDraft());
  }, []);

  const handleStartEditModel = useCallback((model: AiProviderModel) => {
    setIsAddingModel(false);
    setModelDraft(createEmptyAiProviderModelDraft());
    setEditingModelId(model.id);
    setEditModelDraft(createModelDraftFromModel(model));
  }, []);

  const handleCancelEditModel = useCallback(() => {
    setEditingModelId(null);
    setEditModelDraft(createEmptyAiProviderModelDraft());
  }, []);

  const handleSaveEditedModel = useCallback(() => {
    if (!selectedProvider || !editingModelId || !canSaveEditedModel) return;

    const id = editModelDraft.id.trim();
    const editedModel: AiProviderModel = {
      capabilities: normalizeAiModelCapabilities(editModelDraft.capabilities),
      enabled: selectedProvider.models.find((model) => model.id === editingModelId)?.enabled ?? true,
      id,
      name: editModelDraft.name.trim() || id
    };
    const defaultModelId = selectedProvider.defaultModelId === editingModelId ? editedModel.id : selectedProvider.defaultModelId;

    onUpdateSettings({
      ...updateAiProviderSettingsProvider(settings, selectedProvider.id, (provider) => ({
        ...provider,
        defaultModelId,
        models: provider.models.map((model) => (model.id === editingModelId ? editedModel : model))
      })),
      defaultModelId: settings.defaultProviderId === selectedProvider.id && settings.defaultModelId === editingModelId
        ? editedModel.id
        : settings.defaultModelId,
      defaultProviderId: settings.defaultProviderId
    });
    setEditingModelId(null);
    setEditModelDraft(createEmptyAiProviderModelDraft());
  }, [canSaveEditedModel, editModelDraft, editingModelId, onUpdateSettings, selectedProvider, settings]);

  const handleDeleteProvider = useCallback(() => {
    if (!selectedProvider || !isCustomProvider) return;

    const providers = settings.providers.filter((provider) => provider.id !== selectedProvider.id);
    const fallbackProvider = providers.find((provider) => provider.id === settings.defaultProviderId) ?? providers[0];
    const deletingDefaultProvider = settings.defaultProviderId === selectedProvider.id;

    onUpdateSettings({
      ...settings,
      defaultModelId: deletingDefaultProvider ? fallbackProvider?.defaultModelId : settings.defaultModelId,
      defaultProviderId: deletingDefaultProvider ? fallbackProvider?.id : settings.defaultProviderId,
      providers
    });

    if (fallbackProvider) onSelectProvider(fallbackProvider.id);

    setActionState({ message: translate("settings.ai.providerDeleted"), status: "success" });
  }, [isCustomProvider, onSelectProvider, onUpdateSettings, selectedProvider, settings, translate]);

  return {
    actionState,
    canAddModel,
    canSaveEditedModel,
    editModelDraft,
    editingModelId,
    handleAddModel,
    handleCancelAddModel,
    handleCancelEditModel,
    handleDeleteProvider,
    handleFetchModels,
    handleSaveEditedModel,
    handleStartAddModel,
    handleStartEditModel,
    handleTestProvider,
    isAddingModel,
    isCustomProvider,
    modelDraft,
    modelOptions,
    providerSearch,
    selectedProvider,
    setEditModelDraft,
    setModelDraft,
    setProviderSearch,
    updateSelectedProvider,
    visibleProviders
  };
}
