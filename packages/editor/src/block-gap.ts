import { NodeSelection, Plugin } from "@milkdown/kit/prose/state";
import type { EditorView } from "@milkdown/kit/prose/view";
import { $prose } from "@milkdown/kit/utils";

const gapGuardedBlockNames = new Set(["hr"]);
const fallbackGuardedGapPadding = 20;
const guardedBlockVisualLineHeight = 2;

type GuardedBlockTarget = {
  kind: "guard" | "line";
  position: number;
};

function isPlainLeftMouseDown(event: MouseEvent) {
  return event.button === 0 && !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey;
}

function eventTargetElement(target: EventTarget | null) {
  return target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
}

function pixelValue(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function guardedGapExtent(value: string) {
  const pixels = pixelValue(value);
  if (!pixels) return fallbackGuardedGapPadding;

  return pixels;
}

function blockGapExtents(element: Element) {
  const ownerWindow = element.ownerDocument.defaultView;
  if (!ownerWindow) {
    return {
      bottom: fallbackGuardedGapPadding,
      top: fallbackGuardedGapPadding
    };
  }

  const style = ownerWindow.getComputedStyle(element);
  return {
    bottom: guardedGapExtent(style.marginBottom),
    top: guardedGapExtent(style.marginTop)
  };
}

function horizontalPointIsInsideRect(left: number, rect: DOMRect) {
  return left >= rect.left && left <= rect.right;
}

function verticalPointIsInsideBlockGap(top: number, rect: DOMRect, gap: { bottom: number; top: number }) {
  if (top >= rect.top - gap.top && top < rect.top) return true;
  if (top > rect.bottom && top <= rect.bottom + gap.bottom) return true;

  return false;
}

function verticalPointIsInsideBlockHitTarget(top: number, rect: DOMRect) {
  return top >= rect.top && top <= rect.bottom;
}

function verticalPointIsInsideBlockVisualLine(top: number, rect: DOMRect) {
  const center = rect.top + rect.height / 2;
  const halfHeight = Math.min(Math.max(guardedBlockVisualLineHeight / 2, 0.5), Math.max(rect.height / 2, 0.5));

  return top >= center - halfHeight && top <= center + halfHeight;
}

function verticalPointIsInsideGuardedBlockZone(top: number, rect: DOMRect, gap: { bottom: number; top: number }) {
  return verticalPointIsInsideBlockGap(top, rect, gap) || verticalPointIsInsideBlockHitTarget(top, rect);
}

function eventTargetsEditorContent(view: EditorView, target: EventTarget | null) {
  const element = eventTargetElement(target);
  return Boolean(element && (element === view.dom || view.dom.contains(element)));
}

function guardedBlockElementTarget(view: EditorView, target: EventTarget | null): GuardedBlockTarget | null {
  const element = eventTargetElement(target)?.closest("hr");
  if (!element || !view.dom.contains(element)) return null;

  let blockTarget: GuardedBlockTarget | null = null;
  view.state.doc.descendants((node, position) => {
    if (!gapGuardedBlockNames.has(node.type.name)) return true;
    if (view.nodeDOM(position) !== element) return true;

    blockTarget = {
      kind: "line",
      position
    };
    return false;
  });

  return blockTarget;
}

function guardedBlockTargetAtPoint(view: EditorView, left: number, top: number): GuardedBlockTarget | null {
  let target: GuardedBlockTarget | null = null;

  view.state.doc.descendants((node, position) => {
    if (!gapGuardedBlockNames.has(node.type.name)) return true;

    const dom = view.nodeDOM(position);
    const element = eventTargetElement(dom);
    const rect = element?.getBoundingClientRect();
    if (!element || !rect || !horizontalPointIsInsideRect(left, rect)) return true;

    const gap = blockGapExtents(element);
    if (verticalPointIsInsideBlockHitTarget(top, rect) && verticalPointIsInsideBlockVisualLine(top, rect)) {
      target = {
        kind: "line",
        position
      };
      return false;
    }

    if (verticalPointIsInsideGuardedBlockZone(top, rect, gap)) {
      target = {
        kind: "guard",
        position
      };
    }

    return true;
  });

  return target;
}

function guardedBlockTargetFromEvent(view: EditorView, event: MouseEvent): GuardedBlockTarget | null {
  const elementTarget = guardedBlockElementTarget(view, event.target);
  if (!elementTarget) return guardedBlockTargetAtPoint(view, event.clientX, event.clientY);

  return elementTarget;
}

function selectGuardedBlock(view: EditorView, position: number) {
  view.dispatch(
    view.state.tr
      .setSelection(NodeSelection.create(view.state.doc, position))
      .scrollIntoView()
  );
  view.focus();
}

export function createBlockGapPlugin() {
  return new Plugin({
    props: {
      handleDOMEvents: {
        mousedown(view, event) {
          if (!view.editable || !isPlainLeftMouseDown(event)) return false;
          if (!eventTargetsEditorContent(view, event.target)) return false;
          const target = guardedBlockTargetFromEvent(view, event);
          if (!target) return false;

          event.preventDefault();
          event.stopPropagation();
          if (target.kind === "line") selectGuardedBlock(view, target.position);
          return true;
        }
      }
    }
  });
}

export const markraBlockGapPlugin = $prose(() => createBlockGapPlugin());
