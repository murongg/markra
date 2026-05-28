import { render, screen } from "@testing-library/react";
import { AiProviderDetailHeader } from "./AiProviderDetailHeader";
import type { AiProviderConfig } from "@markra/providers";
import type { I18nKey } from "@markra/shared";

function translate(key: I18nKey) {
  const labels: Partial<Record<string, string>> = {
    "settings.ai.apiStyleAnthropic": "Anthropic",
    "settings.ai.apiStyleOpenAiCompatible": "OpenAI compatible",
    "settings.ai.apiStyleOpenAiResponses": "OpenAI Responses",
    "settings.ai.configured": "Configured",
    "settings.ai.deleteProvider": "Delete provider",
    "settings.ai.enableProviderLabel": "Enable provider",
    "settings.ai.notConfigured": "Not configured"
  };

  return labels[key] ?? key;
}

function provider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    apiKey: "",
    baseUrl: "https://proxy.example.test/v1",
    defaultModelId: "default",
    enabled: true,
    id: "custom-provider-1",
    models: [],
    name: "Custom Provider",
    type: "openai-compatible",
    ...overrides
  };
}

describe("AiProviderDetailHeader", () => {
  it("hides the API style label for fixed built-in providers", () => {
    render(
      <AiProviderDetailHeader
        isCustomProvider={false}
        provider={provider({
          apiStyle: "openai-compatible",
          id: "groq",
          name: "Groq",
          type: "groq"
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onDeleteProvider={() => {}}
        onToggleEnabled={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Groq" })).toBeInTheDocument();
    expect(screen.queryByText("OpenAI compatible")).not.toBeInTheDocument();
  });

  it("shows the API style label for providers that can edit it", () => {
    render(
      <AiProviderDetailHeader
        isCustomProvider={true}
        provider={provider({
          apiStyle: "anthropic"
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onDeleteProvider={() => {}}
        onToggleEnabled={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Custom Provider" })).toBeInTheDocument();
    expect(screen.getByText("Anthropic")).toBeInTheDocument();
  });

  it("treats providers without API keys as configured", () => {
    render(
      <AiProviderDetailHeader
        isCustomProvider={false}
        provider={provider({
          apiKey: "",
          baseUrl: "http://localhost:11434/v1",
          id: "ollama",
          name: "Ollama",
          type: "ollama"
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onDeleteProvider={() => {}}
        onToggleEnabled={() => {}}
      />
    );

    expect(screen.getByRole("heading", { name: "Ollama" })).toBeInTheDocument();
    expect(screen.getByText("Configured")).toBeInTheDocument();
    expect(screen.queryByText("Not configured")).not.toBeInTheDocument();
  });
});
