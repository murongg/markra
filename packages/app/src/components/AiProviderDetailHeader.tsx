import { Trash2 } from "lucide-react";
import { AiProviderBadge, aiProviderApiStyleLabel } from "./AiProviderBadge";
import { AiProviderSwitch, AiSettingsActionButton } from "./AiProviderSettingsControls";
import {
  editableRequestStylesForProvider,
  providerRequiresApiKey,
  requestStyleForProviderType,
  type AiProviderConfig
} from "@markra/providers";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

export function AiProviderDetailHeader({
  isCustomProvider,
  provider,
  translate,
  onDeleteProvider,
  onToggleEnabled
}: {
  isCustomProvider: boolean;
  provider: AiProviderConfig;
  translate: Translate;
  onDeleteProvider: () => unknown;
  onToggleEnabled: () => unknown;
}) {
  const editableApiStyles = editableRequestStylesForProvider(provider);
  const selectedApiStyle = provider.apiStyle ?? requestStyleForProviderType(provider.type);
  const configured = providerRequiresApiKey(provider)
    ? Boolean(provider.apiKey?.trim())
    : Boolean(provider.baseUrl?.trim());

  return (
    <div className="flex min-h-16 items-center justify-between gap-4 border-b border-(--border-default) px-6 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <AiProviderBadge provider={provider} translate={translate} />
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[16px] leading-6 font-[750] text-(--text-heading)">
            {provider.name}
          </h3>
          {editableApiStyles.length > 0 ? (
            <p className="m-0 text-[12px] leading-5 text-(--text-secondary)">
              {aiProviderApiStyleLabel(selectedApiStyle, translate)}
            </p>
          ) : null}
        </div>
        <span className="rounded-md bg-(--bg-secondary) px-2 py-1 text-[12px] leading-4 font-[650] text-(--text-secondary)">
          {configured ? translate("settings.ai.configured") : translate("settings.ai.notConfigured")}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isCustomProvider ? (
          <AiSettingsActionButton label={translate("settings.ai.deleteProvider")} onClick={onDeleteProvider}>
            <Trash2 aria-hidden="true" size={14} />
            {translate("settings.ai.deleteProvider")}
          </AiSettingsActionButton>
        ) : null}
        <AiProviderSwitch
          checked={provider.enabled}
          label={translate("settings.ai.enableProviderLabel")}
          onChange={onToggleEnabled}
        />
      </div>
    </div>
  );
}
