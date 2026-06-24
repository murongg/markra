import { invoke } from "@tauri-apps/api/core";
import { networkSettingsForNativeRequest, type NativeNetworkSettings } from "./network";

export type NativeWebResourceRequest = {
  allowLocalhost?: boolean;
  headers?: Record<string, string>;
  network?: NativeNetworkSettings;
  url: string;
};

export type NativeWebResourceResponse = {
  body: string;
  contentType?: string | null;
  finalUrl: string;
  status: number;
};

export async function requestNativeWebResource(request: NativeWebResourceRequest): Promise<NativeWebResourceResponse> {
  const network = await networkSettingsForNativeRequest();

  return invoke<NativeWebResourceResponse>("request_web_resource", {
    request: network ? { ...request, network } : request
  });
}
