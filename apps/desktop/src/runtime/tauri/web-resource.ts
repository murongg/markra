import { invoke } from "@tauri-apps/api/core";

export type NativeWebResourceRequest = {
  allowLocalhost?: boolean;
  headers?: Record<string, string>;
  url: string;
};

export type NativeWebResourceResponse = {
  body: string;
  contentType?: string | null;
  finalUrl: string;
  status: number;
};

export function requestNativeWebResource(request: NativeWebResourceRequest): Promise<NativeWebResourceResponse> {
  return invoke<NativeWebResourceResponse>("request_web_resource", { request });
}
