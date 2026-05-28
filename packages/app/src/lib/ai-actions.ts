import { buildInlineAiIntentInstruction, type AiEditIntent } from "@markra/ai";
import type { I18nKey } from "@markra/shared";

export type AiQuickActionId = Exclude<AiEditIntent, "custom">;
export type AiQuickActionPrompts = Record<AiQuickActionId, string>;

export const aiQuickActionIds = [
  "polish",
  "rewrite",
  "continue",
  "summarize",
  "translate"
] as const satisfies readonly AiQuickActionId[];

export const aiQuickActionLabelKeys: Record<AiQuickActionId, I18nKey> = {
  continue: "app.aiContinueWriting",
  polish: "app.aiPolish",
  rewrite: "app.aiRewrite",
  summarize: "app.aiSummarize",
  translate: "app.aiTranslate"
};

const legacyEnglishAiQuickActionPrompts: AiQuickActionPrompts = {
  continue: buildInlineAiIntentInstruction("continue"),
  polish: buildInlineAiIntentInstruction("polish"),
  rewrite: buildInlineAiIntentInstruction("rewrite"),
  summarize: buildInlineAiIntentInstruction("summarize"),
  translate: "Automatically detect the target text's current language before translating it. If the target text is mostly English, translate it into Simplified Chinese. If the target text is mostly Chinese, translate it into English. For other languages, translate it into English unless the user instruction names another target language. If the user instruction explicitly names a different target language, use that explicit language instead. Preserve Markdown formatting."
};

const englishTargetAiQuickActionPrompts: AiQuickActionPrompts = {
  ...legacyEnglishAiQuickActionPrompts,
  translate: buildInlineAiIntentInstruction("translate", "English")
};

export const defaultAiQuickActionPrompts: AiQuickActionPrompts = {
  continue: "",
  polish: "",
  rewrite: "",
  summarize: "",
  translate: ""
};

export function defaultAiQuickActionPrompt(actionId: AiQuickActionId, translationTargetLanguage = "English") {
  if (actionId === "translate") {
    return buildInlineAiIntentInstruction("translate", translationTargetLanguage);
  }

  return legacyEnglishAiQuickActionPrompts[actionId];
}

export function normalizeAiQuickActionPrompts(value: unknown): AiQuickActionPrompts {
  if (typeof value !== "object" || value === null) return { ...defaultAiQuickActionPrompts };

  const storedPrompts = value as Partial<Record<AiQuickActionId, unknown>>;

  return aiQuickActionIds.reduce<AiQuickActionPrompts>((prompts, actionId) => {
    const prompt = storedPrompts[actionId];

    return {
      ...prompts,
      [actionId]: normalizeAiQuickActionPrompt(actionId, prompt)
    };
  }, { ...defaultAiQuickActionPrompts });
}

function normalizeAiQuickActionPrompt(actionId: AiQuickActionId, value: unknown) {
  if (typeof value !== "string") return defaultAiQuickActionPrompts[actionId];

  if (
    value === legacyEnglishAiQuickActionPrompts[actionId] ||
    value === englishTargetAiQuickActionPrompts[actionId]
  ) {
    return defaultAiQuickActionPrompts[actionId];
  }

  return value;
}

export function resolveAiQuickActionPrompt(prompts: AiQuickActionPrompts, actionId: AiQuickActionId, fallback: string) {
  const customPrompt = prompts[actionId]?.trim();

  return customPrompt ? customPrompt : fallback;
}
