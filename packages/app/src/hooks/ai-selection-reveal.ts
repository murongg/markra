import { useEffect } from "react";
import type { AiSelectionContext } from "@markra/ai";

export const aiSelectionRevealDelayMs = 450;

type DeferredAiSelectionRevealInput = {
  active: boolean;
  bottomInset: number;
  delayMs?: number;
  reveal: (bottomInset: number) => unknown;
  selection: AiSelectionContext | null;
};

export function useDeferredAiSelectionReveal({
  active,
  bottomInset,
  delayMs = aiSelectionRevealDelayMs,
  reveal,
  selection
}: DeferredAiSelectionRevealInput) {
  const selectionSignature = aiSelectionRevealSignature(selection);

  useEffect(() => {
    if (!active || !selectionSignature || bottomInset <= 0) return;

    const timeout = window.setTimeout(() => {
      reveal(bottomInset);
    }, delayMs);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [active, bottomInset, delayMs, reveal, selectionSignature]);
}

export function aiSelectionRevealSignature(selection: AiSelectionContext | null) {
  if (!selection) return "";

  const text = selection.text.trim();
  if (!text) return "";

  return [selection.from, selection.to, selection.cursor ?? "", selection.source ?? "", text].join(":");
}
