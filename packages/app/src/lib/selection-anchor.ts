type AnchorRect = Pick<DOMRect, "bottom" | "height" | "left" | "right" | "top" | "width">;

export type SelectionAnchor = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export function selectionAnchorFromRects(rects: ArrayLike<AnchorRect> | Iterable<AnchorRect>): SelectionAnchor | null {
  const visibleRects = Array.from(rects).filter((rect) => {
    const width = Number.isFinite(rect.width) ? rect.width : rect.right - rect.left;
    const height = Number.isFinite(rect.height) ? rect.height : rect.bottom - rect.top;

    return width > 0 || height > 0;
  });
  if (!visibleRects.length) return null;

  return {
    bottom: Math.max(...visibleRects.map((rect) => rect.bottom)),
    left: Math.min(...visibleRects.map((rect) => rect.left)),
    right: Math.max(...visibleRects.map((rect) => rect.right)),
    top: Math.min(...visibleRects.map((rect) => rect.top))
  };
}

export function selectionAnchorFromDomSelection(selection: Selection | null | undefined): SelectionAnchor | null {
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;

  const range = selection.getRangeAt(0);
  const rectsAnchor = selectionAnchorFromRects(range.getClientRects());
  if (rectsAnchor) return rectsAnchor;

  return selectionAnchorFromRects([range.getBoundingClientRect()]);
}
