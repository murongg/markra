import type {
  AiAgentProcessItem,
  StoredAiAgentSessionState,
  StoredAiAgentSessionSummary
} from "@markra/ai";
import type { AiProviderConfig } from "@markra/providers";
import type { AiAgentPanelMessage } from "../hooks/useAiAgentSession";

export function testProvider(overrides: Partial<AiProviderConfig> = {}): AiProviderConfig {
  return {
    apiKey: "secret",
    baseUrl: "https://api.openai.com/v1",
    defaultModelId: "gpt-5.5",
    enabled: true,
    id: "openai",
    models: [],
    name: "OpenAI",
    type: "openai",
    ...overrides
  };
}

export function storedAgentSession(overrides: Partial<StoredAiAgentSessionState> = {}): StoredAiAgentSessionState {
  return {
    agentModelId: null,
    agentProviderId: null,
    draft: "",
    messages: [],
    panelOpen: false,
    panelWidth: null,
    thinkingEnabled: false,
    webSearchEnabled: false,
    ...overrides
  };
}

export function agentSessionSummary(
  overrides: Partial<StoredAiAgentSessionSummary> = {}
): StoredAiAgentSessionSummary {
  return {
    archivedAt: null,
    createdAt: 1,
    id: "session-a",
    messageCount: 1,
    title: "New session",
    titleSource: "manual",
    updatedAt: 10,
    workspaceKey: "/vault",
    ...overrides
  };
}

export function assistantMessage(overrides: Partial<AiAgentPanelMessage> = {}): AiAgentPanelMessage {
  return {
    id: 1,
    role: "assistant",
    text: "Ready.",
    ...overrides
  };
}

export function processActivity(overrides: Partial<AiAgentProcessItem> = {}): AiAgentProcessItem {
  return {
    id: "tool:1",
    kind: "tool_call",
    label: "Read current document",
    status: "completed",
    turn: 1,
    ...overrides
  };
}
