import { Channel, invoke } from "@tauri-apps/api/core";

export type NativeAiHttpRequest = {
  headers: Record<string, string>;
  method: "GET";
  url: string;
};

export type NativeAiChatRequest = {
  body: string;
  headers: Record<string, string>;
  url: string;
};

export type NativeAiHttpResponse = {
  body: unknown;
  status: number;
};

export type NativeAiStreamResponse = {
  body?: unknown;
  status: number;
};

type NativeAiChatStreamEvent =
  | {
      chunk: string;
      type: "chunk";
    }
  | {
      status: number;
      type: "done";
    };

export function requestNativeAiJson(request: NativeAiHttpRequest): Promise<NativeAiHttpResponse> {
  return invoke<NativeAiHttpResponse>("request_ai_provider_json", { request });
}

export function requestNativeChat(request: NativeAiChatRequest): Promise<NativeAiHttpResponse> {
  return invoke<NativeAiHttpResponse>("request_native_chat", { request });
}

export async function requestNativeChatStream(
  request: NativeAiChatRequest,
  onChunk: (chunk: string) => unknown
): Promise<NativeAiStreamResponse> {
  const onEvent = new Channel<NativeAiChatStreamEvent>((event) => {
    if (event.type === "chunk") {
      onChunk(event.chunk);
    }
  });
  const response = await invoke<NativeAiStreamResponse>("request_native_chat_stream", { onEvent, request });

  return response;
}
