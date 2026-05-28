import { getAppRuntime } from "../../runtime";

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
  return getAppRuntime().webResource.requestWebResource(request);
}
