import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const desktopRoot = process.cwd();
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

describe("desktop app package integration", () => {
  it("renders the frontend from @markra/app", () => {
    const entry = readFileSync(resolve(desktopRoot, "src/main.tsx"), "utf8");

    expect(entry).toContain('from "@markra/app"');
    expect(entry).not.toContain('from "./App"');
  });

  it("configures the desktop runtime before rendering the shared app", () => {
    const entry = readFileSync(resolve(desktopRoot, "src/main.tsx"), "utf8");

    expect(entry).toContain("configureAppRuntime");
    expect(entry).toContain('from "./runtime"');
  });

  it("keeps Tauri packages out of the shared app package", () => {
    const appPackage = readFileSync(resolve(workspaceRoot, "packages/app/package.json"), "utf8");

    expect(appPackage).not.toContain("@tauri-apps/");
  });
});
