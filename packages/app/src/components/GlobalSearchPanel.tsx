import { useCallback, useEffect, useMemo, useRef, useState, type Key, type KeyboardEvent, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { CaseSensitive, ChevronDown, ChevronRight, Loader2, Search, X } from "lucide-react";
import {
  describeWorkspaceSearchQuery,
  findSearchRanges,
  isStructuredWorkspaceSearchQuery,
  t,
  workspaceSearchContentHighlightTerms,
  type AppLanguage,
  type I18nKey,
  type WorkspaceSearchQueryDescription,
  type WorkspaceSearchScope,
  type WorkspaceSearchTerm
} from "@markra/shared";
import type { WorkspaceSearchResult, WorkspaceSearchSortOrder } from "../lib/workspace-search";

type GlobalSearchPanelProps = {
  caseSensitive: boolean;
  language?: AppLanguage;
  loading: boolean;
  query: string;
  recentQueries?: readonly string[];
  results: readonly WorkspaceSearchResult[];
  searchedFileCount: number;
  sortOrder?: WorkspaceSearchSortOrder;
  truncated: boolean;
  unreadableFileCount: number;
  onCaseSensitiveChange: (caseSensitive: boolean) => unknown;
  onClose: () => unknown;
  onOpenResult: (result: WorkspaceSearchResult) => unknown;
  onQueryChange: (query: string) => unknown;
  onRecentQuerySelect?: (query: string) => unknown;
  onSortOrderChange?: (sortOrder: WorkspaceSearchSortOrder) => unknown;
};

type GlobalSearchResultGroup = {
  file: WorkspaceSearchResult["file"];
  results: WorkspaceSearchResult[];
};

type VirtualResultGroupItem = {
  index: number;
  key: Key;
  start: number;
};

const collapsedGroupPreviewCount = 4;
const resultGroupOverscanCount = 6;
const collapsedResultGroupHeight = 43;
const expandedResultGroupBaseHeight = 53;
const resultGroupDirectoryHeight = 24;
const resultGroupMatchHeight = 28;
const resultGroupShowMoreHeight = 29;
const fallbackRenderedResultGroupCount = 12;
const workspaceSearchSortOrders: WorkspaceSearchSortOrder[] = [
  "path-asc",
  "path-desc",
  "modified-desc",
  "modified-asc",
  "created-desc",
  "created-asc"
];

function formatSearchMessage(message: string, values: Record<string, number | string>) {
  return Object.entries(values).reduce(
    (currentMessage, [key, value]) => currentMessage.replaceAll(`{${key}}`, String(value)),
    message
  );
}

function countMessageKey(count: number, singularKey: I18nKey, pluralKey: I18nKey) {
  return count === 1 ? singularKey : pluralKey;
}

function groupSearchResultsByFile(results: readonly WorkspaceSearchResult[]) {
  const groups = new Map<string, GlobalSearchResultGroup>();

  results.forEach((result) => {
    const currentGroup = groups.get(result.file.path);
    if (currentGroup) {
      currentGroup.results.push(result);
      return;
    }

    groups.set(result.file.path, {
      file: result.file,
      results: [result]
    });
  });

  return Array.from(groups.values());
}

function sortSearchResultGroups(
  resultGroups: GlobalSearchResultGroup[],
  sortOrder: WorkspaceSearchSortOrder
) {
  const sortedGroups = [...resultGroups];

  sortedGroups.sort((left, right) => compareSearchResultGroups(left, right, sortOrder));

  return sortedGroups;
}

function compareSearchResultGroups(
  left: GlobalSearchResultGroup,
  right: GlobalSearchResultGroup,
  sortOrder: WorkspaceSearchSortOrder
) {
  if (sortOrder === "modified-asc" || sortOrder === "modified-desc") {
    return compareOptionalTime(left.file.modifiedAt, right.file.modifiedAt, sortOrder.endsWith("desc"))
      || compareSearchResultGroupPath(left, right);
  }

  if (sortOrder === "created-asc" || sortOrder === "created-desc") {
    return compareOptionalTime(left.file.createdAt, right.file.createdAt, sortOrder.endsWith("desc"))
      || compareSearchResultGroupPath(left, right);
  }

  const pathComparison = compareSearchResultGroupPath(left, right);
  return sortOrder === "path-desc" ? -pathComparison : pathComparison;
}

function compareOptionalTime(left: number | undefined, right: number | undefined, descending: boolean) {
  const leftTime = left ?? Number.NEGATIVE_INFINITY;
  const rightTime = right ?? Number.NEGATIVE_INFINITY;
  const comparison = leftTime - rightTime;

  return descending ? -comparison : comparison;
}

function compareSearchResultGroupPath(left: GlobalSearchResultGroup, right: GlobalSearchResultGroup) {
  return left.file.relativePath.localeCompare(right.file.relativePath, undefined, {
    sensitivity: "base"
  });
}

function directoryLabelFromRelativePath(relativePath: string) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const lastSeparatorIndex = normalizedPath.lastIndexOf("/");
  if (lastSeparatorIndex < 0) return null;

  const directory = normalizedPath.slice(0, lastSeparatorIndex).trim();
  return directory ? `${directory} /` : null;
}

function estimateResultGroupHeight(
  group: GlobalSearchResultGroup | undefined,
  collapsedFilePaths: Set<string>,
  expandedPreviewFilePaths: Set<string>
) {
  if (!group || collapsedFilePaths.has(group.file.path)) return collapsedResultGroupHeight;

  const previewExpanded = expandedPreviewFilePaths.has(group.file.path);
  const visibleResultCount = previewExpanded
    ? group.results.length
    : Math.min(group.results.length, collapsedGroupPreviewCount);
  const hiddenResultCount = group.results.length - visibleResultCount;
  const directoryHeight = directoryLabelFromRelativePath(group.file.relativePath) ? resultGroupDirectoryHeight : 0;
  const showMoreHeight = hiddenResultCount > 0 ? resultGroupShowMoreHeight : 0;

  return expandedResultGroupBaseHeight
    + directoryHeight
    + visibleResultCount * resultGroupMatchHeight
    + showMoreHeight;
}

function firstVirtualResultGroups(
  resultGroups: readonly GlobalSearchResultGroup[],
  getResultGroupKey: (index: number) => Key,
  estimateResultGroupSize: (index: number) => number
): VirtualResultGroupItem[] {
  const count = Math.min(resultGroups.length, fallbackRenderedResultGroupCount);
  const virtualGroups: VirtualResultGroupItem[] = [];
  let start = 0;

  for (let index = 0; index < count; index += 1) {
    virtualGroups.push({
      index,
      key: getResultGroupKey(index),
      start
    });
    start += estimateResultGroupSize(index);
  }

  return virtualGroups;
}

function renderHighlightedSnippet(
  snippet: string,
  highlightTerms: readonly WorkspaceSearchTerm[],
  fallbackQuery: string,
  caseSensitive: boolean
) {
  const normalizedQuery = fallbackQuery.trim();
  const terms = highlightTerms.length > 0
    ? highlightTerms
    : normalizedQuery
      ? [{
          caseSensitive,
          query: normalizedQuery,
          scope: "content" as const
        }]
      : [];
  if (terms.length === 0) return snippet;

  const ranges = terms
    .flatMap((term) => findSearchRanges(snippet, term.query, { caseSensitive: term.caseSensitive }))
    .sort((left, right) => left.from - right.from || right.to - left.to)
    .reduce<Array<{ from: number; to: number }>>((visibleRanges, range) => {
      const previousRange = visibleRanges.at(-1);
      if (previousRange && range.from < previousRange.to) return visibleRanges;

      visibleRanges.push(range);
      return visibleRanges;
    }, []);
  if (ranges.length === 0) return snippet;

  const nodes: ReactNode[] = [];
  let cursor = 0;

  ranges.forEach((range, index) => {
    if (range.from > cursor) nodes.push(snippet.slice(cursor, range.from));

    nodes.push(
      <mark
        className="global-search-match rounded-xs bg-(--accent-soft) px-0.5 font-bold text-(--text-heading)"
        key={`${range.from}:${range.to}:${index}`}
      >
        {snippet.slice(range.from, range.to)}
      </mark>
    );
    cursor = range.to;
  });

  if (cursor < snippet.length) nodes.push(snippet.slice(cursor));

  return nodes;
}

function workspaceSearchScopeMessageKey(scope: WorkspaceSearchScope): I18nKey {
  if (scope === "file") return "app.workspaceSearch.scopeFile";
  if (scope === "path") return "app.workspaceSearch.scopePath";

  return "app.workspaceSearch.scopeContent";
}

function workspaceSearchSortOrderLabelKey(sortOrder: WorkspaceSearchSortOrder): I18nKey {
  if (sortOrder === "created-asc") return "app.workspaceSearch.sortCreatedAsc";
  if (sortOrder === "created-desc") return "app.workspaceSearch.sortCreatedDesc";
  if (sortOrder === "modified-asc") return "app.workspaceSearch.sortModifiedAsc";
  if (sortOrder === "modified-desc") return "app.workspaceSearch.sortModifiedDesc";
  if (sortOrder === "path-desc") return "app.workspaceSearch.sortPathDesc";

  return "app.workspaceSearch.sortPathAsc";
}

function workspaceSearchDescriptionText(
  description: WorkspaceSearchQueryDescription,
  label: (key: I18nKey) => string,
  searchLabel: (key: I18nKey, values: Record<string, number | string>) => string
) {
  if (description.kind === "or") return label("app.workspaceSearch.explainOr");

  const scope = label(workspaceSearchScopeMessageKey(description.scope));

  return searchLabel(
    description.kind === "include"
      ? "app.workspaceSearch.explainInclude"
      : "app.workspaceSearch.explainExclude",
    {
      query: description.query,
      scope
    }
  );
}

export function GlobalSearchPanel({
  caseSensitive,
  language = "en",
  loading,
  query,
  recentQueries = [],
  results,
  searchedFileCount,
  sortOrder = "path-asc",
  truncated,
  unreadableFileCount,
  onCaseSensitiveChange,
  onClose,
  onOpenResult,
  onQueryChange,
  onRecentQuerySelect,
  onSortOrderChange
}: GlobalSearchPanelProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [resultListElement, setResultListElement] = useState<HTMLDivElement | null>(null);
  const label = (key: I18nKey) => t(language, key);
  const searchLabel = (key: I18nKey, values: Record<string, number | string>) =>
    formatSearchMessage(label(key), values);
  const [collapsedFilePaths, setCollapsedFilePaths] = useState<Set<string>>(() => new Set());
  const [expandedPreviewFilePaths, setExpandedPreviewFilePaths] = useState<Set<string>>(() => new Set());
  const resultGroups = useMemo(
    () => sortSearchResultGroups(groupSearchResultsByFile(results), sortOrder),
    [results, sortOrder]
  );
  const queryDescription = useMemo(
    () => isStructuredWorkspaceSearchQuery(query)
      ? describeWorkspaceSearchQuery(query, { caseSensitive })
      : [],
    [caseSensitive, query]
  );
  const highlightTerms = useMemo(
    () => workspaceSearchContentHighlightTerms(query, { caseSensitive }),
    [caseSensitive, query]
  );
  const getResultGroupKey = useCallback((index: number) => resultGroups[index]?.file.path ?? index, [resultGroups]);
  const estimateVirtualResultGroupSize = useCallback(
    (index: number) => estimateResultGroupHeight(
      resultGroups[index],
      collapsedFilePaths,
      expandedPreviewFilePaths
    ),
    [collapsedFilePaths, expandedPreviewFilePaths, resultGroups]
  );
  const resultGroupVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: resultGroups.length,
    estimateSize: estimateVirtualResultGroupSize,
    getItemKey: getResultGroupKey,
    getScrollElement: () => resultListElement,
    initialRect: {
      height: 420,
      width: 640
    },
    overscan: resultGroupOverscanCount,
    useFlushSync: false
  });
  const measuredVirtualResultGroups = resultGroupVirtualizer.getVirtualItems();
  const virtualResultGroups: VirtualResultGroupItem[] = measuredVirtualResultGroups.length > 0
    ? measuredVirtualResultGroups
    : firstVirtualResultGroups(resultGroups, getResultGroupKey, estimateVirtualResultGroupSize);
  const measureVirtualResultGroup = typeof ResizeObserver === "undefined"
    ? undefined
    : resultGroupVirtualizer.measureElement;
  const showRecentQueries = query.trim().length === 0
    && !loading
    && results.length === 0
    && recentQueries.length > 0;
  const showNoResults = query.trim().length > 0 && !loading && results.length === 0;
  const statusText = loading
    ? label("app.workspaceSearch.loading")
    : truncated
      ? searchLabel(countMessageKey(
          results.length,
          "app.workspaceSearch.truncatedResultCount",
          "app.workspaceSearch.truncatedResultCountPlural"
        ), { count: results.length })
      : searchLabel(countMessageKey(
          results.length,
          "app.workspaceSearch.resultCount",
          "app.workspaceSearch.resultCountPlural"
        ), { count: results.length });

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    resultGroupVirtualizer.scrollToOffset(0);
  }, [resultGroupVirtualizer, results]);

  useEffect(() => {
    resultGroupVirtualizer.measure();
  }, [collapsedFilePaths, expandedPreviewFilePaths, resultGroupVirtualizer]);

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Escape") return;

    event.preventDefault();
    onClose();
  };

  const toggleFileGroup = (path: string) => {
    setCollapsedFilePaths((current) => {
      const next = new Set(current);

      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }

      return next;
    });
  };

  const expandFilePreview = (path: string) => {
    setExpandedPreviewFilePaths((current) => new Set(current).add(path));
  };

  return (
    <div
      className="global-search-panel absolute left-1/2 top-14 z-50 flex w-[min(calc(100%-2rem),640px)] -translate-x-1/2 flex-col overflow-hidden rounded-md border border-(--border-strong) bg-(--bg-secondary)/98 text-[12px] text-(--text-primary) shadow-[0_18px_58px_rgba(0,0,0,0.18)] backdrop-blur-sm"
      role="dialog"
      aria-label={label("app.workspaceSearch.searchWorkspace")}
    >
      <div className="flex min-w-0 items-center gap-1.5 border-b border-(--border-default) p-2">
        <Search aria-hidden="true" className="shrink-0 text-(--text-secondary)" size={15} />
        <input
          className="h-8 min-w-0 flex-1 rounded-sm border border-(--border-default) bg-(--bg-primary) px-2 text-[12px] text-(--text-heading) outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-(--text-secondary) focus:border-(--accent) focus:shadow-[0_0_0_2px_var(--accent-soft)]"
          aria-label={label("app.workspaceSearch.searchWorkspace")}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          placeholder={label("app.workspaceSearch.placeholder")}
          ref={inputRef}
          role="searchbox"
          spellCheck={false}
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.currentTarget.value)}
          onKeyDown={handleSearchKeyDown}
        />
        <button
          className="document-search-icon-button"
          aria-label={label("app.workspaceSearch.caseSensitive")}
          aria-pressed={caseSensitive}
          type="button"
          onClick={() => onCaseSensitiveChange(!caseSensitive)}
        >
          <CaseSensitive aria-hidden="true" size={14} />
        </button>
        <select
          className="h-8 max-w-[8.5rem] shrink-0 rounded-sm border border-(--border-default) bg-(--bg-primary) px-1.5 text-[11px] font-[560] text-(--text-primary) outline-none transition-[border-color,box-shadow] duration-150 focus:border-(--accent) focus:shadow-[0_0_0_2px_var(--accent-soft)]"
          aria-label={label("app.workspaceSearch.sortResults")}
          value={sortOrder}
          onChange={(event) => onSortOrderChange?.(event.currentTarget.value as WorkspaceSearchSortOrder)}
        >
          {workspaceSearchSortOrders.map((order) => (
            <option key={order} value={order}>
              {label(workspaceSearchSortOrderLabelKey(order))}
            </option>
          ))}
        </select>
        <button
          className="document-search-icon-button"
          aria-label={label("app.workspaceSearch.close")}
          type="button"
          onClick={onClose}
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>
      <div className="flex min-h-0 max-h-[min(52vh,420px)] flex-col">
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-(--border-default) px-3 text-[11px] font-[560] text-(--text-secondary)">
          {loading ? <Loader2 aria-hidden="true" className="animate-spin" size={13} /> : null}
          <span>{statusText}</span>
          <span>
            {searchLabel(countMessageKey(
              searchedFileCount,
              "app.workspaceSearch.fileCount",
              "app.workspaceSearch.fileCountPlural"
            ), { count: searchedFileCount })}
          </span>
          {unreadableFileCount > 0 ? (
            <span>{searchLabel("app.workspaceSearch.unreadableFileCount", { count: unreadableFileCount })}</span>
          ) : null}
        </div>
        {queryDescription.length > 0 ? (
          <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-(--border-default) px-3 py-1.5 text-[11px] text-(--text-secondary)">
            {queryDescription.map((description, index) => (
              <span
                className="rounded-sm bg-(--bg-active) px-1.5 py-0.5 font-[560]"
                key={`${description.kind}:${"scope" in description ? `${description.scope}:${description.query}` : "or"}:${index}`}
              >
                {workspaceSearchDescriptionText(description, label, searchLabel)}
              </span>
            ))}
          </div>
        ) : null}
        {results.length > 0 ? (
          <div
            className="m-0 min-h-0 list-none overflow-y-auto px-2 py-1"
            ref={setResultListElement}
            role="list"
            aria-label={label("app.workspaceSearch.results")}
          >
            <div
              className="relative w-full"
              style={{ height: `${resultGroupVirtualizer.getTotalSize()}px` }}
            >
              {virtualResultGroups.map((virtualGroup) => {
                const group = resultGroups[virtualGroup.index];
                if (!group) return null;

                const collapsed = collapsedFilePaths.has(group.file.path);
                const previewExpanded = expandedPreviewFilePaths.has(group.file.path);
                const visibleResults = previewExpanded
                  ? group.results
                  : group.results.slice(0, collapsedGroupPreviewCount);
                const hiddenResultCount = group.results.length - visibleResults.length;
                const directoryLabel = directoryLabelFromRelativePath(group.file.relativePath);

                return (
                  <div
                    className="absolute left-0 top-0 w-full border-b border-(--border-default)"
                    data-index={virtualGroup.index}
                    key={virtualGroup.key}
                    ref={measureVirtualResultGroup}
                    role="listitem"
                    style={{ transform: `translateY(${virtualGroup.start}px)` }}
                  >
                    <section
                      role="group"
                      aria-label={searchLabel("app.workspaceSearch.fileSearchResults", {
                        path: group.file.relativePath
                      })}
                    >
                      <button
                        className="grid w-full cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-sm border-0 bg-transparent px-1.5 py-2 text-left outline-none transition-[background-color,color] duration-150 hover:bg-(--bg-hover) focus-visible:bg-(--bg-active) focus-visible:ring-2 focus-visible:ring-(--accent)"
                        aria-expanded={!collapsed}
                        aria-label={
                          collapsed
                            ? searchLabel("app.workspaceSearch.expandFile", { path: group.file.relativePath })
                            : searchLabel("app.workspaceSearch.collapseFile", { path: group.file.relativePath })
                        }
                        type="button"
                        onClick={() => toggleFileGroup(group.file.path)}
                      >
                        {collapsed
                          ? <ChevronRight aria-hidden="true" className="text-(--text-secondary)" size={14} />
                          : <ChevronDown aria-hidden="true" className="text-(--text-secondary)" size={14} />}
                        <span className="min-w-0 truncate text-[14px] font-[720] text-(--text-heading)">
                          {group.file.name}
                        </span>
                        <span className="rounded-sm bg-(--bg-active) px-2 py-0.5 text-[12px] font-[620] tabular-nums text-(--text-heading)">
                          {group.results.length}
                        </span>
                      </button>
                      {!collapsed ? (
                        <div className="pb-2 pl-7 pr-1">
                          {directoryLabel ? (
                            <div className="mb-1 truncate font-mono text-[11px] text-(--text-secondary)">
                              {directoryLabel}
                            </div>
                          ) : null}
                          <ul className="m-0 list-none p-0" role="list" aria-label={`${group.file.relativePath} matches`}>
                            {visibleResults.map((result) => (
                              <li key={result.id}>
                                <button
                                  className="block w-full cursor-pointer rounded-sm border-0 bg-transparent px-0 py-1 text-left outline-none transition-[background-color,color] duration-150 hover:bg-(--bg-hover) focus-visible:bg-(--bg-active) focus-visible:ring-2 focus-visible:ring-(--accent)"
                                  aria-label={searchLabel("app.workspaceSearch.openResult", {
                                    line: result.lineNumber,
                                    path: result.file.relativePath
                                  })}
                                  type="button"
                                  onClick={() => onOpenResult(result)}
                                >
                                  <span className="block min-w-0 truncate font-mono text-[12px] leading-5 text-(--text-primary)">
                                    {renderHighlightedSnippet(result.snippet, highlightTerms, query, caseSensitive)}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                          {hiddenResultCount > 0 ? (
                            <button
                              className="mt-0.5 cursor-pointer rounded-sm border-0 bg-transparent px-0 py-1 text-left text-[12px] font-[560] text-(--text-secondary) outline-none transition-colors duration-150 hover:text-(--text-heading) focus-visible:text-(--text-heading) focus-visible:ring-2 focus-visible:ring-(--accent)"
                              type="button"
                              onClick={() => expandFilePreview(group.file.path)}
                            >
                              {searchLabel(countMessageKey(
                                hiddenResultCount,
                                "app.workspaceSearch.showMoreMatches",
                                "app.workspaceSearch.showMoreMatchesPlural"
                              ), { count: hiddenResultCount })}
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </section>
                  </div>
                );
              })}
            </div>
          </div>
        ) : showRecentQueries ? (
          <div className="min-h-24 px-2 py-1">
            <div className="px-1.5 py-1 text-[11px] font-[560] text-(--text-secondary)">
              {label("app.workspaceSearch.recentSearches")}
            </div>
            <ul
              className="m-0 list-none p-0"
              role="list"
              aria-label={label("app.workspaceSearch.recentSearches")}
            >
              {recentQueries.map((recentQuery) => (
                <li key={recentQuery}>
                  <button
                    className="block w-full cursor-pointer rounded-sm border-0 bg-transparent px-1.5 py-1.5 text-left font-mono text-[12px] text-(--text-primary) outline-none transition-[background-color,color] duration-150 hover:bg-(--bg-hover) focus-visible:bg-(--bg-active) focus-visible:ring-2 focus-visible:ring-(--accent)"
                    aria-label={searchLabel("app.workspaceSearch.recentSearch", { query: recentQuery })}
                    type="button"
                    onClick={() => onRecentQuerySelect?.(recentQuery)}
                  >
                    <span className="block truncate">{recentQuery}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="flex min-h-24 items-center justify-center px-4 py-8 text-[12px] font-[560] text-(--text-secondary)">
            {showNoResults ? label("app.workspaceSearch.noResults") : label("app.workspaceSearch.empty")}
          </div>
        )}
      </div>
    </div>
  );
}
