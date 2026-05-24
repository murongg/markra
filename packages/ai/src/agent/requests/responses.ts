import type { Tool } from "@earendil-works/pi-ai";
import type { ChatMessage } from "../chat/types";
import { buildResponsesStyleTools } from "../tool-builders/openai-compatible";
import { mergeRequestBody } from "./shared";

type ResponsesRequestBodyParams = {
  extraBody?: Record<string, unknown>;
  messages: ChatMessage[];
  model: string;
  nativeWebSearchToolType?: "openrouter:web_search" | "web_search";
  stream?: boolean;
  tools?: Tool[];
};

type ResponsesContentPart =
  | {
      text: string;
      type: "input_text";
    }
  | {
      text: string;
      type: "output_text";
    }
  | {
      image_url: string;
      type: "input_image";
    };

type ResponsesMessageContent = string | ResponsesContentPart[];

type ResponsesToolResultOutput = string | ResponsesContentPart[];

type ResponsesInputItem =
  | {
      content: ResponsesMessageContent;
      role: ChatMessage["role"];
      type: "message";
    }
  | {
      arguments: string;
      call_id: string;
      id: string;
      name: string;
      type: "function_call";
    }
  | {
      call_id: string;
      output: ResponsesToolResultOutput;
      type: "function_call_output";
    };

export function buildResponsesRequestBody({
  extraBody = {},
  messages,
  model,
  nativeWebSearchToolType,
  stream,
  tools
}: ResponsesRequestBodyParams) {
  const responseTools = buildResponsesStyleTools(nativeWebSearchToolType, tools);

  return mergeRequestBody(
    {
      input: buildResponsesInputMessages(messages),
      ...(buildResponsesInstructions(messages) ? { instructions: buildResponsesInstructions(messages) } : {}),
      model,
      ...(responseTools.length ? { parallel_tool_calls: false } : {}),
      ...(stream ? { stream: true } : {}),
      tools: responseTools
    },
    extraBody
  );
}

function buildResponsesInstructions(messages: ChatMessage[]) {
  return messages
    .filter((message) => message.role === "system")
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join("\n\n");
}

function buildResponsesInputMessages(messages: ChatMessage[]): ResponsesInputItem[] {
  return messages
    .filter((message) => message.role !== "system")
    .flatMap((message) => buildResponsesInputMessage(message));
}

function buildResponsesInputMessage(message: ChatMessage): ResponsesInputItem[] {
  if (message.toolResult) {
    return [
      {
        call_id: responsesToolCallId(message.toolResult.toolCallId),
        output: buildResponsesToolResultOutput(message),
        type: "function_call_output" as const
      }
    ];
  }

  if (message.role === "assistant" && message.toolCalls?.length) {
    return [
      ...(message.content.trim()
        ? [
            {
              content: buildResponsesMessageContent(message),
              role: message.role,
              type: "message" as const
            }
          ]
        : []),
      ...message.toolCalls.map((toolCall) => ({
        arguments: JSON.stringify(toolCall.arguments),
        call_id: responsesToolCallId(toolCall.id),
        id: responsesToolItemId(toolCall.id),
        name: toolCall.name,
        type: "function_call" as const
      }))
    ];
  }

  return [
    {
      content: buildResponsesMessageContent(message),
      role: message.role,
      type: "message"
    }
  ];
}

function buildResponsesMessageContent(message: ChatMessage): ResponsesMessageContent {
  if (message.role === "assistant" && !message.images?.length) {
    return [{ text: message.content, type: "output_text" as const }];
  }

  return [
    { text: message.content, type: "input_text" as const },
    ...(message.images ?? []).map((image) => ({
      image_url: image.dataUrl,
      type: "input_image" as const
    }))
  ];
}

function buildResponsesToolResultOutput(message: ChatMessage): ResponsesToolResultOutput {
  const outputText = message.toolResult?.outputText ?? "";
  if (!message.images?.length) return outputText;

  return [
    ...(outputText ? [{ text: outputText, type: "input_text" as const }] : []),
    ...message.images.map((image) => ({
      image_url: image.dataUrl,
      type: "input_image" as const
    }))
  ];
}

function responsesToolCallId(toolCallId: string) {
  return toolCallId.split("|")[0] ?? toolCallId;
}

function responsesToolItemId(toolCallId: string) {
  const [, itemId] = toolCallId.split("|");
  return itemId ?? toolCallId;
}
