import { lazy, Suspense, useId, useState } from "react";
import { Braces, KeyRound, X } from "lucide-react";
import { Button, Modal } from "@markra/ui";
import {
  AiSettingsActionButton,
  AiSettingsSection,
  AiSettingsSelectField,
  AiSettingsTextField
} from "./AiProviderSettingsControls";
import { aiProviderApiStyleLabel } from "./AiProviderBadge";
import {
  defaultApiUrlForRequestStyle,
  editableRequestStylesForProvider,
  providerRequiresApiKey,
  requestStyleForProviderType,
  readAiProviderCustomHeaders,
  type AiProviderConfig,
  type AiProviderRequestStyle
} from "@markra/providers";
import type { AiProviderActionState } from "../hooks/useAiProviderSettingsPanelState";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

const LazyJsonCodeEditor = lazy(async () => {
  const module = await import("./JsonCodeEditor");

  return { default: module.JsonCodeEditor };
});

function JsonCodeEditorFallback({ label }: { label: string }) {
  return (
    <div className="grid min-h-0 gap-1.5" data-testid="json-code-editor-loading">
      <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">{label}</span>
      <div
        aria-hidden="true"
        className="min-h-70 animate-pulse rounded-md border border-(--border-default) bg-(--bg-secondary)"
      />
    </div>
  );
}

export function AiProviderConnectionSection({
  actionState,
  isCustomProvider,
  provider,
  translate,
  onTestProvider,
  updateSelectedProvider
}: {
  actionState: AiProviderActionState;
  isCustomProvider: boolean;
  provider: AiProviderConfig;
  translate: Translate;
  onTestProvider: () => unknown;
  updateSelectedProvider: (updater: (provider: AiProviderConfig) => AiProviderConfig) => unknown;
}) {
  const customHeadersDialogTitleId = useId();
  const [customHeadersDialogOpen, setCustomHeadersDialogOpen] = useState(false);
  const [customHeadersDraft, setCustomHeadersDraft] = useState(provider.customHeaders ?? "");
  const [customHeadersError, setCustomHeadersError] = useState<string | null>(null);
  const customHeadersJsonLabel = translate("settings.ai.customHeadersJson");
  const selectedApiStyle = provider.apiStyle ?? requestStyleForProviderType(provider.type);
  const editableApiStyles = editableRequestStylesForProvider(provider);
  const requiresApiKey = providerRequiresApiKey(provider);

  const openCustomHeadersDialog = () => {
    setCustomHeadersDraft(provider.customHeaders ?? "");
    setCustomHeadersError(null);
    setCustomHeadersDialogOpen(true);
  };

  const saveCustomHeaders = () => {
    const customHeaders = customHeadersDraft.trim();

    try {
      readAiProviderCustomHeaders({ customHeaders });
    } catch {
      setCustomHeadersError(translate("settings.ai.customHeadersInvalidJson"));
      return;
    }

    updateSelectedProvider((current) => ({ ...current, customHeaders }));
    setCustomHeadersDialogOpen(false);
  };

  return (
    <AiSettingsSection label={translate("settings.sections.aiProviders")}>
      <div className="grid gap-4 py-2">
        {isCustomProvider ? (
          <AiSettingsTextField
            label={translate("settings.ai.providerName")}
            value={provider.name}
            onChange={(name) => updateSelectedProvider((current) => ({ ...current, name }))}
          />
        ) : null}
        {editableApiStyles.length > 0 ? (
          <AiSettingsSelectField<AiProviderRequestStyle>
            label={translate("settings.ai.apiStyle")}
            value={selectedApiStyle}
            onChange={(apiStyle) =>
              updateSelectedProvider((current) => ({
                ...current,
                apiStyle,
                baseUrl: current.baseUrl || defaultApiUrlForRequestStyle(apiStyle)
              }))
            }
          >
            {editableApiStyles.map((apiStyle) => (
              <option key={apiStyle} value={apiStyle}>
                {aiProviderApiStyleLabel(apiStyle, translate)}
              </option>
            ))}
          </AiSettingsSelectField>
        ) : null}
        {requiresApiKey ? (
          <AiSettingsTextField
            label={translate("settings.ai.apiKey")}
            type="password"
            value={provider.apiKey ?? ""}
            onChange={(apiKey) => updateSelectedProvider((current) => ({ ...current, apiKey }))}
          />
        ) : null}
        <div className="grid gap-3 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-end">
          <AiSettingsTextField
            label={translate("settings.ai.apiAddress")}
            value={provider.baseUrl ?? ""}
            onChange={(baseUrl) => updateSelectedProvider((current) => ({ ...current, baseUrl }))}
          />
          <AiSettingsActionButton
            label={translate("settings.ai.testApi")}
            disabled={actionState.pending === "test"}
            onClick={onTestProvider}
          >
            {actionState.pending === "test" ? translate("settings.ai.testingApi") : translate("settings.ai.testApi")}
          </AiSettingsActionButton>
        </div>
        <div className="grid gap-2 min-[720px]:grid-cols-[minmax(0,1fr)_auto] min-[720px]:items-center">
          <div className="grid gap-1">
            <span className="text-[12px] leading-5 font-[650] text-(--text-secondary)">
              {translate("settings.ai.customHeaders")}
            </span>
            <span className="text-[11px] leading-4 text-(--text-secondary)">
              {translate("settings.ai.customHeadersDescription")}{" "}
              {provider.customHeaders?.trim() ? translate("settings.ai.configured") : translate("settings.ai.notConfigured")}
            </span>
          </div>
          <AiSettingsActionButton label={translate("settings.ai.customHeadersEdit")} onClick={openCustomHeadersDialog}>
            <Braces aria-hidden="true" size={14} />
            {translate("settings.ai.customHeadersEdit")}
          </AiSettingsActionButton>
        </div>
        {requiresApiKey ? (
          <p className="m-0 flex items-center gap-2 text-[12px] leading-5 text-(--text-secondary)">
            <KeyRound aria-hidden="true" size={13} />
            {translate("settings.ai.localStorageNotice")}
          </p>
        ) : null}
      </div>
      {customHeadersDialogOpen ? (
        <Modal
          title={translate("settings.ai.customHeaders")}
          titleId={customHeadersDialogTitleId}
          closeLabel={translate("settings.ai.cancelEditModel")}
          closeIcon={<X aria-hidden="true" size={15} />}
          onClose={() => setCustomHeadersDialogOpen(false)}
          footer={
            <>
              <Button onClick={() => setCustomHeadersDialogOpen(false)}>
                {translate("settings.ai.cancelEditModel")}
              </Button>
              <Button
                aria-label={translate("settings.ai.customHeadersSave")}
                variant="primary"
                onClick={saveCustomHeaders}
              >
                {translate("settings.ai.customHeadersSave")}
              </Button>
            </>
          }
        >
          <Suspense fallback={<JsonCodeEditorFallback label={customHeadersJsonLabel} />}>
            <LazyJsonCodeEditor
              label={customHeadersJsonLabel}
              value={customHeadersDraft}
              onChange={(value) => {
                setCustomHeadersDraft(value);
                setCustomHeadersError(null);
              }}
            />
          </Suspense>
          {customHeadersError ? (
            <p className="m-0 text-[11px] leading-4 text-(--danger)" role="alert">
              {customHeadersError}
            </p>
          ) : (
            <p className="m-0 text-[11px] leading-4 text-(--text-secondary)">
              {translate("settings.ai.customHeadersDescription")}
            </p>
          )}
        </Modal>
      ) : null}
    </AiSettingsSection>
  );
}
