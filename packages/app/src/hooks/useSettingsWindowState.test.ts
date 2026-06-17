import { describe, expect, it } from "vitest";
import { shellCommandActionFailureMessage } from "./useSettingsWindowState";

describe("settings window shell command errors", () => {
  it("includes native shell command failure details when available", () => {
    expect(shellCommandActionFailureMessage("Could not update the markra command.", "Registry write failed")).toBe(
      "Could not update the markra command. Registry write failed"
    );
    expect(shellCommandActionFailureMessage("Could not update the markra command.", new Error("Access denied"))).toBe(
      "Could not update the markra command. Access denied"
    );
  });

  it("falls back to the generic shell command error", () => {
    expect(shellCommandActionFailureMessage("Could not update the markra command.", "")).toBe(
      "Could not update the markra command."
    );
  });
});
