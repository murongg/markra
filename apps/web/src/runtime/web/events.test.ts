import { createBrowserEventsRuntime } from "./events";

describe("browser events runtime", () => {
  it("emits runtime events through a browser event target", async () => {
    const events = createBrowserEventsRuntime(new EventTarget());
    const handler = vi.fn();

    const cleanup = await events.listen("markra://test", handler);

    expect(events.isAvailable()).toBe(true);

    await events.emit("markra://test", { value: 42 });

    expect(handler).toHaveBeenCalledWith({ payload: { value: 42 } });

    cleanup();
    await events.emit("markra://test", { value: 43 });

    expect(handler).toHaveBeenCalledTimes(1);
  });
});
