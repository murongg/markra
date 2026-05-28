import type {
  AppWebResourceRuntime,
  NativeWebResourceRequest,
  NativeWebResourceResponse
} from "@markra/app/runtime";
import type { WebRuntimeOptions } from "./types";

export function createWebResourceRuntime(options: WebRuntimeOptions): AppWebResourceRuntime {
  const fetcher = options.fetch ?? globalThis.fetch;

  return {
    async requestWebResource(request: NativeWebResourceRequest): Promise<NativeWebResourceResponse> {
      const response = await fetcher(request.url, {
        headers: request.headers,
        method: "GET"
      });

      return {
        body: await response.text(),
        contentType: response.headers.get("content-type"),
        finalUrl: response.url || request.url,
        status: response.status
      };
    }
  };
}
