import { clampNumber } from "@markra/shared";

export type EditorContentWidth = "narrow" | "default" | "wide";

export const editorContentWidthOptions: EditorContentWidth[] = ["narrow", "default", "wide"];

export const editorContentWidthPixels = {
  default: 860,
  narrow: 720,
  wide: 1040
} satisfies Record<EditorContentWidth, number>;

export const editorCustomContentWidthMin = 640;
export const editorCustomContentWidthMax = 1280;

export function normalizeEditorContentWidthPx(value: unknown) {
  const width = clampNumber(value, editorCustomContentWidthMin, editorCustomContentWidthMax);

  return width === null ? null : Math.round(width);
}
