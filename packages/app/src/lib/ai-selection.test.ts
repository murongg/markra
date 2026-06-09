import type { AiSelectionContext } from "@markra/ai";
import { automaticAiSelection, aiCommandSelection } from "./ai-selection";

function selection(overrides: Partial<AiSelectionContext> = {}): AiSelectionContext {
  return {
    cursor: 14,
    from: 2,
    source: "selection",
    text: "Synthetic selected text",
    to: 25,
    ...overrides
  };
}

describe("AI selection helpers", () => {
  it("keeps real selected text available for automatic AI surfaces", () => {
    const selectedText = selection();

    expect(automaticAiSelection(selectedText)).toBe(selectedText);
  });

  it("does not promote cursor block context into automatic AI surfaces", () => {
    expect(automaticAiSelection(selection({ source: "block" }))).toBeNull();
  });

  it("keeps cursor block context available for explicit AI commands", () => {
    const blockContext = selection({ source: "block" });

    expect(aiCommandSelection(blockContext)).toBe(blockContext);
  });

  it("ignores empty selection text", () => {
    expect(automaticAiSelection(selection({ text: "  " }))).toBeNull();
    expect(aiCommandSelection(selection({ text: "  " }))).toBeNull();
  });
});
