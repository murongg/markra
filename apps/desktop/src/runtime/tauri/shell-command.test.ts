import { invoke } from "@tauri-apps/api/core";
import {
  getNativeShellCommandStatus,
  installNativeShellCommand,
  uninstallNativeShellCommand
} from "./shell-command";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn()
}));

const mockedInvoke = vi.mocked(invoke);

describe("native shell command", () => {
  beforeEach(() => {
    mockedInvoke.mockReset();
  });

  it("reads the shell command status from Tauri", async () => {
    mockedInvoke.mockResolvedValue({
      commandPath: "/mock-bin/markra",
      targetPath: "/Applications/Markra.app/Contents/MacOS/markra",
      status: "installed"
    });

    await expect(getNativeShellCommandStatus()).resolves.toEqual({
      commandPath: "/mock-bin/markra",
      targetPath: "/Applications/Markra.app/Contents/MacOS/markra",
      status: "installed"
    });

    expect(mockedInvoke).toHaveBeenCalledWith("get_shell_command_status");
  });

  it("installs and uninstalls the shell command through Tauri", async () => {
    mockedInvoke
      .mockResolvedValueOnce({
        commandPath: "/mock-bin/markra",
        targetPath: "/Applications/Markra.app/Contents/MacOS/markra",
        status: "installed"
      })
      .mockResolvedValueOnce({
        commandPath: "/mock-bin/markra",
        targetPath: "/Applications/Markra.app/Contents/MacOS/markra",
        status: "missing"
      });

    await expect(installNativeShellCommand()).resolves.toMatchObject({ status: "installed" });
    await expect(uninstallNativeShellCommand()).resolves.toMatchObject({ status: "missing" });

    expect(mockedInvoke).toHaveBeenNthCalledWith(1, "install_shell_command");
    expect(mockedInvoke).toHaveBeenNthCalledWith(2, "uninstall_shell_command");
  });
});
