import { selectionAnchorFromRects } from "./selection-anchor";

function rect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
    x: 0,
    y: 0,
    toJSON: () => ({}),
    ...overrides
  };
}

describe("selection anchor", () => {
  it("merges visible selection rects into one toolbar anchor", () => {
    expect(selectionAnchorFromRects([
      rect({ bottom: 120, height: 20, left: 300, right: 420, top: 100, width: 120 }),
      rect({ bottom: 148, height: 20, left: 180, right: 360, top: 128, width: 180 })
    ])).toEqual({
      bottom: 148,
      left: 180,
      right: 420,
      top: 100
    });
  });

  it("ignores empty rects that jsdom may report for selections", () => {
    expect(selectionAnchorFromRects([
      rect(),
      rect({ bottom: 80, height: 18, left: 24, right: 124, top: 62, width: 100 })
    ])).toEqual({
      bottom: 80,
      left: 24,
      right: 124,
      top: 62
    });
  });
});
