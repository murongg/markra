import { useCallback, useEffect, useRef } from "react";

type MarkdownChangeOptions = {
  documentRevision?: number;
};

type PendingSourceHistory = {
  previousContent: string;
};

type ReplaceEditorMarkdown = (
  markdown: string,
  options?: {
    addToHistory?: boolean;
    historyBaselineMarkdown?: string;
  }
) => boolean;

type SharedEditorHistoryOptions = {
  documentContent: string;
  documentRevision: number;
  largeMarkdownVisualBlocked: boolean;
  replaceEditorMarkdown: ReplaceEditorMarkdown;
  sourceSurfaceActive: boolean;
  syncSourceToVisual: boolean;
  visualEditorReadySequence: number;
};

export function useSharedEditorHistory({
  documentContent,
  documentRevision,
  largeMarkdownVisualBlocked,
  replaceEditorMarkdown,
  sourceSurfaceActive,
  syncSourceToVisual,
  visualEditorReadySequence
}: SharedEditorHistoryOptions) {
  const pendingSourceHistoryRef = useRef<PendingSourceHistory | null>(null);
  const syncingSourceToVisualRef = useRef(false);

  const isApplyingSourceToVisualSync = useCallback(() => syncingSourceToVisualRef.current, []);
  const markSourceEditForHistory = useCallback((content: string, options?: MarkdownChangeOptions) => {
    if (
      content !== documentContent &&
      (options?.documentRevision === undefined || options.documentRevision === documentRevision)
    ) {
      pendingSourceHistoryRef.current ??= {
        previousContent: documentContent
      };
    }
  }, [documentContent, documentRevision]);

  const syncSourceEditsToVisualHistory = useCallback(() => {
    if (largeMarkdownVisualBlocked) return false;
    syncingSourceToVisualRef.current = true;
    try {
      const pendingSourceHistory = pendingSourceHistoryRef.current;
      const synced = replaceEditorMarkdown(documentContent, {
        addToHistory: Boolean(pendingSourceHistory),
        historyBaselineMarkdown: pendingSourceHistory?.previousContent
      });
      if (synced) pendingSourceHistoryRef.current = null;
      return synced;
    } finally {
      syncingSourceToVisualRef.current = false;
    }
  }, [
    documentContent,
    largeMarkdownVisualBlocked,
    replaceEditorMarkdown
  ]);

  useEffect(() => {
    if (!sourceSurfaceActive || largeMarkdownVisualBlocked) {
      pendingSourceHistoryRef.current = null;
      return;
    }

    if (!syncSourceToVisual) return;

    syncSourceEditsToVisualHistory();
  }, [
    largeMarkdownVisualBlocked,
    sourceSurfaceActive,
    syncSourceEditsToVisualHistory,
    syncSourceToVisual,
    visualEditorReadySequence
  ]);

  return {
    isApplyingSourceToVisualSync,
    markSourceEditForHistory,
    syncSourceEditsToVisualHistory
  };
}
