import { FakeIndexedDbFactory } from "../../test/web-runtime-fakes";
import { createWebRuntime } from "..";

describe("web resource runtime", () => {
  it("uses fetch for web resource requests", async () => {
    const fetch = vi.fn(async () => new Response("<main>Page</main>", {
      headers: { "content-type": "text/html" },
      status: 202
    }));
    const runtime = createWebRuntime({
      fetch,
      indexedDB: new FakeIndexedDbFactory().indexedDB
    });

    await expect(runtime.webResource.requestWebResource({
      url: "https://example.test/page"
    })).resolves.toEqual({
      body: "<main>Page</main>",
      contentType: "text/html",
      finalUrl: "https://example.test/page",
      status: 202
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
