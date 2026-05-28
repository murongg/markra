import { FakeIndexedDbFactory } from "../../test/web-runtime-fakes";
import { createWebRuntime } from "..";

describe("web AI runtime", () => {
  it("uses fetch for AI runtime requests", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first"));
        controller.enqueue(new TextEncoder().encode(" second"));
        controller.close();
      }
    });
    const fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/stream")) {
        return new Response(stream, { status: 201 });
      }

      return Response.json({ ok: true }, { status: 203 });
    });
    const runtime = createWebRuntime({
      fetch,
      indexedDB: new FakeIndexedDbFactory().indexedDB
    });
    const chunks: string[] = [];

    await expect(runtime.ai.requestAiJson({
      headers: { accept: "application/json" },
      method: "GET",
      url: "https://api.example.test/models"
    })).resolves.toEqual({
      body: { ok: true },
      status: 203
    });
    await expect(runtime.ai.requestChat({
      body: "{\"message\":\"hello\"}",
      headers: { "content-type": "application/json" },
      url: "https://api.example.test/chat"
    })).resolves.toEqual({
      body: { ok: true },
      status: 203
    });
    await expect(runtime.ai.requestChatStream({
      body: "{}",
      headers: {},
      url: "https://api.example.test/stream"
    }, (chunk) => {
      chunks.push(chunk);
    })).resolves.toEqual({ status: 201 });

    expect(chunks).toEqual(["first", " second"]);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
