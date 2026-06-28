import { renderHook, waitFor } from "@testing-library/react";
import {
  defaultAcpAgentSettings,
  getStoredAcpAgentSettings,
  type AcpAgentSettings
} from "../lib/settings/app-settings";
import { listenAppAcpAgentSettingsChanged } from "../lib/settings/settings-events";
import { useAcpAgentSettings } from "./useAcpAgentSettings";

vi.mock("../lib/settings/app-settings", () => ({
  defaultAcpAgentSettings: {
    args: "",
    command: "",
    cwd: "",
    enabled: false
  },
  getStoredAcpAgentSettings: vi.fn()
}));

vi.mock("../lib/settings/settings-events", () => ({
  listenAppAcpAgentSettingsChanged: vi.fn()
}));

const mockedGetStoredAcpAgentSettings = vi.mocked(getStoredAcpAgentSettings);
const mockedListenAppAcpAgentSettingsChanged = vi.mocked(listenAppAcpAgentSettingsChanged);

describe("useAcpAgentSettings", () => {
  beforeEach(() => {
    mockedGetStoredAcpAgentSettings.mockReset();
    mockedListenAppAcpAgentSettingsChanged.mockReset();
    mockedListenAppAcpAgentSettingsChanged.mockResolvedValue(() => {});
  });

  it("loads stored ACP agent settings and derives display state", async () => {
    mockedGetStoredAcpAgentSettings.mockResolvedValue({
      args: "-lc 'exec npx -y @agentclientprotocol/codex-acp'",
      command: "/bin/zsh",
      cwd: "",
      enabled: true
    });

    const { result } = renderHook(() => useAcpAgentSettings());

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.configured).toBe(true);
    expect(result.current.displayName).toBe("Codex ACP");
  });

  it("uses live ACP setting updates over the initial stored value", async () => {
    let handleSettingsChanged: (settings: AcpAgentSettings) => unknown = () => {};
    mockedGetStoredAcpAgentSettings.mockResolvedValue(defaultAcpAgentSettings);
    mockedListenAppAcpAgentSettingsChanged.mockImplementation(async (listener) => {
      handleSettingsChanged = listener;

      return () => {};
    });

    const { result } = renderHook(() => useAcpAgentSettings());

    handleSettingsChanged?.({
      args: "--stdio",
      command: "synthetic-acp-agent",
      cwd: "",
      enabled: true
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.configured).toBe(true);
    expect(result.current.displayName).toBe("synthetic-acp-agent");
  });
});
