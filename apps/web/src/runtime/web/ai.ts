import type {
  AppAiRuntime,
  NativeAiChatRequest,
  NativeAiHttpRequest,
  NativeAiHttpResponse,
  NativeAiStreamResponse
} from "@markra/app/runtime";
import type { WebRuntimeOptions } from "./types";

async function responseBody(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json() as Promise<unknown>;
  }

  return response.text();
}

export function createWebAiRuntime(options: WebRuntimeOptions): AppAiRuntime {
  const fetcher = options.fetch ?? globalThis.fetch;

  async function requestJsonResponse(response: Response): Promise<NativeAiHttpResponse> {
    return {
      body: await responseBody(response),
      status: response.status
    };
  }

  return {
    async requestAiJson(request: NativeAiHttpRequest): Promise<NativeAiHttpResponse> {
      const response = await fetcher(request.url, {
        headers: request.headers,
        method: request.method
      });

      return requestJsonResponse(response);
    },
    async requestChat(request: NativeAiChatRequest): Promise<NativeAiHttpResponse> {
      const response = await fetcher(request.url, {
        body: request.body,
        headers: request.headers,
        method: "POST"
      });

      return requestJsonResponse(response);
    },
    async requestChatStream(
      request: NativeAiChatRequest,
      onChunk: (chunk: string) => unknown
    ): Promise<NativeAiStreamResponse> {
      const response = await fetcher(request.url, {
        body: request.body,
        headers: request.headers,
        method: "POST"
      });
      if (!response.body) {
        return {
          body: await responseBody(response),
          status: response.status
        };
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let reading = true;

      while (reading) {
        const result = await reader.read();
        reading = !result.done;
        if (result.value) {
          onChunk(decoder.decode(result.value, { stream: reading }));
        }
      }

      return {
        status: response.status
      };
    }
  };
}
