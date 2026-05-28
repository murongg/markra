import { confirm, message } from "@tauri-apps/plugin-dialog";
import { confirmNativeAiAgentSessionDelete, showNativePandocSetup } from "./dialog";

vi.mock("@tauri-apps/plugin-dialog", () => ({
  confirm: vi.fn(),
  message: vi.fn()
}));

const mockedConfirm = vi.mocked(confirm);
const mockedMessage = vi.mocked(message);

describe("native dialogs", () => {
  beforeEach(() => {
    mockedConfirm.mockReset();
    mockedMessage.mockReset();
  });

  it("confirms native AI agent session deletion with warning copy", async () => {
    mockedConfirm.mockResolvedValue(true);

    await expect(
      confirmNativeAiAgentSessionDelete("Session", {
        cancelLabel: "Cancel",
        message: "Delete this session?",
        okLabel: "Delete"
      })
    ).resolves.toBe(true);

    expect(mockedConfirm).toHaveBeenCalledWith("Delete this session?", {
      cancelLabel: "Cancel",
      kind: "warning",
      okLabel: "Delete",
      title: "Session"
    });
  });

  it("maps the native Pandoc setup dialog buttons to app actions", async () => {
    mockedMessage.mockResolvedValueOnce("Install Pandoc").mockResolvedValueOnce("Set Pandoc path").mockResolvedValueOnce("Cancel");

    const labels = {
      cancelLabel: "Cancel",
      installLabel: "Install Pandoc",
      message: "Install Pandoc to continue exporting.",
      setPathLabel: "Set Pandoc path",
      title: "Pandoc required"
    };

    await expect(showNativePandocSetup(labels)).resolves.toBe("install");
    await expect(showNativePandocSetup(labels)).resolves.toBe("setPath");
    await expect(showNativePandocSetup(labels)).resolves.toBe("cancel");

    expect(mockedMessage).toHaveBeenCalledWith("Install Pandoc to continue exporting.", {
      buttons: {
        cancel: "Cancel",
        no: "Set Pandoc path",
        yes: "Install Pandoc"
      },
      kind: "warning",
      title: "Pandoc required"
    });
  });
});
