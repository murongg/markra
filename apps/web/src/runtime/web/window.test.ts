import { FakeIndexedDbFactory } from "../../test/web-runtime-fakes";
import { createWebRuntime } from "..";

describe("web window runtime", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.pushState({}, "", "/");
  });

  it("uses browser window APIs for shell actions", async () => {
    const open = vi.fn();
    const runtime = createWebRuntime({
      indexedDB: new FakeIndexedDbFactory().indexedDB,
      openExternalUrl: open
    });

    await runtime.window.openExternalUrl("https://example.test");
    await runtime.window.setWindowTitle("Markra Web");

    expect(open).toHaveBeenCalledWith("https://example.test");
    expect(document.title).toBe("Markra Web");
  });

  it("opens settings in the current browser route without opening another page", async () => {
    const openedWindow = { focus: vi.fn() } as unknown as Window;
    const open = vi.spyOn(window, "open").mockReturnValue(openedWindow);
    const runtime = createWebRuntime({
      indexedDB: new FakeIndexedDbFactory().indexedDB
    });
    window.history.pushState({}, "", "/workspace?file=note.md");

    await runtime.window.openSettingsWindow("exportPandocPath");

    const params = new URLSearchParams(window.location.search);
    expect(open).not.toHaveBeenCalled();
    expect(openedWindow.focus).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/workspace");
    expect(params.get("file")).toBe("note.md");
    expect(params.get("settings")).toBe("1");
    expect(params.get("settingsTarget")).toBe("exportPandocPath");
  });

  it("notifies settings target listeners after opening settings in the current route", async () => {
    const runtime = createWebRuntime({
      indexedDB: new FakeIndexedDbFactory().indexedDB
    });
    const onTarget = vi.fn();
    const onRouteChange = vi.fn();
    const cleanup = await runtime.window.listenSettingsWindowTarget(onTarget);
    window.history.pushState({}, "", "/workspace?file=note.md");
    window.addEventListener("popstate", onRouteChange);

    await runtime.window.openSettingsWindow("exportPandocPath");

    const params = new URLSearchParams(window.location.search);
    expect(window.location.pathname).toBe("/workspace");
    expect(params.get("file")).toBe("note.md");
    expect(params.get("settings")).toBe("1");
    expect(params.get("settingsTarget")).toBe("exportPandocPath");
    expect(onRouteChange).toHaveBeenCalledTimes(1);
    expect(onTarget).toHaveBeenCalledTimes(1);
    expect(onTarget).toHaveBeenCalledWith("exportPandocPath");

    cleanup();
    window.removeEventListener("popstate", onRouteChange);
  });

  it("closes the web settings route back to the editor route when the browser keeps the window open", async () => {
    const close = vi.spyOn(window, "close").mockImplementation(() => {});
    const runtime = createWebRuntime({
      indexedDB: new FakeIndexedDbFactory().indexedDB
    });
    const onRouteChange = vi.fn();
    window.history.pushState({}, "", "/workspace?file=note.md&settings=1&settingsTarget=exportPandocPath");
    window.addEventListener("popstate", onRouteChange);

    await runtime.window.closeWindow();

    const params = new URLSearchParams(window.location.search);
    expect(close).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe("/workspace");
    expect(params.get("file")).toBe("note.md");
    expect(params.has("settings")).toBe(false);
    expect(params.has("settingsTarget")).toBe(false);
    expect(onRouteChange).toHaveBeenCalledTimes(1);

    window.removeEventListener("popstate", onRouteChange);
  });
});
