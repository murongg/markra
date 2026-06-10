import { paragraphSchema } from "@milkdown/kit/preset/commonmark";
import type { Node as ProseNode, NodeType } from "@milkdown/kit/prose/model";
import { Plugin, PluginKey, TextSelection } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { Decoration, DecorationSet } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

const trailingParagraphKey = new PluginKey("markraTrailingParagraph");

function needsTrailingParagraphAffordance(doc: ProseNode, paragraph: NodeType) {
  const lastNode = doc.lastChild;
  if (!lastNode) return false;
  if (lastNode.type === paragraph) return false;
  if (lastNode.isTextblock || lastNode.isAtom) return false;

  return doc.canReplaceWith(doc.childCount, doc.childCount, paragraph);
}

function insertTrailingParagraph(view: EditorView, paragraph: NodeType) {
  if (!view.editable) return;
  if (!needsTrailingParagraphAffordance(view.state.doc, paragraph)) return;

  const insertAt = view.state.doc.content.size;
  const transaction = view.state.tr.insert(insertAt, paragraph.create());
  view.dispatch(
    transaction
      .setSelection(TextSelection.create(transaction.doc, insertAt + 1))
      .scrollIntoView()
  );
  view.focus();
}

function createTrailingParagraphWidget(view: EditorView, paragraph: NodeType) {
  const widget = view.dom.ownerDocument.createElement("div");
  widget.className = "markra-trailing-paragraph";
  widget.contentEditable = "false";
  widget.dataset.markraTrailingParagraph = "true";
  widget.setAttribute("aria-hidden", "true");
  widget.style.cursor = "text";
  widget.style.display = "block";
  widget.style.minHeight = "1.65em";
  widget.style.width = "100%";

  widget.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();
    insertTrailingParagraph(view, paragraph);
  });

  return widget;
}

export function createTrailingParagraphPlugin(paragraph: NodeType) {
  return new Plugin({
    key: trailingParagraphKey,
    props: {
      decorations(state) {
        if (!needsTrailingParagraphAffordance(state.doc, paragraph)) return DecorationSet.empty;

        return DecorationSet.create(state.doc, [
          Decoration.widget(
            state.doc.content.size,
            (view) => createTrailingParagraphWidget(view, paragraph),
            {
              key: "markra-trailing-paragraph",
              side: 1,
              stopEvent: (event) => event.type === "mousedown"
            }
          )
        ]);
      }
    }
  });
}

export const markraTrailingParagraphPlugin = $prose((ctx) =>
  createTrailingParagraphPlugin(paragraphSchema.type(ctx))
);
