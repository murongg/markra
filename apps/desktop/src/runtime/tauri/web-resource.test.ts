import { invoke } from "@tauri-apps/api/core";
import { getStoredNetworkSettings } from "@markra/app/settings";
import { requestNativeWebResource } from "./web-resource";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

vi.mock("@markra/app/settings", () => ({
  getStoredNetworkSettings: vi.fn()
}));

const mockedInvoke = vi.mocked(invoke);
const mockedGetStoredNetworkSettings = vi.mocked(getStoredNetworkSettings);

describe("native web resource runtime", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
    mockedGetStoredNetworkSettings.mockReset();
    mockedGetStoredNetworkSettings.mockResolvedValue({
      bypassLocalAddresses: true,
      proxyEnabled: true,
      proxyUrl: "socks5://127.0.0.1:1080"
    });
  });

  it("passes app network proxy settings to native web resource requests", async () => {
    mockedInvoke.mockResolvedValue({
      body: "<html></html>",
      finalUrl: "https://example.test",
      status: 200
    });

    await requestNativeWebResource({
      headers: { accept: "text/html" },
      url: "https://example.test"
    });

    expect(mockedInvoke).toHaveBeenCalledWith("request_web_resource", {
      request: {
        headers: { accept: "text/html" },
        network: {
          bypassLocalAddresses: true,
          proxyEnabled: true,
          proxyUrl: "socks5://127.0.0.1:1080"
        },
        url: "https://example.test"
      }
    });
  });
});
