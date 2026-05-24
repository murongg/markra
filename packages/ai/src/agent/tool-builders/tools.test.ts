import type { Tool } from "@earendil-works/pi-ai";
import type { AiProviderConfig } from "@markra/providers";
import { buildAnthropicTools } from "./anthropic";
import { buildGoogleTools } from "./google";
import { buildOpenAiCompatibleFunctionTools, buildResponsesStyleTools } from "./openai-compatible";

const readDocumentTool = {
  description: "Read the document.",
  name: "read_document",
  parameters: {
    additionalProperties: false,
    properties: {},
    type: "object"
  }
} as Tool;

function provider(overrides: Partial<AiProviderConfig>): AiProviderConfig {
  return {
    apiKey: "secret",
    baseUrl: "",
    defaultModelId: "model",
    enabled: true,
    id: "provider",
    models: [],
    name: "Provider",
    type: "openai-compatible",
    ...overrides
  };
}

describe("tool builders", () => {
  it("builds OpenAI-compatible function tool payloads", () => {
    expect(buildOpenAiCompatibleFunctionTools([readDocumentTool])).toEqual([
      {
        function: {
          description: "Read the document.",
          name: "read_document",
          parameters: readDocumentTool.parameters
        },
        type: "function"
      }
    ]);
  });

  it("builds Responses API tools with native web search first", () => {
    expect(buildResponsesStyleTools("web_search", [readDocumentTool])).toEqual([
      { type: "web_search" },
      {
        description: "Read the document.",
        name: "read_document",
        parameters: readDocumentTool.parameters,
        type: "function"
      }
    ]);
  });

  it("builds Anthropic tools with native web search when enabled", () => {
    expect(buildAnthropicTools(
      provider({
        models: [{ capabilities: ["text", "web"], enabled: true, id: "claude-opus-4-7", name: "Claude Opus 4.7" }],
        type: "anthropic"
      }),
      "claude-opus-4-7",
      true,
      [readDocumentTool]
    )).toEqual([
      { max_uses: 5, name: "web_search", type: "web_search_20250305" },
      {
        description: "Read the document.",
        input_schema: readDocumentTool.parameters,
        name: "read_document"
      }
    ]);
  });

  it("builds Google native search tools only for grounding-capable models", () => {
    expect(buildGoogleTools(
      provider({
        baseUrl: "https://generativelanguage.googleapis.com/v1beta",
        models: [{ capabilities: ["text", "web"], enabled: true, id: "gemini-3.1-pro-preview", name: "Gemini" }],
        type: "google"
      }),
      "gemini-3.1-pro-preview",
      true
    )).toEqual([{ google_search: {} }]);
    expect(buildGoogleTools(
      provider({
        baseUrl: "https://proxy.example.test/v1",
        models: [{ capabilities: ["text"], enabled: true, id: "writer-model", name: "Writer" }],
        type: "openai-compatible"
      }),
      "writer-model",
      true
    )).toEqual([]);
  });
});
