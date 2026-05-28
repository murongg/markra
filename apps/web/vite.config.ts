import { createMarkraAppViteConfig } from "@markra/scripts/vite";

export default createMarkraAppViteConfig({
  browserNodeStubUrl: new URL("../../packages/app/src/lib/browser-node-stub.ts", import.meta.url),
  packageJsonUrl: new URL("./package.json", import.meta.url)
});
