import { codeBlockSchema } from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode, NodeType, ResolvedPos } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@milkdown/kit/prose/state";
import { Decoration, DecorationSet, type EditorView, type NodeView, type ViewMutationRecord } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";
import { common, createLowlight } from "lowlight";
import { isMermaidLanguage, mermaidThemeFromElement, renderMermaidToSvg } from "./mermaid";

type HighlightAstNode = {
  children?: HighlightAstNode[];
  properties?: {
    className?: unknown;
  };
  type: string;
  value?: string;
};

type HighlightRange = {
  className: string;
  from: number;
  to: number;
};

type SplitFenceParagraph = {
  from: number;
  language: string;
  to: number;
};

type CodeBlockContentRange = {
  from: number;
  to: number;
};

type CodeBlockGetPosition = () => number | undefined;

type SvgChildSpec = {
  attributes: Record<string, string>;
  tag: "path" | "rect";
};

const codeLanguageOptions = [
  { label: "Plain Text", value: "" },
  { label: "Bash", value: "bash" },
  { label: "C", value: "c" },
  { label: "C++", value: "cpp" },
  { label: "C#", value: "csharp" },
  { label: "CSS", value: "css" },
  { label: "Diff", value: "diff" },
  { label: "Dockerfile", value: "dockerfile" },
  { label: "Go", value: "go" },
  { label: "GraphQL", value: "graphql" },
  { label: "HTML", value: "html" },
  { label: "INI", value: "ini" },
  { label: "Java", value: "java" },
  { label: "JavaScript", value: "javascript" },
  { label: "JSX", value: "jsx" },
  { label: "JSON", value: "json" },
  { label: "Kotlin", value: "kotlin" },
  { label: "Less", value: "less" },
  { label: "Lua", value: "lua" },
  { label: "Makefile", value: "makefile" },
  { label: "Markdown", value: "markdown" },
  { label: "Mermaid", value: "mermaid" },
  { label: "Nginx", value: "nginx" },
  { label: "Objective-C", value: "objectivec" },
  { label: "Perl", value: "perl" },
  { label: "PHP", value: "php" },
  { label: "PowerShell", value: "powershell" },
  { label: "Python", value: "python" },
  { label: "R", value: "r" },
  { label: "Ruby", value: "ruby" },
  { label: "Rust", value: "rust" },
  { label: "SCSS", value: "scss" },
  { label: "Shell", value: "sh" },
  { label: "SQL", value: "sql" },
  { label: "Svelte", value: "svelte" },
  { label: "Swift", value: "swift" },
  { label: "TOML", value: "toml" },
  { label: "TSX", value: "tsx" },
  { label: "TypeScript", value: "ts" },
  { label: "Vue", value: "vue" },
  { label: "XML", value: "xml" },
  { label: "YAML", value: "yaml" }
] as const;

const codeBlockHighlightKey = new PluginKey("markra-code-block-highlight");
const lowlight = createLowlight(common);
const codeFencePattern = /^```(?<language>[^\s`]*)$/u;
const svgNamespace = "http://www.w3.org/2000/svg";
const copyIconChildren: SvgChildSpec[] = [
  {
    tag: "rect",
    attributes: {
      height: "14",
      rx: "2",
      ry: "2",
      width: "14",
      x: "8",
      y: "8"
    }
  },
  {
    tag: "path",
    attributes: {
      d: "M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"
    }
  }
];
const checkIconChildren: SvgChildSpec[] = [
  {
    tag: "path",
    attributes: {
      d: "M20 6 9 17l-5-5"
    }
  }
];
const expandIconChildren: SvgChildSpec[] = [
  {
    tag: "path",
    attributes: {
      d: "M15 3h6v6"
    }
  },
  {
    tag: "path",
    attributes: {
      d: "m21 3-7 7"
    }
  },
  {
    tag: "path",
    attributes: {
      d: "M9 21H3v-6"
    }
  },
  {
    tag: "path",
    attributes: {
      d: "m3 21 7-7"
    }
  }
];
const closeIconChildren: SvgChildSpec[] = [
  {
    tag: "path",
    attributes: {
      d: "M18 6 6 18"
    }
  },
  {
    tag: "path",
    attributes: {
      d: "m6 6 12 12"
    }
  }
];

function normalizeCodeLanguage(language: unknown) {
  if (typeof language !== "string") return "";

  return language.trim().replace(/[\s`]+/gu, "-");
}

function codeLanguage(node: ProseNode) {
  return normalizeCodeLanguage(node.attrs.language);
}

function codeLanguageClass(language: string) {
  return language ? `language-${language.replace(/[^\w-]/gu, "-")}` : "";
}

function highlightClassNames(node: HighlightAstNode) {
  const className = node.properties?.className;
  if (!Array.isArray(className)) return [];

  return className.filter((value): value is string => typeof value === "string");
}

function collectHighlightRanges(
  node: HighlightAstNode,
  offset: number,
  inheritedClassNames: string[],
  ranges: HighlightRange[]
) {
  if (node.type === "text") {
    const value = node.value ?? "";
    if (value.length > 0 && inheritedClassNames.length > 0) {
      ranges.push({
        className: inheritedClassNames.join(" "),
        from: offset,
        to: offset + value.length
      });
    }

    return offset + value.length;
  }

  const classNames = [...inheritedClassNames, ...highlightClassNames(node)];
  let cursor = offset;
  for (const child of node.children ?? []) {
    cursor = collectHighlightRanges(child, cursor, classNames, ranges);
  }

  return cursor;
}

function highlightCode(language: string, code: string) {
  if (!code.trim()) return [];

  const ranges: HighlightRange[] = [];
  try {
    const tree = language && lowlight.registered(language)
      ? lowlight.highlight(language, code)
      : lowlight.highlightAuto(code);
    collectHighlightRanges(tree as HighlightAstNode, 0, [], ranges);
  } catch {
    return [];
  }

  return ranges;
}

function buildCodeBlockDecorations(doc: ProseNode, codeBlockType: NodeType) {
  const decorations: Decoration[] = [];

  doc.descendants((node, position) => {
    if (node.type !== codeBlockType) return;

    const blockStart = position + 1;
    for (const range of highlightCode(codeLanguage(node), node.textContent)) {
      if (range.from >= range.to) continue;

      decorations.push(
        Decoration.inline(blockStart + range.from, blockStart + range.to, {
          class: range.className
        })
      );
    }
  });

  return DecorationSet.create(doc, decorations);
}

function lineCountForCodeBlock(node: ProseNode) {
  return Math.max(1, node.textContent.split("\n").length);
}

function codeBlockSelectAllShortcutIsPressed(event: KeyboardEvent) {
  return (
    event.key.toLowerCase() === "a" &&
    (event.metaKey || event.ctrlKey) &&
    !event.altKey &&
    !event.shiftKey
  );
}

function codeBlockContentRangeAtPosition($pos: ResolvedPos, codeBlock: NodeType): CodeBlockContentRange | null {
  for (let depth = $pos.depth; depth > 0; depth -= 1) {
    if ($pos.node(depth).type === codeBlock) {
      return {
        from: $pos.start(depth),
        to: $pos.end(depth)
      };
    }
  }

  return null;
}

function codeBlockContentRangeForSelection(state: EditorState, codeBlock: NodeType) {
  const fromRange = codeBlockContentRangeAtPosition(state.selection.$from, codeBlock);
  const toRange = codeBlockContentRangeAtPosition(state.selection.$to, codeBlock);
  if (!fromRange || !toRange) return null;
  if (fromRange.from !== toRange.from || fromRange.to !== toRange.to) return null;

  return fromRange;
}

function selectCurrentCodeBlockContent(view: EditorView, codeBlock: NodeType) {
  const range = codeBlockContentRangeForSelection(view.state, codeBlock);
  if (!range) return false;

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, range.from, range.to))
      .scrollIntoView()
  );
  view.focus();

  return true;
}

function selectCodeBlockContentWithShortcut(view: EditorView, codeBlock: NodeType, event: KeyboardEvent) {
  if (!codeBlockSelectAllShortcutIsPressed(event)) return false;

  const handled = selectCurrentCodeBlockContent(view, codeBlock);
  if (!handled) return false;

  event.preventDefault();
  return true;
}

function targetIsInside(target: EventTarget | Node | null, container: HTMLElement) {
  return target instanceof Node && container.contains(target);
}

function createIcon(ownerDocument: Document, className: string, children: SvgChildSpec[]) {
  const icon = ownerDocument.createElementNS(svgNamespace, "svg");

  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("fill", "none");
  icon.setAttribute("height", "15");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("width", "15");
  icon.classList.add(className);

  for (const childSpec of children) {
    const child = ownerDocument.createElementNS(svgNamespace, childSpec.tag);
    for (const [name, value] of Object.entries(childSpec.attributes)) {
      child.setAttribute(name, value);
    }
    icon.append(child);
  }

  return icon;
}

function openCodeBlockWithInsertedFence(view: EditorView, codeBlock: NodeType, text: string) {
  const languageMatch = codeFencePattern.exec(text);
  if (!languageMatch) return false;

  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code) return false;

  const beforeCursor = $from.parent.textContent.slice(0, $from.parentOffset);
  const afterCursor = $from.parent.textContent.slice($from.parentOffset);
  if (beforeCursor.length > 0 || afterCursor.length > 0) return false;

  return replaceCurrentBlockWithCodeBlock(view, codeBlock, languageMatch.groups?.language ?? "");
}

function replaceCurrentBlockWithCodeBlock(view: EditorView, codeBlock: NodeType, language: string) {
  const { selection } = view.state;
  if (!(selection instanceof TextSelection)) return false;

  const { $from } = selection;
  const position = $from.before();
  const transaction = view.state.tr.replaceWith(position, $from.after(), codeBlock.create({
    language: normalizeCodeLanguage(language)
  }));
  view.dispatch(
    transaction.setSelection(TextSelection.create(transaction.doc, position + 1)).scrollIntoView()
  );
  return true;
}

function openCodeBlockWithFenceEnter(view: EditorView, codeBlock: NodeType, event: KeyboardEvent) {
  if (event.key !== "Enter" || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;

  const { selection } = view.state;
  if (!(selection instanceof TextSelection) || !selection.empty) return false;

  const text = selection.$from.parent.textContent;
  const languageMatch = codeFencePattern.exec(text);
  if (!languageMatch) return false;
  if (selection.$from.parentOffset !== text.length) return false;

  event.preventDefault();
  return replaceCurrentBlockWithCodeBlock(view, codeBlock, languageMatch.groups?.language ?? "");
}

function findSplitFenceParagraph(state: EditorState): SplitFenceParagraph | null {
  const { selection } = state;
  if (!(selection instanceof TextSelection) || !selection.empty) return null;

  let splitFence: SplitFenceParagraph | null = null;

  state.doc.descendants((node, position, parent, index) => {
    if (splitFence) return false;
    if (!parent || index >= parent.childCount - 1) return true;
    if (!node.isTextblock || node.type.spec.code) return true;

    const languageMatch = codeFencePattern.exec(node.textContent);
    if (!languageMatch) return true;

    const nextNode = parent.child(index + 1);
    if (!nextNode.isTextblock || nextNode.type.spec.code || nextNode.textContent.length > 0) return true;

    const nextPosition = position + node.nodeSize;
    const selectionIsInNextNode = selection.from > nextPosition && selection.from < nextPosition + nextNode.nodeSize;
    if (!selectionIsInNextNode) return true;

    splitFence = {
      from: position,
      language: languageMatch.groups?.language ?? "",
      to: nextPosition + nextNode.nodeSize
    };
    return false;
  });

  return splitFence;
}

function normalizeSplitFenceParagraph(
  transactions: readonly Transaction[],
  state: EditorState,
  codeBlock: NodeType
) {
  if (!transactions.some((transaction) => transaction.docChanged)) return null;

  const splitFence = findSplitFenceParagraph(state);
  if (!splitFence) return null;

  const transaction = state.tr.replaceWith(splitFence.from, splitFence.to, codeBlock.create({
    language: splitFence.language
  }));
  return transaction.setSelection(TextSelection.create(transaction.doc, splitFence.from + 1)).scrollIntoView();
}

function closeCodeBlockWithTrailingFence(view: EditorView, text: string) {
  const { selection } = view.state;
  if ((text !== "`" && text !== "```") || !(selection instanceof TextSelection) || !selection.empty) return false;

  const { $from } = selection;
  if ($from.parent.type.name !== "code_block") return false;

  const code = $from.parent.textContent;
  const beforeCursor = code.slice(0, $from.parentOffset);
  const afterCursor = code.slice($from.parentOffset);
  const lineStart = beforeCursor.lastIndexOf("\n") + 1;
  const nextLineBreak = afterCursor.indexOf("\n");
  const lineAfterCursor = nextLineBreak === -1 ? afterCursor : afterCursor.slice(0, nextLineBreak);
  const expectedLineBeforeCursor = text === "`" ? "``" : "";
  if (beforeCursor.slice(lineStart) !== expectedLineBeforeCursor || lineAfterCursor.length > 0) return false;

  const paragraph = view.state.schema.nodes.paragraph;
  if (!paragraph) return false;

  const deleteFrom = $from.start() + lineStart - (lineStart > 0 ? 1 : 0);
  const deleteTo = $from.pos;
  let transaction = view.state.tr.delete(deleteFrom, deleteTo);
  const insertPosition = transaction.mapping.map($from.after());
  transaction = transaction.insert(insertPosition, paragraph.create());
  view.dispatch(
    transaction.setSelection(TextSelection.create(transaction.doc, insertPosition + 1)).scrollIntoView()
  );
  return true;
}

class MarkraCodeBlockNodeView implements NodeView {
  readonly dom: HTMLElement;
  readonly contentDOM: HTMLElement;

  private node: ProseNode;
  private copyResetTimer: number | null = null;
  private readonly copyButton: HTMLButtonElement;
  private readonly lineNumbers: HTMLElement;
  private readonly languageControl: HTMLElement;
  private readonly languageSelect: HTMLSelectElement;
  private readonly pre: HTMLPreElement;
  private readonly code: HTMLElement;
  private readonly mermaidPreview: HTMLElement;
  private readonly mermaidPreviewButton: HTMLButtonElement;
  private readonly mermaidZoomButton: HTMLButtonElement;
  private readonly mermaidThemeObserver: MutationObserver | null = null;
  private mermaidZoomDialog: HTMLElement | null = null;
  private mermaidZoomFocusTarget: HTMLElement | null = null;
  private mermaidSourceEditing = false;
  private mermaidRenderSignature = "";
  private mermaidRenderToken = 0;

  constructor(
    node: ProseNode,
    private readonly view: EditorView,
    private readonly getPos: CodeBlockGetPosition
  ) {
    this.node = node;
    this.dom = view.dom.ownerDocument.createElement("div");
    this.copyButton = view.dom.ownerDocument.createElement("button");
    this.lineNumbers = view.dom.ownerDocument.createElement("div");
    this.languageControl = view.dom.ownerDocument.createElement("div");
    this.languageSelect = view.dom.ownerDocument.createElement("select");
    this.pre = view.dom.ownerDocument.createElement("pre");
    this.code = view.dom.ownerDocument.createElement("code");
    this.mermaidPreview = view.dom.ownerDocument.createElement("div");
    this.mermaidPreviewButton = view.dom.ownerDocument.createElement("button");
    this.mermaidZoomButton = view.dom.ownerDocument.createElement("button");
    this.contentDOM = this.code;

    this.dom.className = "markra-code-block";
    this.copyButton.className = "markra-code-copy-button";
    this.copyButton.type = "button";
    this.copyButton.contentEditable = "false";
    this.copyButton.dataset.copied = "false";
    this.copyButton.setAttribute("aria-label", "Copy code block");
    this.copyButton.title = "Copy code block";
    this.copyButton.append(
      createIcon(view.dom.ownerDocument, "markra-code-copy-icon", copyIconChildren),
      createIcon(view.dom.ownerDocument, "markra-code-copy-check-icon", checkIconChildren)
    );
    this.languageControl.className = "markra-code-language-control";
    this.languageControl.contentEditable = "false";
    this.languageSelect.className = "markra-code-language-select";
    this.languageSelect.setAttribute("aria-label", "Code block language");
    this.lineNumbers.className = "markra-code-line-numbers";
    this.lineNumbers.contentEditable = "false";
    this.lineNumbers.setAttribute("aria-hidden", "true");
    this.code.className = "markra-code-content";
    this.code.spellcheck = false;
    this.code.setAttribute("spellcheck", "false");
    this.code.setAttribute("autocorrect", "off");
    this.code.setAttribute("autocapitalize", "off");
    this.mermaidPreview.className = "markra-mermaid-render";
    this.mermaidPreview.contentEditable = "false";
    this.mermaidPreview.hidden = true;
    this.mermaidPreview.tabIndex = 0;
    this.mermaidPreview.title = "Edit Mermaid source";
    this.mermaidPreview.setAttribute("aria-busy", "false");
    this.mermaidPreview.setAttribute("aria-label", "Mermaid diagram");
    this.mermaidPreviewButton.className = "markra-mermaid-preview-button";
    this.mermaidPreviewButton.type = "button";
    this.mermaidPreviewButton.contentEditable = "false";
    this.mermaidPreviewButton.hidden = true;
    this.mermaidPreviewButton.setAttribute("aria-label", "Preview Mermaid diagram");
    this.mermaidPreviewButton.title = "Preview Mermaid diagram";
    this.mermaidPreviewButton.textContent = "Preview";
    this.mermaidZoomButton.className = "markra-mermaid-zoom-button";
    this.mermaidZoomButton.type = "button";
    this.mermaidZoomButton.contentEditable = "false";
    this.mermaidZoomButton.hidden = true;
    this.mermaidZoomButton.setAttribute("aria-label", "Enlarge Mermaid diagram");
    this.mermaidZoomButton.title = "Enlarge Mermaid diagram";
    this.mermaidZoomButton.append(createIcon(view.dom.ownerDocument, "markra-mermaid-zoom-icon", expandIconChildren));

    this.populateLanguageOptions();
    this.copyButton.addEventListener("click", this.handleCopyClick);
    this.languageSelect.addEventListener("change", this.handleLanguageChange);
    this.code.addEventListener("keydown", this.handleCodeKeyDown);
    this.mermaidPreview.addEventListener("click", this.handleMermaidPreviewClick);
    this.mermaidPreview.addEventListener("keydown", this.handleMermaidPreviewKeyDown);
    this.mermaidPreviewButton.addEventListener("click", this.handleMermaidPreviewButtonClick);
    this.mermaidZoomButton.addEventListener("click", this.handleMermaidZoomButtonClick);
    view.dom.ownerDocument.addEventListener("pointerdown", this.handleDocumentPointerDown, true);
    view.dom.ownerDocument.addEventListener("selectionchange", this.handleDocumentSelectionChange);
    this.mermaidThemeObserver = this.createMermaidThemeObserver();
    this.languageControl.append(this.languageSelect);
    this.pre.append(this.code);
    this.dom.append(
      this.lineNumbers,
      this.pre,
      this.mermaidPreview,
      this.mermaidPreviewButton,
      this.mermaidZoomButton,
      this.copyButton,
      this.languageControl
    );
    this.syncLanguage();
    this.syncLineNumbers();
    this.syncMermaidDisplayMode();
    this.syncMermaidPreview();
  }

  update(nextNode: ProseNode) {
    if (nextNode.type !== this.node.type) return false;

    this.node = nextNode;
    this.syncLanguage();
    this.syncLineNumbers();
    this.syncMermaidDisplayMode();
    this.syncMermaidPreview();
    return true;
  }

  stopEvent(event: Event) {
    return targetIsInside(event.target, this.copyButton) ||
      targetIsInside(event.target, this.lineNumbers) ||
      targetIsInside(event.target, this.mermaidPreview) ||
      targetIsInside(event.target, this.mermaidPreviewButton) ||
      targetIsInside(event.target, this.mermaidZoomButton) ||
      targetIsInside(event.target, this.languageControl);
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    return mutation.target === this.dom ||
      mutation.target === this.pre ||
      mutation.target === this.lineNumbers ||
      mutation.target === this.mermaidPreview ||
      mutation.target === this.mermaidPreviewButton ||
      mutation.target === this.mermaidZoomButton ||
      targetIsInside(mutation.target, this.copyButton) ||
      targetIsInside(mutation.target, this.lineNumbers) ||
      targetIsInside(mutation.target, this.mermaidPreview) ||
      targetIsInside(mutation.target, this.mermaidPreviewButton) ||
      targetIsInside(mutation.target, this.mermaidZoomButton) ||
      targetIsInside(mutation.target, this.languageControl);
  }

  destroy() {
    this.mermaidRenderToken += 1;
    this.closeMermaidZoom({ restoreFocus: false });
    this.copyButton.removeEventListener("click", this.handleCopyClick);
    this.languageSelect.removeEventListener("change", this.handleLanguageChange);
    this.code.removeEventListener("keydown", this.handleCodeKeyDown);
    this.mermaidPreview.removeEventListener("click", this.handleMermaidPreviewClick);
    this.mermaidPreview.removeEventListener("keydown", this.handleMermaidPreviewKeyDown);
    this.mermaidPreviewButton.removeEventListener("click", this.handleMermaidPreviewButtonClick);
    this.mermaidZoomButton.removeEventListener("click", this.handleMermaidZoomButtonClick);
    this.dom.ownerDocument.removeEventListener("pointerdown", this.handleDocumentPointerDown, true);
    this.dom.ownerDocument.removeEventListener("selectionchange", this.handleDocumentSelectionChange);
    this.mermaidThemeObserver?.disconnect();
    if (this.copyResetTimer !== null) {
      this.dom.ownerDocument.defaultView?.clearTimeout(this.copyResetTimer);
      this.copyResetTimer = null;
    }
  }

  private syncMermaidDisplayMode() {
    const isMermaid = isMermaidLanguage(codeLanguage(this.node));
    const hasSource = this.node.textContent.trim().length > 0;

    if (!isMermaid) {
      this.mermaidSourceEditing = false;
      delete this.dom.dataset.mermaidMode;
      this.mermaidPreview.hidden = true;
      this.mermaidPreviewButton.hidden = true;
      this.mermaidZoomButton.hidden = true;
      this.copyButton.hidden = false;
      this.languageControl.hidden = false;
      return;
    }

    const showSource = this.mermaidSourceEditing || !hasSource;
    const hideCodeChrome = !showSource && hasSource;
    this.dom.dataset.mermaidMode = showSource ? "source" : "preview";
    this.mermaidPreview.hidden = showSource || !hasSource;
    this.mermaidPreviewButton.hidden = !showSource || !hasSource;
    this.mermaidZoomButton.hidden = showSource || !hasSource || !this.mermaidPreview.querySelector("svg");
    this.copyButton.hidden = hideCodeChrome;
    this.languageControl.hidden = hideCodeChrome;
  }

  private clearMermaidPreview() {
    this.mermaidRenderSignature = "";
    this.mermaidRenderToken += 1;
    this.mermaidPreview.className = "markra-mermaid-render";
    this.mermaidPreview.removeAttribute("data-error");
    this.mermaidPreview.setAttribute("aria-busy", "false");
    this.mermaidPreview.replaceChildren();
    this.mermaidZoomButton.hidden = true;
    this.closeMermaidZoom({ restoreFocus: false });
    this.syncMermaidDisplayMode();
  }

  private syncMermaidPreview() {
    const language = codeLanguage(this.node);
    const source = this.node.textContent;
    if (!isMermaidLanguage(language) || !source.trim()) {
      this.clearMermaidPreview();
      return;
    }

    const theme = mermaidThemeFromElement(this.dom);
    const signature = `${theme}:${source}`;
    if (signature === this.mermaidRenderSignature) return;

    this.mermaidRenderSignature = signature;
    this.mermaidRenderToken += 1;
    const token = this.mermaidRenderToken;

    this.mermaidPreview.className = "markra-mermaid-render";
    this.mermaidPreview.removeAttribute("data-error");
    this.mermaidPreview.setAttribute("aria-busy", "true");
    this.syncMermaidDisplayMode();

    this.renderMermaidPreview(source, theme, token).catch(() => {});
  }

  private createMermaidThemeObserver() {
    const MutationObserverConstructor = this.view.dom.ownerDocument.defaultView?.MutationObserver;
    if (!MutationObserverConstructor) return null;

    const observer = new MutationObserverConstructor(this.handleMermaidThemeChange);
    const options = {
      attributeFilter: ["data-editor-theme", "data-theme"],
      attributes: true
    };
    const paper = this.view.dom.closest(".markdown-paper");
    if (paper) observer.observe(paper, options);
    observer.observe(this.view.dom.ownerDocument.documentElement, options);

    return observer;
  }

  private async renderMermaidPreview(source: string, theme: string, token: number) {
    try {
      const svg = await renderMermaidToSvg(source, {
        idPrefix: "markra-editor-mermaid",
        theme
      });
      if (token !== this.mermaidRenderToken) return;

      this.mermaidPreview.innerHTML = svg;
      this.mermaidPreview.classList.toggle("markra-mermaid-render-empty", !svg);
      this.mermaidPreview.setAttribute("aria-busy", "false");
      if (this.mermaidZoomDialog) this.updateMermaidZoomDiagram();
      this.syncMermaidDisplayMode();
    } catch (error) {
      if (token !== this.mermaidRenderToken) return;

      const message = this.dom.ownerDocument.createElement("span");
      message.className = "markra-mermaid-error";
      message.textContent = "Unable to render Mermaid diagram";

      this.mermaidPreview.className = "markra-mermaid-render markra-mermaid-render-invalid";
      this.mermaidPreview.dataset.error = error instanceof Error ? error.message : "Unknown Mermaid render error";
      this.mermaidPreview.setAttribute("aria-busy", "false");
      this.mermaidPreview.replaceChildren(message);
      this.closeMermaidZoom({ restoreFocus: false });
      this.syncMermaidDisplayMode();
    }
  }

  private cloneMermaidPreviewSvg() {
    const svg = this.mermaidPreview.querySelector("svg");
    if (!svg) return null;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.classList.add("markra-mermaid-zoom-svg");
    clone.removeAttribute("style");
    clone.removeAttribute("width");
    clone.removeAttribute("height");
    return clone;
  }

  private updateMermaidZoomDiagram() {
    const content = this.mermaidZoomDialog?.querySelector<HTMLElement>(".markra-mermaid-zoom-content");
    if (!content) return;

    const svg = this.cloneMermaidPreviewSvg();
    if (!svg) {
      this.closeMermaidZoom({ restoreFocus: false });
      return;
    }

    content.replaceChildren(svg);
  }

  private openMermaidZoom() {
    const svg = this.cloneMermaidPreviewSvg();
    if (!svg) return;

    this.closeMermaidZoom({ restoreFocus: false });

    const ownerDocument = this.dom.ownerDocument;
    const dialog = ownerDocument.createElement("div");
    const panel = ownerDocument.createElement("div");
    const closeButton = ownerDocument.createElement("button");
    const content = ownerDocument.createElement("div");

    dialog.className = "markra-mermaid-zoom-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", "Enlarged Mermaid diagram");
    panel.className = "markra-mermaid-zoom-panel";
    closeButton.className = "markra-mermaid-zoom-close-button";
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close enlarged Mermaid diagram");
    closeButton.title = "Close enlarged Mermaid diagram";
    closeButton.append(createIcon(ownerDocument, "markra-mermaid-zoom-close-icon", closeIconChildren));
    content.className = "markra-mermaid-zoom-content";

    content.append(svg);
    panel.append(closeButton, content);
    dialog.append(panel);
    dialog.addEventListener("mousedown", this.handleMermaidZoomDialogMouseDown);
    closeButton.addEventListener("click", this.handleMermaidZoomCloseClick);
    ownerDocument.addEventListener("keydown", this.handleMermaidZoomKeyDown, true);
    (this.view.dom.closest(".markdown-paper") ?? ownerDocument.body).append(dialog);

    this.mermaidZoomDialog = dialog;
    this.mermaidZoomFocusTarget = this.mermaidZoomButton;
    closeButton.focus();
  }

  private closeMermaidZoom({ restoreFocus = true }: { restoreFocus?: boolean } = {}) {
    const dialog = this.mermaidZoomDialog;
    if (!dialog) return;

    const closeButton = dialog.querySelector<HTMLButtonElement>(".markra-mermaid-zoom-close-button");
    dialog.removeEventListener("mousedown", this.handleMermaidZoomDialogMouseDown);
    closeButton?.removeEventListener("click", this.handleMermaidZoomCloseClick);
    this.dom.ownerDocument.removeEventListener("keydown", this.handleMermaidZoomKeyDown, true);
    dialog.remove();
    this.mermaidZoomDialog = null;

    const focusTarget = this.mermaidZoomFocusTarget;
    this.mermaidZoomFocusTarget = null;
    if (restoreFocus && focusTarget?.isConnected) focusTarget.focus();
  }

  private activateMermaidSourceEditing() {
    if (!isMermaidLanguage(codeLanguage(this.node))) return;

    this.mermaidSourceEditing = true;
    this.syncMermaidDisplayMode();

    const position = this.getPos();
    if (typeof position !== "number") return;

    const selectionPosition = position + 1;
    this.view.dispatch(
      this.view.state.tr
        .setSelection(TextSelection.create(this.view.state.doc, selectionPosition))
        .scrollIntoView()
    );
    this.view.focus();
  }

  private selectionIsInsideNode() {
    const position = this.getPos();
    if (typeof position !== "number") return false;

    const { from, to } = this.view.state.selection;
    return from >= position && to <= position + this.node.nodeSize;
  }

  private collapseMermaidSourceIfSelectionLeft() {
    if (!this.dom.isConnected || !this.mermaidSourceEditing || this.selectionIsInsideNode()) return;

    this.deactivateMermaidSourceEditing({ focusPreview: false });
  }

  private deactivateMermaidSourceEditing({ focusPreview = true }: { focusPreview?: boolean } = {}) {
    this.mermaidSourceEditing = false;
    this.syncMermaidDisplayMode();
    if (focusPreview) this.mermaidPreview.focus();
  }

  private selectCodeBlockContent() {
    return selectCurrentCodeBlockContent(this.view, this.node.type);
  }

  private readonly handleMermaidPreviewClick = (event: MouseEvent) => {
    event.preventDefault();
    this.activateMermaidSourceEditing();
  };

  private readonly handleMermaidPreviewKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;

    event.preventDefault();
    this.activateMermaidSourceEditing();
  };

  private readonly handleMermaidPreviewButtonClick = (event: MouseEvent) => {
    event.preventDefault();
    this.deactivateMermaidSourceEditing();
  };

  private readonly handleMermaidZoomButtonClick = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.openMermaidZoom();
  };

  private readonly handleMermaidZoomDialogMouseDown = (event: MouseEvent) => {
    if (event.target !== this.mermaidZoomDialog) return;

    event.preventDefault();
    this.closeMermaidZoom();
  };

  private readonly handleMermaidZoomCloseClick = (event: MouseEvent) => {
    event.preventDefault();
    this.closeMermaidZoom();
  };

  private readonly handleMermaidZoomKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;

    event.preventDefault();
    this.closeMermaidZoom();
  };

  private readonly handleCodeKeyDown = (event: KeyboardEvent) => {
    if (codeBlockSelectAllShortcutIsPressed(event)) {
      const handled = this.selectCodeBlockContent();
      if (!handled) return;

      event.preventDefault();
      event.stopPropagation();
      return;
    }

    if (event.key !== "Escape" || !this.mermaidSourceEditing) return;

    event.preventDefault();
    this.deactivateMermaidSourceEditing();
  };

  private readonly handleDocumentPointerDown = (event: PointerEvent) => {
    if (!this.dom.isConnected || !this.mermaidSourceEditing || targetIsInside(event.target, this.dom)) return;

    this.deactivateMermaidSourceEditing({ focusPreview: false });
  };

  private readonly handleDocumentSelectionChange = () => {
    this.dom.ownerDocument.defaultView?.setTimeout(() => {
      this.collapseMermaidSourceIfSelectionLeft();
    }, 0);
  };

  private readonly handleMermaidThemeChange = () => {
    this.syncMermaidPreview();
  };

  private syncLanguage() {
    const language = codeLanguage(this.node);
    this.syncLanguageOptions(language);
    this.languageSelect.value = language;

    if (language) {
      this.dom.dataset.language = language;
      this.code.className = `markra-code-content ${codeLanguageClass(language)}`;
    } else {
      delete this.dom.dataset.language;
      this.code.className = "markra-code-content";
    }
  }

  private syncLineNumbers() {
    const ownerDocument = this.dom.ownerDocument;
    const lines = Array.from({ length: lineCountForCodeBlock(this.node) }, (_, index) => {
      const line = ownerDocument.createElement("span");
      line.className = "markra-code-line-number";
      line.textContent = String(index + 1);
      return line;
    });

    this.lineNumbers.replaceChildren(...lines);
  }

  private populateLanguageOptions() {
    for (const language of codeLanguageOptions) {
      const option = this.dom.ownerDocument.createElement("option");
      option.value = language.value;
      option.textContent = language.label;
      this.languageSelect.append(option);
    }
  }

  private syncLanguageOptions(language: string) {
    this.languageSelect.querySelector("[data-markra-custom-language='true']")?.remove();
    if (!language || codeLanguageOptions.some((option) => option.value === language)) return;

    const option = this.dom.ownerDocument.createElement("option");
    option.value = language;
    option.textContent = language;
    option.dataset.markraCustomLanguage = "true";
    this.languageSelect.append(option);
  }

  private readonly handleLanguageChange = () => {
    const language = normalizeCodeLanguage(this.languageSelect.value);
    if (language === codeLanguage(this.node)) return;

    const position = this.getPos();
    if (typeof position !== "number") return;

    this.view.dispatch(
      this.view.state.tr.setNodeMarkup(position, undefined, {
        ...this.node.attrs,
        language
      })
    );
  };

  private readonly handleCopyClick = (event: MouseEvent) => {
    event.preventDefault();

    const clipboard = this.dom.ownerDocument.defaultView?.navigator.clipboard;
    if (!clipboard) return;

    Promise.resolve(clipboard.writeText(this.node.textContent))
      .then(() => {
        this.showCopiedState();
      })
      .catch(() => {});
  };

  private showCopiedState() {
    if (this.copyResetTimer !== null) {
      this.dom.ownerDocument.defaultView?.clearTimeout(this.copyResetTimer);
    }

    this.copyButton.dataset.copied = "true";
    this.copyButton.setAttribute("aria-label", "Code copied");
    this.copyButton.title = "Code copied";

    this.copyResetTimer = this.dom.ownerDocument.defaultView?.setTimeout(() => {
      this.copyButton.dataset.copied = "false";
      this.copyButton.setAttribute("aria-label", "Copy code block");
      this.copyButton.title = "Copy code block";
      this.copyResetTimer = null;
    }, 1400) ?? null;
  }
}

export const markraCodeBlockPlugin = $prose((ctx) => {
  const codeBlock = codeBlockSchema.type(ctx);

  return new Plugin({
    key: codeBlockHighlightKey,
    appendTransaction: (transactions, _oldState, newState) =>
      normalizeSplitFenceParagraph(transactions, newState, codeBlock),
    props: {
      decorations: (state) => buildCodeBlockDecorations(state.doc, codeBlock),
      handleKeyDown: (view, event) =>
        selectCodeBlockContentWithShortcut(view, codeBlock, event) ||
        openCodeBlockWithFenceEnter(view, codeBlock, event),
      handleTextInput: (view, _from, _to, text) =>
        closeCodeBlockWithTrailingFence(view, text) || openCodeBlockWithInsertedFence(view, codeBlock, text),
      nodeViews: {
        code_block: (node, view, getPos) => new MarkraCodeBlockNodeView(node, view, getPos)
      }
    }
  });
});
