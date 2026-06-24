import { Link2, MessageSquareText } from "lucide-react";
import { t, type AppLanguage } from "@markra/shared";
import type {
  WorkspaceLinkOccurrence,
  WorkspaceUnlinkedMention
} from "../lib/workspace-links";
import type { NativeMarkdownFolderFile } from "../lib/tauri";

type DocumentLinksPanelProps = {
  backlinks: readonly WorkspaceLinkOccurrence[];
  language?: AppLanguage;
  unlinkedMentions: readonly WorkspaceUnlinkedMention[];
  onOpenFile: (file: NativeMarkdownFolderFile) => unknown | Promise<unknown>;
};

type LinkPanelItem = WorkspaceLinkOccurrence | WorkspaceUnlinkedMention;

function sourceFileName(item: LinkPanelItem) {
  return item.sourceFile.name;
}

function sourceFileDirectory(item: LinkPanelItem) {
  const normalizedPath = item.sourceFile.relativePath.replaceAll("\\", "/");
  const separatorIndex = normalizedPath.lastIndexOf("/");
  if (separatorIndex < 0) return null;

  const directory = normalizedPath.slice(0, separatorIndex);
  return directory ? `${directory} /` : null;
}

function countLabel(label: string, count: number) {
  return `${label} ${count}`;
}

export function DocumentLinksPanel({
  backlinks,
  language = "en",
  unlinkedMentions,
  onOpenFile
}: DocumentLinksPanelProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);

  const renderItems = (items: readonly LinkPanelItem[], emptyLabel: string) => (
    items.length > 0 ? (
      <ol className="m-0 list-none space-y-1 p-0">
        {items.map((item) => {
          const directory = sourceFileDirectory(item);
          const ariaLabel = `${sourceFileName(item)} ${item.lineText}`;

          return (
            <li key={`${item.sourceFile.path}:${item.from}:${item.to}`}>
              <button
                className="grid w-full cursor-pointer gap-1 rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-[12px] leading-4 text-(--text-secondary) outline-none transition-colors duration-150 hover:bg-(--bg-hover) hover:text-(--text-heading) focus-visible:bg-(--bg-active) focus-visible:ring-2 focus-visible:ring-(--accent)"
                type="button"
                aria-label={ariaLabel}
                onClick={() => onOpenFile(item.sourceFile)}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-[620] text-(--text-heading)">{sourceFileName(item)}</span>
                  <span className="shrink-0 text-[11px] text-(--text-tertiary)">L{item.lineNumber}</span>
                </span>
                {directory ? (
                  <span className="truncate text-[11px] text-(--text-tertiary)">{directory}</span>
                ) : null}
                <span className="line-clamp-2 text-(--text-secondary)">{item.lineText}</span>
              </button>
            </li>
          );
        })}
      </ol>
    ) : (
      <p className="m-0 px-2 py-1.5 text-[12px] leading-4 text-(--text-tertiary)">{emptyLabel}</p>
    )
  );

  return (
    <section
      className="document-links-panel flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2"
      aria-label={label("app.documentLinks")}
    >
      <section className="min-h-0 shrink-0">
        <h3 className="m-0 flex h-8 items-center gap-1.5 px-2 text-[12px] leading-4 font-[650] text-(--text-secondary)">
          <Link2 aria-hidden="true" size={14} />
          <span>{countLabel(label("app.backlinks"), backlinks.length)}</span>
        </h3>
        {renderItems(backlinks, label("app.noBacklinks"))}
      </section>

      <section className="mt-3 min-h-0 shrink-0">
        <h3 className="m-0 flex h-8 items-center gap-1.5 px-2 text-[12px] leading-4 font-[650] text-(--text-secondary)">
          <MessageSquareText aria-hidden="true" size={14} />
          <span>{countLabel(label("app.unlinkedMentions"), unlinkedMentions.length)}</span>
        </h3>
        {renderItems(unlinkedMentions, label("app.noUnlinkedMentions"))}
      </section>
    </section>
  );
}
