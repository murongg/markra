import { t, type AppLanguage } from "@markra/shared";
import type { MarkdownShortcutMap } from "@markra/editor";
import type { EditorContentWidth } from "../lib/editor-width";
import type { EditorTheme, ExtendedSyntaxPreferences } from "../lib/settings/app-settings";
import type { MarkdownDocumentLinkFile } from "../lib/document-links";
import { MarkdownPaper } from "./MarkdownPaper";
import { MarkdownSourceEditor } from "./MarkdownSourceEditor";

type SideDocumentPaneProps = {
  bodyFontSize: number;
  content: string;
  contentWidth: EditorContentWidth;
  contentWidthPx: number | null;
  documentKey?: string | null;
  documentPath?: string | null;
  editorTheme: EditorTheme;
  extendedSyntax?: ExtendedSyntaxPreferences;
  language?: AppLanguage;
  lineHeight: number;
  markdownShortcuts?: MarkdownShortcutMap;
  mode: "source" | "visual";
  openExternalUrl?: (url: string) => unknown;
  readOnly?: boolean;
  resolveImageSrc?: (src: string) => string;
  revision: number;
  workspaceFiles?: MarkdownDocumentLinkFile[];
  onChange: (content: string) => unknown;
  onContentWidthChange?: (width: number) => unknown;
  onContentWidthResizeEnd?: () => unknown;
  onFocus?: () => unknown;
};

function ignoreSideEditorReady() {
  return null;
}

export function SideDocumentPane({
  bodyFontSize,
  content,
  contentWidth,
  contentWidthPx,
  documentKey,
  documentPath,
  editorTheme,
  extendedSyntax,
  language = "en",
  lineHeight,
  markdownShortcuts,
  mode,
  openExternalUrl,
  readOnly = false,
  resolveImageSrc,
  revision,
  workspaceFiles,
  onChange,
  onContentWidthChange,
  onContentWidthResizeEnd,
  onFocus
}: SideDocumentPaneProps) {
  const label = (key: Parameters<typeof t>[1]) => t(language, key);

  return (
    <section
      className="side-document-pane relative h-full min-h-0 overflow-hidden bg-(--bg-primary)"
      aria-label={label("app.sideDocument")}
      onFocusCapture={onFocus}
    >
      {mode === "source" ? (
        <MarkdownSourceEditor
          bodyFontSize={bodyFontSize}
          content={content}
          contentWidth={contentWidth}
          contentWidthPx={contentWidthPx}
          extendedSyntax={extendedSyntax}
          language={language}
          lineHeight={lineHeight}
          onChange={onChange}
          onContentWidthChange={onContentWidthChange}
          onContentWidthResizeEnd={onContentWidthResizeEnd}
          readOnly={readOnly}
          topInset="titlebar"
        />
      ) : (
        <MarkdownPaper
          autoFocus={false}
          bodyFontSize={bodyFontSize}
          contentWidth={contentWidth}
          contentWidthPx={contentWidthPx}
          documentKey={documentKey}
          documentPath={documentPath}
          editorTheme={editorTheme}
          extendedSyntax={extendedSyntax}
          initialContent={content}
          language={language}
          lineHeight={lineHeight}
          markdownShortcuts={markdownShortcuts}
          onEditorReady={ignoreSideEditorReady}
          onMarkdownChange={onChange}
          onContentWidthChange={onContentWidthChange}
          onContentWidthResizeEnd={onContentWidthResizeEnd}
          openExternalUrl={openExternalUrl}
          readOnly={readOnly}
          resolveImageSrc={resolveImageSrc}
          revision={revision}
          topInset="titlebar"
          workspaceFiles={workspaceFiles}
        />
      )}
    </section>
  );
}
