import { render } from "@testing-library/react";
import { useDefaultContextMenuBlocker } from "./useDefaultContextMenuBlocker";

function ContextMenuHarness({ enabled }: { enabled: boolean }) {
  useDefaultContextMenuBlocker(enabled);

  return <div data-testid="context-target" />;
}

function dispatchContextMenu(target: EventTarget) {
  const event = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true
  });

  target.dispatchEvent(event);

  return event;
}

describe("useDefaultContextMenuBlocker", () => {
  it("prevents the browser default context menu when enabled", () => {
    const { getByTestId } = render(<ContextMenuHarness enabled />);

    const event = dispatchContextMenu(getByTestId("context-target"));

    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves context menus alone when disabled", () => {
    const { getByTestId } = render(<ContextMenuHarness enabled={false} />);

    const event = dispatchContextMenu(getByTestId("context-target"));

    expect(event.defaultPrevented).toBe(false);
  });
});
