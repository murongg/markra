import { toast } from "sonner";
import { dismissAppToast, showAppToast } from "./app-toast";

vi.mock("sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    success: vi.fn()
  }
}));

const mockedToast = vi.mocked(toast);

describe("appToast", () => {
  beforeEach(() => {
    mockedToast.dismiss.mockReset();
    mockedToast.error.mockReset();
    mockedToast.loading.mockReset();
    mockedToast.success.mockReset();
  });

  it("routes success, loading, error, and dismiss through one shared toast API", () => {
    const action = {
      label: "Restart",
      onClick: vi.fn()
    };

    showAppToast({ message: "Saved", status: "success" });
    showAppToast({ action, id: "update-test", message: "Downloading", status: "loading" });
    showAppToast({ id: "provider-test", message: "Failed", status: "error" });
    showAppToast({ duration: Infinity, id: "update-ready", message: "Ready", status: "success" });
    dismissAppToast("provider-test");

    expect(mockedToast.success).toHaveBeenCalledWith("Saved", {
      duration: 4500,
      id: "app-toast"
    });
    expect(mockedToast.loading).toHaveBeenCalledWith("Downloading", {
      action,
      duration: Infinity,
      id: "update-test"
    });
    expect(mockedToast.error).toHaveBeenCalledWith("Failed", {
      duration: Infinity,
      id: "provider-test"
    });
    expect(mockedToast.success).toHaveBeenCalledWith("Ready", {
      duration: Infinity,
      id: "update-ready"
    });
    expect(mockedToast.dismiss).toHaveBeenCalledWith("provider-test");
  });
});
