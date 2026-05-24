import type { Tool } from "@earendil-works/pi-ai";
import { buildOpenAiCompatibleFunctionTools } from "../tool-builders/openai-compatible";
import { mergeRequestBody } from "./shared";

type ChatCompletionsRequestBodyParams = {
  extraBody?: Record<string, unknown>;
  messages: unknown[];
  model?: string;
  nativeTools?: Record<string, unknown>[];
  stream?: boolean;
  tools?: Tool[];
};

export function buildChatCompletionsRequestBody({
  extraBody = {},
  messages,
  model,
  nativeTools = [],
  stream,
  tools
}: ChatCompletionsRequestBodyParams) {
  const requestTools = [
    ...nativeTools,
    ...buildOpenAiCompatibleFunctionTools(tools)
  ];

  return mergeRequestBody(
    {
      messages,
      ...(model ? { model } : {}),
      ...(stream ? { stream: true } : {}),
      ...(requestTools.length
        ? {
            parallel_tool_calls: false,
            tool_choice: "auto",
            tools: requestTools
          }
        : {}),
      temperature: 0.7
    },
    extraBody
  );
}
