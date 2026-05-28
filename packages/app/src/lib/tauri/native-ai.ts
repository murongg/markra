import { getAppRuntime } from "../../runtime";

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

export function requestNativeAiJson(request: NativeAiHttpRequest): Promise<NativeAiHttpResponse> {
  return getAppRuntime().ai.requestAiJson(request);
}

export function requestNativeChat(request: NativeAiChatRequest): Promise<NativeAiHttpResponse> {
  return getAppRuntime().ai.requestChat(request);
}

export function requestNativeChatStream(
  request: NativeAiChatRequest,
  onChunk: (chunk: string) => unknown
): Promise<NativeAiStreamResponse> {
  return getAppRuntime().ai.requestChatStream(request, onChunk);
}
