import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { ThinkingContent, TextContent, ToolCall } from "@earendil-works/pi-ai";

import type { AiProviderConfig } from "@markra/providers";
import type { ChatCompletionStreamOptions } from "../chat-completion";
import type { ChatMessage, ChatResponse } from "../chat/types";
import type { AiEditIntent, AiTargetScope } from "../inline";
import type { AgentWorkspaceFile } from "../read-only-tools";

export type InlineAiSuggestionContext = {
  original: string;
  replacement: string;
};

export type AssistantContentBlock = TextContent | ThinkingContent | ToolCall;

export type InlineAiAgentTarget = {
  from?: number;
  original: string;
  promptText: string;
  scope?: AiTargetScope;
  suggestionContext?: InlineAiSuggestionContext;
  to?: number;
  type: "insert" | "replace";
};

export type InlineAiAgentComplete = (
  provider: AiProviderConfig,
  model: string,
  messages: ChatMessage[],
  options?: ChatCompletionStreamOptions
) => Promise<ChatResponse>;

export type InlineAiAgentInput = {
  complete?: InlineAiAgentComplete;
  documentContent: string;
  documentPath: string | null;
  intent?: AiEditIntent;
  model: string;
  onEvent?: (event: AgentEvent) => unknown;
  prompt: string;
  provider: AiProviderConfig;
  target: InlineAiAgentTarget;
  thinkingEnabled?: boolean;
  translationTargetLanguage?: string;
  workspaceFiles?: AgentWorkspaceFile[];
};
