import { fireEvent, render, screen } from "@testing-library/react";
import { AiProviderConnectionSection } from "./AiProviderConnectionSection";
import type { AiProviderConfig } from "@markra/providers";
import type { I18nKey } from "@markra/shared";

const jsonEditorModuleState = vi.hoisted(() => ({
  loadCount: 0
}));

vi.mock("./JsonCodeEditor", async () => {
  jsonEditorModuleState.loadCount += 1;
  const React = await import("react");

  return {
    JsonCodeEditor({ label }: { label: string }) {
      return React.createElement("div", { "data-testid": "mock-json-code-editor" }, label);
    }
  };
});

function translate(key: I18nKey) {
  const labels: Partial<Record<string, string>> = {
    "settings.ai.apiAddress": "API URL",
    "settings.ai.apiKey": "API key",
    "settings.ai.apiStyle": "API style",
    "settings.ai.cancelEditModel": "Cancel",
    "settings.ai.configured": "Configured",
    "settings.ai.customHeaders": "Custom headers",
    "settings.ai.customHeadersDescription": "Added to model list and chat requests.",
    "settings.ai.customHeadersEdit": "Edit custom headers",
    "settings.ai.customHeadersJson": "Custom headers JSON",
    "settings.ai.customHeadersInvalidJson": "Enter a valid JSON object.",
    "settings.ai.customHeadersSave": "Save custom headers",
    "settings.ai.localStorageNotice": "API keys are stored locally.",
    "settings.ai.notConfigured": "Not configured",
    "settings.ai.providerName": "Provider name",
    "settings.ai.testApi": "Test API",
    "settings.ai.testingApi": "Testing...",
    "settings.sections.aiProviders": "Providers"
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

describe("AiProviderConnectionSection lazy editor loading", () => {
  it("loads the JSON editor module only after the custom headers dialog opens", async () => {
    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={true}
        provider={provider()}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={() => {}}
      />
    );

    expect(jsonEditorModuleState.loadCount).toBe(0);

    fireEvent.click(screen.getByRole("button", { name: "Edit custom headers" }));

    expect(await screen.findByTestId("mock-json-code-editor")).toHaveTextContent("Custom headers JSON");
    expect(jsonEditorModuleState.loadCount).toBe(1);
  });
});
