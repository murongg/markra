import { afterEach, describe, expect, it } from "vitest";
import { configureAppRuntime, createDefaultAppRuntime, resetAppRuntimeForTests } from "../runtime";
import { resolveDesktopPlatform } from "./platform";

const originalNavigatorPlatform = navigator.platform;

function setNavigatorPlatform(platform: string) {
  Object.defineProperty(navigator, "platform", {
    configurable: true,
    value: platform
  });
}

describe("resolveDesktopPlatform", () => {
  afterEach(() => {
    resetAppRuntimeForTests();
    setNavigatorPlatform(originalNavigatorPlatform);
  });

  it("uses the configured runtime platform when available", () => {
    configureAppRuntime({
      ...createDefaultAppRuntime(),
      platform: {
        resolveDesktopPlatform: () => "windows"
      }
    });

    expect(resolveDesktopPlatform()).toBe("windows");
  });

  it("falls back to the browser platform when the runtime platform is unavailable", () => {
    configureAppRuntime({
      ...createDefaultAppRuntime(),
      platform: {
        resolveDesktopPlatform: () => null
      }
    });
    setNavigatorPlatform("MacIntel");

    expect(resolveDesktopPlatform()).toBe("macos");
  });
});
