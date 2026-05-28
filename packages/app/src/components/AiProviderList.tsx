import { Plus, Search } from "lucide-react";
import { AiProviderBadge } from "./AiProviderBadge";
import { Button, SearchInput, StatusDot } from "@markra/ui";
import type { AiProviderConfig } from "@markra/providers";
import type { I18nKey } from "@markra/shared";

type Translate = (key: I18nKey) => string;

export function AiProviderList({
  providerSearch,
  selectedProviderId,
  translate,
  visibleProviders,
  onAddProvider,
  onSearchChange,
  onSelectProvider
}: {
  providerSearch: string;
  selectedProviderId?: string;
  translate: Translate;
  visibleProviders: AiProviderConfig[];
  onAddProvider: () => unknown;
  onSearchChange: (value: string) => unknown;
  onSelectProvider: (providerId: string) => unknown;
}) {
  return (
    <section className="flex h-full min-h-0 flex-col border-r border-(--border-default) bg-(--bg-primary) max-[860px]:border-r-0 max-[860px]:border-b">
      <div className="border-b border-(--border-default) p-3">
        <SearchInput
          aria-label={translate("settings.ai.searchProviders")}
          className="bg-(--bg-secondary)"
          icon={<Search size={14} />}
          value={providerSearch}
          placeholder={translate("settings.ai.searchProviders")}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </div>

      <div className="ai-provider-list-scroll grid min-h-0 flex-1 content-start gap-1 overflow-auto overscroll-contain p-3">
        {visibleProviders.map((provider) => (
          <button
            className="grid min-h-12 cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border-0 bg-transparent px-2.5 py-2 text-left transition-colors duration-150 ease-out hover:bg-(--bg-hover) aria-current:bg-(--bg-active) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
            type="button"
            key={provider.id}
            aria-current={provider.id === selectedProviderId ? "page" : undefined}
            aria-label={provider.name}
            onClick={() => onSelectProvider(provider.id)}
          >
            <AiProviderBadge provider={provider} translate={translate} />
            <span className="min-w-0 truncate text-[13px] leading-5 font-[620] text-(--text-heading)">
              {provider.name}
            </span>
            <StatusDot tone={provider.enabled ? "active" : "inactive"} />
          </button>
        ))}
      </div>

      <div className="border-t border-(--border-default) p-3">
        <Button
          className="w-full text-[13px]"
          aria-label={translate("settings.ai.addProvider")}
          onClick={onAddProvider}
        >
          <Plus aria-hidden="true" size={15} />
          {translate("settings.ai.addProvider")}
        </Button>
      </div>
    </section>
  );
}
