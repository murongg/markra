import { Check } from "lucide-react";
import { useEffect } from "react";
import { AiProviderConnectionSection } from "./AiProviderConnectionSection";
import { AiProviderDetailHeader } from "./AiProviderDetailHeader";
import { AiProviderList } from "./AiProviderList";
import { AiProviderModelsSection } from "./AiProviderModelsSection";
import {
  type AiProviderConfig,
  type AiProviderModel,
  type AiProviderSettings
} from "@markra/providers";
import { useAiProviderSettingsPanelState } from "../hooks/useAiProviderSettingsPanelState";
import { dismissAppToast, showAppToast } from "../lib/app-toast";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

type AiProviderSettingsPanelProps = {
  saved: boolean;
  selectedProviderId?: string;
  settings: AiProviderSettings;
  translate: Translate;
  onAddProvider: () => unknown;
  onFetchModels: (provider: AiProviderConfig) => Promise<AiProviderModel[]>;
  onSave: () => unknown;
  onSelectProvider: (providerId: string) => unknown;
  onTestProvider: (provider: AiProviderConfig) => Promise<{ message: string; ok: boolean }>;
  onUpdateSettings: (settings: AiProviderSettings) => unknown;
};

const aiProviderToastId = "ai-provider-settings-toast";

export function AiProviderSettingsPanel({
  settings,
  selectedProviderId,
  saved,
  translate,
  onAddProvider,
  onFetchModels,
  onSave,
  onSelectProvider,
  onTestProvider,
  onUpdateSettings
}: AiProviderSettingsPanelProps) {
  const panelState = useAiProviderSettingsPanelState({
    settings,
    selectedProviderId,
    translate,
    onFetchModels,
    onSelectProvider,
    onTestProvider,
    onUpdateSettings
  });
  const {
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
  } = panelState;

  useEffect(() => {
    if (!actionState.message) {
      dismissAppToast(aiProviderToastId);
      return;
    }

    showAppToast({
      id: aiProviderToastId,
      message: actionState.message,
      status: actionState.status === "error" ? "error" : "success"
    });
  }, [actionState.message, actionState.status]);

  useEffect(
    () => () => {
      dismissAppToast(aiProviderToastId);
    },
    []
  );

  return (
    <>
      <div className="ai-settings-layout relative grid h-full min-h-0 grid-cols-[16rem_minmax(0,1fr)] max-[860px]:grid-cols-1">
        <AiProviderList
          providerSearch={providerSearch}
          selectedProviderId={selectedProvider?.id}
          translate={translate}
          visibleProviders={visibleProviders}
          onAddProvider={onAddProvider}
          onSearchChange={setProviderSearch}
          onSelectProvider={onSelectProvider}
        />

        {selectedProvider ? (
          <section className="flex min-h-0 flex-col bg-(--bg-primary)">
            <AiProviderDetailHeader
              isCustomProvider={isCustomProvider}
              provider={selectedProvider}
              translate={translate}
              onDeleteProvider={handleDeleteProvider}
              onToggleEnabled={() => updateSelectedProvider((provider) => ({ ...provider, enabled: !provider.enabled }))}
            />

            <div className="grid min-h-0 flex-1 gap-6 overflow-auto overscroll-none px-6 py-5">
              <AiProviderConnectionSection
                actionState={actionState}
                isCustomProvider={isCustomProvider}
                provider={selectedProvider}
                translate={translate}
                onTestProvider={handleTestProvider}
                updateSelectedProvider={updateSelectedProvider}
              />

              <AiProviderModelsSection
                actionState={actionState}
                canAddModel={canAddModel}
                canSaveEditedModel={canSaveEditedModel}
                editModelDraft={editModelDraft}
                editingModelId={editingModelId}
                isAddingModel={isAddingModel}
                modelDraft={modelDraft}
                modelOptions={modelOptions}
                selectedProvider={selectedProvider}
                settings={settings}
                translate={translate}
                onAddModel={handleAddModel}
                onCancelAddModel={handleCancelAddModel}
                onCancelEditModel={handleCancelEditModel}
                onFetchModels={handleFetchModels}
                onSaveEditedModel={handleSaveEditedModel}
                onStartAddModel={handleStartAddModel}
                onStartEditModel={handleStartEditModel}
                onUpdateSettings={onUpdateSettings}
                setEditModelDraft={setEditModelDraft}
                setModelDraft={setModelDraft}
                updateSelectedProvider={updateSelectedProvider}
              />
            </div>

            <div className="flex min-h-15 shrink-0 items-center justify-end gap-3 border-t border-(--border-default) bg-(--bg-primary) px-6 py-3">
              {saved ? (
                <span className="mr-auto inline-flex items-center gap-1.5 text-[12px] leading-5 font-[560] text-(--accent)" role="status">
                  <Check aria-hidden="true" size={13} />
                  {translate("settings.ai.saved")}
                </span>
              ) : null}
              <button
                className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-(--accent) bg-(--accent) px-4 text-[13px] leading-5 font-bold text-(--bg-primary) shadow-[0_8px_20px_color-mix(in_srgb,var(--accent)_20%,transparent)] transition-[background-color,border-color,box-shadow] duration-150 ease-out hover:bg-(--accent-hover) hover:border-(--accent-hover) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
                type="button"
                aria-label={translate("settings.ai.saveProviders")}
                onClick={onSave}
              >
                {translate("settings.ai.saveProviders")}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
