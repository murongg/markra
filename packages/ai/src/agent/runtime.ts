import { Agent } from "@earendil-works/pi-agent-core";

import { chatCompletionStream } from "./chat-completion";
import type { InlineAiAgentInput } from "./runtime/types";
import { assistantTextContent } from "./runtime/messages";
import { createPiAgentModel } from "./runtime/model";
import { createNativeChatStreamFn } from "./runtime/stream";
import { buildInlineAiMessages, normalizeInlineAiReplacement } from "./inline-prompt";

export { assistantTextContent } from "./runtime/messages";
export { createPiAgentModel } from "./runtime/model";
export { createNativeChatStreamFn } from "./runtime/stream";
export type { InlineAiAgentComplete, InlineAiAgentInput, InlineAiAgentTarget } from "./runtime/types";

const maxTargetContextChars = 1_600;

export async function runInlineAiAgent({
  complete = chatCompletionStream,
  documentContent,
  intent = "custom",
  model,
  onEvent,
  prompt,
  provider,
  target,
  thinkingEnabled,
  translationTargetLanguage
}: InlineAiAgentInput) {
  const targetContext = nearbyTargetContext(documentContent, target.from, target.to, {
    direction: target.type === "insert" || intent === "continue" ? "before" : "around"
  });
  const messages = buildInlineAiMessages({
    documentContent: "",
    intent,
    prompt,
    suggestionContext: target.suggestionContext,
    targetContext,
    targetScope: target.scope,
    targetText: target.promptText,
    targetType: target.type,
    translationTargetLanguage
  });
  const systemPrompt = messages.find((message) => message.role === "system")?.content ?? "";
  const userPrompt = [
    ...messages.filter((message) => message.role !== "system").map((message) => message.content)
  ].join("\n\n");
  const agent = new Agent({
    initialState: {
      model: createPiAgentModel(provider, model),
      systemPrompt
    },
    streamFn: createNativeChatStreamFn(provider, complete, thinkingEnabled)
  });
  let finalContent = "";
  let finishReason: string | undefined;
  let providerErrorMessage = "";

  agent.subscribe((event) => {
    onEvent?.(event);
    if (event.type !== "message_end" || event.message.role !== "assistant") return;

    finalContent = assistantTextContent(event.message);
    if (typeof event.message.errorMessage === "string" && event.message.errorMessage.trim()) {
      providerErrorMessage = event.message.errorMessage.trim();
    }
    finishReason = event.message.stopReason;
  });

  await agent.prompt(userPrompt);
  if (providerErrorMessage) {
    throw new Error(providerErrorMessage);
  }

  return {
    content: normalizeInlineAiReplacement(finalContent, {
      preserveLeadingWhitespace: target.type === "insert"
    }),
    finishReason
  };
}

function nearbyTargetContext(
  documentContent: string,
  from: number | undefined,
  to: number | undefined,
  {
    direction = "around"
  }: {
    direction?: "around" | "before";
  } = {}
) {
  if (typeof from !== "number" || typeof to !== "number") return null;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || to < from) return null;

  const targetFrom = clampPosition(from, documentContent.length);
  const targetTo = clampPosition(to, documentContent.length);
  const beforeChars = direction === "before" ? maxTargetContextChars : Math.floor(maxTargetContextChars / 2);
  const afterChars = direction === "before" ? 0 : Math.floor(maxTargetContextChars / 2);

  const contextStart = Math.max(0, targetFrom - beforeChars);
  const contextEnd = Math.min(documentContent.length, targetTo + afterChars);
  const lineStart = documentContent.lastIndexOf("\n", Math.max(0, contextStart - 1)) + 1;
  const nextLineBreak = documentContent.indexOf("\n", contextEnd);
  const lineEnd = nextLineBreak === -1 ? documentContent.length : nextLineBreak;
  const excerpt = documentContent.slice(lineStart, lineEnd).trim();

  if (!excerpt) return null;
  if (excerpt.length <= maxTargetContextChars) return excerpt;

  return compactTargetContext(excerpt, targetFrom - lineStart, targetTo - lineStart);
}

function compactTargetContext(excerpt: string, targetFrom: number, targetTo: number) {
  const targetText = excerpt.slice(targetFrom, targetTo);
  const sideLength = Math.max(0, Math.floor((maxTargetContextChars - targetText.length) / 2) - 8);
  const start = Math.max(0, targetFrom - sideLength);
  const end = Math.min(excerpt.length, targetTo + sideLength);
  const prefix = start > 0 ? "[...]\n" : "";
  const suffix = end < excerpt.length ? "\n[...]" : "";

  return `${prefix}${excerpt.slice(start, end).trim()}${suffix}`;
}

function clampPosition(position: number, documentLength: number) {
  return Math.min(Math.max(position, 0), documentLength);
}
