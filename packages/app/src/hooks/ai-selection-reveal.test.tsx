import { renderHook } from "@testing-library/react";
import { aiSelectionRevealDelayMs, useDeferredAiSelectionReveal } from "./ai-selection-reveal";
import type { AiSelectionContext } from "@markra/ai";

function selection(overrides: Partial<AiSelectionContext> = {}): AiSelectionContext {
  return {
    from: 10,
    source: "selection",
    text: "Selected text",
    to: 23,
    ...overrides
  };
}

describe("deferred AI selection reveal", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits before revealing the selected text above the AI command", () => {
    const reveal = vi.fn();

    renderHook(() =>
      useDeferredAiSelectionReveal({
        active: true,
        bottomInset: 320,
        reveal,
        selection: selection()
      })
    );

    expect(reveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(aiSelectionRevealDelayMs - 1);
    expect(reveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(reveal).toHaveBeenCalledWith(320);
  });

  it("resets the reveal delay while the selected text is still changing", () => {
    const reveal = vi.fn();
    const { rerender } = renderHook(
      ({ currentSelection }: { currentSelection: AiSelectionContext }) =>
        useDeferredAiSelectionReveal({
          active: true,
          bottomInset: 320,
          reveal,
          selection: currentSelection
        }),
      {
        initialProps: {
          currentSelection: selection({ text: "Selected" })
        }
      }
    );

    vi.advanceTimersByTime(aiSelectionRevealDelayMs - 10);
    rerender({
      currentSelection: selection({ text: "Selected text" })
    });

    vi.advanceTimersByTime(10);
    expect(reveal).not.toHaveBeenCalled();

    vi.advanceTimersByTime(aiSelectionRevealDelayMs - 10);
    expect(reveal).toHaveBeenCalledTimes(1);
  });
});
