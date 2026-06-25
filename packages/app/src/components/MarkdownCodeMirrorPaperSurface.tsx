import { useEffect, useMemo, useRef } from "react";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { Compartment, EditorState, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, type DecorationSet, type ViewUpdate } from "@codemirror/view";
import { minimalSetup } from "codemirror";
import { t, type AppLanguage } from "@markra/shared";

export type MarkdownCodeMirrorPaperSurfaceProps = {
  autoFocus?: boolean;
  initialContent: string;
  language?: AppLanguage;
  onMarkdownChange: (content: string) => unknown;
  readOnly?: boolean;
};

type MarkdownStrongRange = {
  contentFrom: number;
  contentTo: number;
  from: number;
  to: number;
};

function isEscapedMarkdownDelimiter(content: string, index: number) {
  let backslashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && content[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
}

function isStrongDelimiter(content: string, index: number) {
  return (
    content[index] === "*" &&
    content[index + 1] === "*" &&
    content[index - 1] !== "*" &&
    content[index + 2] !== "*" &&
    !isEscapedMarkdownDelimiter(content, index)
  );
}

function findNextStrongDelimiter(content: string, from: number) {
  for (let index = content.indexOf("**", from); index >= 0; index = content.indexOf("**", index + 2)) {
    if (isStrongDelimiter(content, index)) return index;
  }

  return -1;
}

function findMarkdownStrongRanges(content: string) {
  const ranges: MarkdownStrongRange[] = [];

  for (
    let openingMarkerFrom = findNextStrongDelimiter(content, 0);
    openingMarkerFrom >= 0;
    openingMarkerFrom = findNextStrongDelimiter(content, openingMarkerFrom + 2)
  ) {
    const contentFrom = openingMarkerFrom + 2;
    const closingMarkerFrom = findNextStrongDelimiter(content, contentFrom);

    if (closingMarkerFrom < 0) break;

    if (closingMarkerFrom > contentFrom) {
      ranges.push({
        contentFrom,
        contentTo: closingMarkerFrom,
        from: openingMarkerFrom,
        to: closingMarkerFrom + 2
      });
    }

    openingMarkerFrom = closingMarkerFrom;
  }

  return ranges;
}

function selectionTouchesStrongRange(state: EditorState, range: MarkdownStrongRange) {
  return state.selection.ranges.some((selectionRange) => {
    if (selectionRange.empty) return selectionRange.from >= range.from && selectionRange.from <= range.to;

    return selectionRange.from <= range.to && selectionRange.to >= range.from;
  });
}

function markdownFormattingMarkerClass(active: boolean) {
  return active
    ? "markdown-codemirror-formatting-marker markdown-codemirror-formatting-marker-active"
    : "markdown-codemirror-formatting-marker markdown-codemirror-formatting-marker-hidden";
}

function buildMarkdownVisualDecorations(view: EditorView): DecorationSet {
  const content = view.state.doc.toString();
  const decorations: Array<Range<Decoration>> = [];

  for (const range of findMarkdownStrongRanges(content)) {
    const markerClass = markdownFormattingMarkerClass(selectionTouchesStrongRange(view.state, range));

    decorations.push(
      Decoration.mark({ class: markerClass }).range(range.from, range.contentFrom),
      Decoration.mark({ class: "markdown-codemirror-strong-text" }).range(range.contentFrom, range.contentTo),
      Decoration.mark({ class: markerClass }).range(range.contentTo, range.to)
    );
  }

  return Decoration.set(decorations, true);
}

const markdownVisualDecorations = ViewPlugin.fromClass(class {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildMarkdownVisualDecorations(view);
  }

  update(update: ViewUpdate) {
    if (!update.docChanged && !update.selectionSet) return;

    this.decorations = buildMarkdownVisualDecorations(update.view);
  }
}, {
  decorations: (plugin) => plugin.decorations
});

function codeMirrorVisualContentAttributes(label: string, readOnly: boolean): Extension {
  return EditorView.contentAttributes.of({
    "aria-label": label,
    "aria-multiline": "true",
    "aria-readonly": readOnly ? "true" : "false",
    "data-language": "markdown",
    role: "textbox",
    spellcheck: "false"
  });
}

function codeMirrorVisualTheme(): Extension {
  return EditorView.theme({
    "&": {
      backgroundColor: "transparent",
      color: "var(--text-primary)",
      minHeight: "calc(100vh - 176px)"
    },
    "&.cm-editor": {
      height: "auto"
    },
    "&.cm-focused": {
      outline: "none"
    },
    ".cm-activeLine": {
      backgroundColor: "transparent"
    },
    ".cm-content": {
      minHeight: "calc(100vh - 176px)",
      padding: "0",
      whiteSpace: "pre-wrap",
      wordBreak: "break-word"
    },
    ".cm-cursor": {
      borderLeftColor: "currentColor"
    },
    ".cm-line": {
      padding: "0"
    },
    ".cm-scroller": {
      cursor: "text",
      fontFamily: "var(--editor-font-family)",
      lineHeight: "inherit",
      overflow: "visible"
    },
    ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": {
      backgroundColor: "color-mix(in srgb, var(--accent) 22%, transparent)"
    },
    ".markdown-codemirror-strong-text": {
      fontWeight: "700"
    },
    ".markdown-codemirror-formatting-marker": {
      color: "var(--text-secondary)",
      fontWeight: "400"
    },
    ".markdown-codemirror-formatting-marker-active": {
      fontSize: "0.86em",
      opacity: "0.62"
    },
    ".markdown-codemirror-formatting-marker-hidden": {
      fontSize: "0",
      letterSpacing: "0",
      opacity: "0"
    }
  });
}

export function MarkdownCodeMirrorPaperSurface({
  autoFocus = false,
  initialContent,
  language = "en",
  onMarkdownChange,
  readOnly = false
}: MarkdownCodeMirrorPaperSurfaceProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null);
  const initialContentRef = useRef(initialContent);
  const onMarkdownChangeRef = useRef(onMarkdownChange);
  const viewRef = useRef<EditorView | null>(null);
  const contentAttributesCompartmentRef = useRef(new Compartment());
  const editableCompartmentRef = useRef(new Compartment());
  const editorLabel = t(language, "app.markdownEditor");

  useEffect(() => {
    onMarkdownChangeRef.current = onMarkdownChange;
  }, [onMarkdownChange]);

  const extensions = useMemo(
    () => [
      minimalSetup,
      markdown({
        base: markdownLanguage,
        codeLanguages: []
      }),
      EditorView.lineWrapping,
      markdownVisualDecorations,
      contentAttributesCompartmentRef.current.of(codeMirrorVisualContentAttributes(editorLabel, readOnly)),
      editableCompartmentRef.current.of(EditorView.editable.of(!readOnly)),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged) return;

        onMarkdownChangeRef.current(update.state.doc.toString());
      }),
      codeMirrorVisualTheme()
    ],
    [editorLabel]
  );

  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container || viewRef.current) return;

    const view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: initialContentRef.current,
        extensions
      })
    });

    viewRef.current = view;
    if (autoFocus) view.focus();

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [autoFocus, extensions]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    view.dispatch({
      effects: [
        contentAttributesCompartmentRef.current.reconfigure(
          codeMirrorVisualContentAttributes(editorLabel, readOnly)
        ),
        editableCompartmentRef.current.reconfigure(EditorView.editable.of(!readOnly))
      ]
    });
  }, [editorLabel, readOnly]);

  useEffect(() => {
    if (!autoFocus) return;

    viewRef.current?.focus();
  }, [autoFocus]);

  return (
    <div
      className="markdown-codemirror-editor min-h-[calc(100vh-176px)]"
      data-testid="markdown-codemirror-editor"
      ref={editorContainerRef}
    />
  );
}
