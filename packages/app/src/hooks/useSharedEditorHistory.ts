import { useCallback, useEffect, useRef } from "react";

type MarkdownChangeOptions = {
  documentRevision?: number;
};

type ReplaceEditorMarkdown = (markdown: string, options?: { addToHistory?: boolean }) => boolean;

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
  const pendingSourceHistoryRef = useRef(false);
  const syncingSourceToVisualRef = useRef(false);

  const isApplyingSourceToVisualSync = useCallback(() => syncingSourceToVisualRef.current, []);
  const markSourceEditForHistory = useCallback((content: string, options?: MarkdownChangeOptions) => {
    if (
      content !== documentContent &&
      (options?.documentRevision === undefined || options.documentRevision === documentRevision)
    ) {
      pendingSourceHistoryRef.current = true;
    }
  }, [documentContent, documentRevision]);

  const syncSourceEditsToVisualHistory = useCallback(() => {
    if (largeMarkdownVisualBlocked) return false;
    syncingSourceToVisualRef.current = true;
    try {
      const synced = replaceEditorMarkdown(documentContent, {
        addToHistory: pendingSourceHistoryRef.current
      });
      if (synced) pendingSourceHistoryRef.current = false;
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
      pendingSourceHistoryRef.current = false;
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
