import { describe, expect, it } from "vitest";
import {
  resolveEditorContentWidthBasePx,
  resolveResponsiveEditorContentWidthPx,
  shouldShowEditorWidthResizer
} from "./editor-width";

describe("editor width", () => {
  it("scales preset editor content widths when the editor area has extra horizontal room", () => {
    expect(resolveResponsiveEditorContentWidthPx({
      contentWidth: "default",
      contentWidthPx: null,
      editorAreaWidth: 1024
    })).toBe(860);
    expect(resolveResponsiveEditorContentWidthPx({
      contentWidth: "default",
      contentWidthPx: null,
      editorAreaWidth: 1688
    })).toBe(1210);
    expect(resolveResponsiveEditorContentWidthPx({
      contentWidth: "wide",
      contentWidthPx: null,
      editorAreaWidth: 1688
    })).toBe(1280);
  });

  it("applies custom editor content widths as offsets from the responsive preset width", () => {
    expect(resolveResponsiveEditorContentWidthPx({
      contentWidth: "default",
      contentWidthPx: 980,
      editorAreaWidth: 1688
    })).toBe(1280);
    expect(resolveResponsiveEditorContentWidthPx({
      contentWidth: "default",
      contentWidthPx: 780,
      editorAreaWidth: 2200
    })).toBe(1200);
    expect(resolveResponsiveEditorContentWidthPx({
      contentWidth: "default",
      contentWidthPx: 780,
      editorAreaWidth: 1024
    })).toBe(780);
  });

  it("converts the displayed editor content width back to the stored base width", () => {
    expect(resolveEditorContentWidthBasePx({
      contentWidth: "default",
      editorAreaWidth: 1688,
      renderedContentWidthPx: 1280
    })).toBe(930);
    expect(resolveEditorContentWidthBasePx({
      contentWidth: "default",
      editorAreaWidth: 2200,
      renderedContentWidthPx: 1200
    })).toBe(780);
    expect(resolveEditorContentWidthBasePx({
      contentWidth: "default",
      editorAreaWidth: 1024,
      renderedContentWidthPx: 980
    })).toBe(980);
  });

  it("uses the responsive content width when deciding whether to show the resize handle", () => {
    expect(shouldShowEditorWidthResizer({
      aiAgentOpen: true,
      editorAreaWidth: 1216,
      editorContentWidth: 872
    })).toBe(true);
    expect(shouldShowEditorWidthResizer({
      aiAgentOpen: true,
      editorAreaWidth: 928,
      editorContentWidth: 860
    })).toBe(false);
  });
});
