import { describe, expect, it } from "vitest";
import { stripDebugStatements } from "./strip-debug";

describe("stripDebugStatements", () => {
  it("removes standalone debug calls from TypeScript source", () => {
    const source = [
      'import { debug } from "./index";',
      "",
      "const value = 1;",
      'debug(() => ["[markra] first", { value }]);',
      "const next = value + 1;",
      'debug(() => ["[markra] second"]);',
      "export { next };"
    ].join("\n");

    expect(stripDebugStatements(source, "/synthetic/example.ts")).toBe([
      'import { debug } from "./index";',
      "",
      "const value = 1;",
      "const next = value + 1;",
      "export { next };"
    ].join("\n"));
  });

  it("keeps non-debug calls intact", () => {
    const source = [
      'import { debug } from "./index";',
      "",
      "trackEvent();",
      "renderPanel(debug);"
    ].join("\n");

    expect(stripDebugStatements(source, "/synthetic/example.ts")).toBe(source);
  });
});
