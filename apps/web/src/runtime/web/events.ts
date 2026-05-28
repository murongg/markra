import type { AppEventsRuntime } from "@markra/app/runtime";

function createCustomEvent<TPayload>(event: string, payload: TPayload) {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(event, { detail: payload });
  }

  const customEvent = new Event(event) as Event & { detail: TPayload };
  customEvent.detail = payload;

  return customEvent;
}

export function createBrowserEventsRuntime(eventTarget: EventTarget = new EventTarget()): AppEventsRuntime {
  return {
    async emit<TPayload>(event: string, payload: TPayload) {
      eventTarget.dispatchEvent(createCustomEvent(event, payload));
    },
    isAvailable: () => true,
    async listen<TPayload>(event: string, handler: (event: { payload: TPayload }) => unknown) {
      const listener = (browserEvent: Event) => {
        handler({ payload: (browserEvent as CustomEvent<TPayload>).detail });
      };

      eventTarget.addEventListener(event, listener);

      return () => {
        eventTarget.removeEventListener(event, listener);
      };
    }
  };
}
