import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { EditorView } from "@codemirror/view";
import { AiProviderConnectionSection } from "./AiProviderConnectionSection";
import type { AiProviderConfig } from "@markra/providers";
import type { I18nKey } from "@markra/shared";

function translate(key: I18nKey) {
  const labels: Partial<Record<string, string>> = {
    "settings.ai.apiAddress": "API URL",
    "settings.ai.apiKey": "API key",
    "settings.ai.apiStyle": "API style",
    "settings.ai.apiStyleOpenAiCompatible": "OpenAI compatible",
    "settings.ai.cancelEditModel": "Cancel",
    "settings.ai.customHeaders": "Custom headers",
    "settings.ai.customHeadersDescription": "Added to model list and chat requests.",
    "settings.ai.customHeadersEdit": "Edit custom headers",
    "settings.ai.customHeadersJson": "Custom headers JSON",
    "settings.ai.customHeadersInvalidJson": "Enter a valid JSON object.",
    "settings.ai.customHeadersSave": "Save custom headers",
    "settings.ai.localStorageNotice": "API keys are stored locally.",
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

function getCodeMirrorView(container: HTMLElement) {
  const view = EditorView.findFromDOM(container);

  if (!view) {
    throw new Error("Expected the custom headers JSON editor to use CodeMirror.");
  }

  return view;
}

function replaceCodeMirrorDoc(view: EditorView, value: string) {
  act(() => {
    view.dispatch({
      changes: {
        from: 0,
        insert: value,
        to: view.state.doc.length
      }
    });
  });
}

describe("AiProviderConnectionSection", () => {
  it("lets OpenAI choose the supported OpenAI request styles", () => {
    const updateSelectedProvider = vi.fn();

    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={false}
        provider={provider({
          apiStyle: "openai-responses",
          id: "openai",
          name: "OpenAI",
          type: "openai"
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={updateSelectedProvider}
      />
    );

    const apiStyleSelect = screen.getByLabelText("API style");
    expect(within(apiStyleSelect).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "OpenAI Responses",
      "OpenAI compatible"
    ]);

    fireEvent.change(apiStyleSelect, { target: { value: "openai-compatible" } });

    expect(updateSelectedProvider).toHaveBeenCalledWith(expect.any(Function));
    const updater = updateSelectedProvider.mock.calls.at(-1)?.[0] as (current: AiProviderConfig) => AiProviderConfig;
    expect(updater(provider({ apiStyle: "openai-responses", type: "openai" } as Partial<AiProviderConfig>))).toMatchObject({
      apiStyle: "openai-compatible",
      type: "openai"
    });
  });

  it("hides API style for fixed built-in providers", () => {
    const updateSelectedProvider = vi.fn();

    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={false}
        provider={provider({
          apiStyle: "openai-compatible",
          id: "groq",
          name: "Groq",
          type: "groq"
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={updateSelectedProvider}
      />
    );

    expect(screen.queryByRole("combobox", { name: "API style" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("API style")).not.toBeInTheDocument();
    expect(screen.queryByText("API style")).not.toBeInTheDocument();
    expect(screen.queryByText("OpenAI compatible")).not.toBeInTheDocument();
  });

  it("hides API key settings for providers that do not need keys", () => {
    const updateSelectedProvider = vi.fn();

    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={false}
        provider={provider({
          apiKey: "",
          baseUrl: "http://localhost:11434/v1",
          id: "ollama",
          name: "Ollama",
          type: "ollama"
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={updateSelectedProvider}
      />
    );

    expect(screen.queryByLabelText("API key")).not.toBeInTheDocument();
    expect(screen.queryByText("API keys are stored locally.")).not.toBeInTheDocument();
    expect(screen.getByLabelText("API URL")).toHaveValue("http://localhost:11434/v1");
  });

  it("lets custom providers choose any supported API style", () => {
    const updateSelectedProvider = vi.fn();

    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={true}
        provider={provider()}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={updateSelectedProvider}
      />
    );

    const apiStyleSelect = screen.getByLabelText("API style");
    expect(within(apiStyleSelect).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "OpenAI Responses",
      "OpenAI compatible",
      "Anthropic",
      "Google (Gemini)"
    ]);

    fireEvent.change(apiStyleSelect, { target: { value: "anthropic" } });

    expect(updateSelectedProvider).toHaveBeenCalledWith(expect.any(Function));
    const updater = updateSelectedProvider.mock.calls.at(-1)?.[0] as (current: AiProviderConfig) => AiProviderConfig;
    expect(updater(provider())).toMatchObject({
      apiStyle: "anthropic",
      baseUrl: "https://proxy.example.test/v1"
    });
    expect(updater(provider({ baseUrl: "" }))).toMatchObject({
      apiStyle: "anthropic",
      baseUrl: "https://api.anthropic.com/v1"
    });
  });

  it("lets custom providers configure request headers without exposing thinking request body settings", async () => {
    const updateSelectedProvider = vi.fn();

    render(
      <AiProviderConnectionSection
        actionState={{ status: "idle" }}
        isCustomProvider={true}
        provider={provider({
          customHeaders: '{"HTTP-Referer":"https://markra.app"}'
        } as Partial<AiProviderConfig>)}
        translate={translate}
        onTestProvider={() => {}}
        updateSelectedProvider={updateSelectedProvider}
      />
    );

    expect(screen.queryByLabelText("Custom headers JSON")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Edit custom headers" }));

    const dialog = screen.getByRole("dialog", { name: "Custom headers" });
    const editorShell = await within(dialog).findByTestId("json-code-editor");
    const jsonEditor = await within(dialog).findByRole("textbox", { name: "Custom headers JSON" });
    const editorView = getCodeMirrorView(editorShell);
    expect(editorShell).toHaveAttribute("data-language", "json");
    expect(jsonEditor.tagName).not.toBe("TEXTAREA");
    expect(editorView.state.doc.toString()).toBe('{"HTTP-Referer":"https://markra.app"}');
    expect(screen.queryByLabelText("Deep thinking request body")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("settings.ai.thinkingRequestMode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Custom request body JSON")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("settings.ai.thinkingRequestBody")).not.toBeInTheDocument();

    replaceCodeMirrorDoc(editorView, "{bad");
    fireEvent.click(within(dialog).getByRole("button", { name: "Save custom headers" }));
    expect(within(dialog).getByText("Enter a valid JSON object.")).toBeInTheDocument();
    expect(updateSelectedProvider).not.toHaveBeenCalled();

    replaceCodeMirrorDoc(editorView, '{"X-Title":"Markra"}');
    fireEvent.click(within(dialog).getByRole("button", { name: "Save custom headers" }));
    expect(updateSelectedProvider).toHaveBeenCalledWith(expect.any(Function));
    const headerUpdater = updateSelectedProvider.mock.calls.at(-1)?.[0] as (current: AiProviderConfig) => AiProviderConfig;

    expect(headerUpdater(provider())).toMatchObject({
      customHeaders: '{"X-Title":"Markra"}'
    });
    expect(screen.queryByRole("dialog", { name: "Custom headers" })).not.toBeInTheDocument();
  });
});
