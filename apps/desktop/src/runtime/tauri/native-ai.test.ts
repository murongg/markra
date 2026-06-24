import { invoke } from "@tauri-apps/api/core";
import { getStoredNetworkSettings } from "@markra/app/settings";
import {
  requestNativeAiJson,
  requestNativeChat,
  requestNativeChatStream
} from "./native-ai";

vi.mock("@tauri-apps/api/core", () => ({
  Channel: vi.fn().mockImplementation(function Channel(callback: unknown) {
    return { callback };
  }),
  invoke: vi.fn()
}));

vi.mock("@markra/app/settings", () => ({
  getStoredNetworkSettings: vi.fn()
}));

const mockedInvoke = vi.mocked(invoke);
const mockedGetStoredNetworkSettings = vi.mocked(getStoredNetworkSettings);

const network = {
  bypassLocalAddresses: true,
  proxyEnabled: true,
  proxyUrl: "socks5://127.0.0.1:1080"
};

describe("native AI runtime", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedGetStoredNetworkSettings.mockReset();
    mockedGetStoredNetworkSettings.mockResolvedValue(network);
  });

  it("passes app network proxy settings to provider JSON requests", async () => {
    mockedInvoke.mockResolvedValue({ body: { data: [] }, status: 200 });

    await requestNativeAiJson({
      headers: { authorization: "Bearer test" },
      method: "GET",
      url: "https://api.example.test/v1/models"
    });

    expect(mockedInvoke).toHaveBeenCalledWith("request_ai_provider_json", {
      request: {
        headers: { authorization: "Bearer test" },
        method: "GET",
        network,
        url: "https://api.example.test/v1/models"
      }
    });
  });

  it("passes app network proxy settings to chat requests", async () => {
    mockedInvoke.mockResolvedValue({ body: { ok: true }, status: 200 });

    await requestNativeChat({
      body: "{}",
      headers: { "content-type": "application/json" },
      url: "https://api.example.test/v1/chat/completions"
    });

    expect(mockedInvoke).toHaveBeenCalledWith("request_native_chat", {
      request: {
        body: "{}",
        headers: { "content-type": "application/json" },
        network,
        url: "https://api.example.test/v1/chat/completions"
      }
    });
  });

  it("passes app network proxy settings to streaming chat requests", async () => {
    mockedInvoke.mockResolvedValue({ status: 200 });

    await requestNativeChatStream({
      body: "{\"stream\":true}",
      headers: {},
      url: "https://api.example.test/v1/chat/completions"
    }, vi.fn());

    expect(mockedInvoke).toHaveBeenCalledWith("request_native_chat_stream", {
      onEvent: expect.anything(),
      request: {
        body: "{\"stream\":true}",
        headers: {},
        network,
        url: "https://api.example.test/v1/chat/completions"
      }
    });
  });
});
