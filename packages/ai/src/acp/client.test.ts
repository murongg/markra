import {
  AcpClient,
  AcpResponseError,
  extractAcpModelConfig,
  isAcpAuthRequiredError,
  type AcpClientTransport,
  type AcpJsonRpcMessage
} from "./client";

function createTransport() {
  const sent: AcpJsonRpcMessage[] = [];
  const handlers = new Set<(message: AcpJsonRpcMessage) => unknown>();
  const transport: AcpClientTransport = {
    send: (message) => {
      sent.push(message);
    },
    onMessage: (handler) => {
      handlers.add(handler);

      return () => {
        handlers.delete(handler);
      };
    }
  };
  const receive = (message: AcpJsonRpcMessage) => {
    handlers.forEach((handler) => handler(message));
  };
  const reply = (request: AcpJsonRpcMessage, result: unknown) => {
    if (!("id" in request) || request.id === null) throw new Error("Expected a request message.");
    receive({ jsonrpc: "2.0", id: request.id, result });
  };
  const notify = (method: string, params: unknown) => {
    receive({ jsonrpc: "2.0", method, params });
  };

  return { notify, receive, reply, sent, transport };
}

function lastRequest(sent: AcpJsonRpcMessage[]) {
  const request = sent.at(-1);
  if (!request || !("method" in request) || !("id" in request)) {
    throw new Error("Expected a JSON-RPC request.");
  }

  return request;
}

describe("ACP client", () => {
  it("initializes, creates a session, streams prompt updates, and resolves the prompt stop reason", async () => {
    const { notify, reply, sent, transport } = createTransport();
    const client = new AcpClient({ transport });
    const updates: unknown[] = [];

    client.subscribe((update) => updates.push(update));

    const initialize = client.initialize({ name: "markra", title: "Markra", version: "0.0.0-test" });
    expect(lastRequest(sent)).toMatchObject({
      method: "initialize",
      params: {
        clientCapabilities: {
          fs: {
            readTextFile: false,
            writeTextFile: false
          },
          terminal: false
        },
        protocolVersion: 1
      }
    });
    reply(lastRequest(sent), {
      agentCapabilities: {
        promptCapabilities: {
          embeddedContext: true
        }
      },
      protocolVersion: 1
    });
    await expect(initialize).resolves.toMatchObject({ protocolVersion: 1 });

    const session = client.createSession({ cwd: "/mock-vault" });
    expect(lastRequest(sent)).toMatchObject({
      method: "session/new",
      params: {
        cwd: "/mock-vault",
        mcpServers: []
      }
    });
    reply(lastRequest(sent), { sessionId: "session-1" });
    await expect(session).resolves.toEqual({ sessionId: "session-1" });

    const prompt = client.prompt({
      prompt: [{ text: "Summarize this synthetic note.", type: "text" }],
      sessionId: "session-1"
    });
    const promptRequest = lastRequest(sent);
    expect(promptRequest).toMatchObject({
      method: "session/prompt",
      params: {
        prompt: [{ text: "Summarize this synthetic note.", type: "text" }],
        sessionId: "session-1"
      }
    });

    notify("session/update", {
      sessionId: "session-1",
      update: {
        content: { text: "Synthetic summary", type: "text" },
        messageId: "message-1",
        sessionUpdate: "agent_message_chunk"
      }
    });
    notify("session/update", {
      sessionId: "session-1",
      update: {
        kind: "read",
        status: "pending",
        title: "Reading note",
        toolCallId: "tool-1",
        sessionUpdate: "tool_call"
      }
    });
    reply(promptRequest, { stopReason: "end_turn" });

    await expect(prompt).resolves.toEqual({ stopReason: "end_turn" });
    expect(updates).toEqual([
      {
        content: { text: "Synthetic summary", type: "text" },
        messageId: "message-1",
        sessionId: "session-1",
        type: "agent_message_chunk"
      },
      {
        kind: "read",
        status: "pending",
        title: "Reading note",
        toolCallId: "tool-1",
        sessionId: "session-1",
        type: "tool_call"
      }
    ]);
  });

  it("sets session configuration options and returns updated options", async () => {
    const { reply, sent, transport } = createTransport();
    const client = new AcpClient({ transport });

    const updatedOptions = [
      {
        category: "model",
        currentValue: "claude-sonnet-4-6",
        id: "model",
        options: [
          { name: "GPT-5.5", value: "gpt-5.5" },
          { name: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" }
        ],
        type: "select"
      }
    ];
    const response = client.setSessionConfigOption({
      configId: "model",
      sessionId: "session-1",
      value: "claude-sonnet-4-6"
    });

    expect(lastRequest(sent)).toMatchObject({
      method: "session/set_config_option",
      params: {
        configId: "model",
        sessionId: "session-1",
        value: "claude-sonnet-4-6"
      }
    });
    reply(lastRequest(sent), { configOptions: updatedOptions });

    await expect(response).resolves.toEqual({ configOptions: updatedOptions });
  });

  it("authenticates with an advertised ACP auth method", async () => {
    const { reply, sent, transport } = createTransport();
    const client = new AcpClient({ transport });

    const response = client.authenticate("codex-login");

    expect(lastRequest(sent)).toMatchObject({
      method: "authenticate",
      params: {
        methodId: "codex-login"
      }
    });
    reply(lastRequest(sent), {});

    await expect(response).resolves.toEqual({});
  });

  it("includes JSON-RPC error details in rejected requests", async () => {
    const { receive, sent, transport } = createTransport();
    const client = new AcpClient({ transport });
    const session = client.createSession({ cwd: "/mock-vault" });

    receive({
      error: {
        code: -32603,
        data: {
          details: "failed to reload config: synthetic setting is invalid"
        },
        message: "Internal error"
      },
      id: lastRequest(sent).id,
      jsonrpc: "2.0"
    } as AcpJsonRpcMessage);

    await expect(session).rejects.toThrow("failed to reload config: synthetic setting is invalid");
  });

  it("keeps ACP auth-required response metadata available to callers", async () => {
    const { receive, sent, transport } = createTransport();
    const client = new AcpClient({ transport });
    const session = client.createSession({ cwd: "/mock-vault" });

    receive({
      error: {
        code: -32000,
        message: "Authentication required"
      },
      id: lastRequest(sent).id,
      jsonrpc: "2.0"
    } as AcpJsonRpcMessage);

    await expect(session).rejects.toBeInstanceOf(AcpResponseError);
    await expect(session).rejects.toSatisfy((error) => isAcpAuthRequiredError(error));
  });

  it("extracts ACP model selector options from session configuration", () => {
    expect(extractAcpModelConfig([
      {
        category: "thought_level",
        currentValue: "medium",
        id: "thinking",
        options: [{ name: "Medium", value: "medium" }],
        type: "select"
      },
      {
        category: "model",
        currentValue: "gpt-5.5",
        id: "model",
        options: [
          {
            group: "openai",
            name: "OpenAI",
            options: [
              { description: "Synthetic OpenAI model.", name: "GPT-5.5", value: "gpt-5.5" }
            ]
          },
          {
            group: "anthropic",
            name: "Anthropic",
            options: [
              { name: "Claude Sonnet 4.6", value: "claude-sonnet-4-6" }
            ]
          }
        ],
        type: "select"
      }
    ])).toEqual({
      configId: "model",
      models: [
        {
          description: "Synthetic OpenAI model.",
          id: "gpt-5.5",
          name: "GPT-5.5"
        },
        {
          description: undefined,
          id: "claude-sonnet-4-6",
          name: "Claude Sonnet 4.6"
        }
      ],
      selectedModelId: "gpt-5.5"
    });
  });

  it("answers ACP permission requests with a safe denial when no permission UI is configured", async () => {
    const { receive, sent, transport } = createTransport();
    const client = new AcpClient({ transport });

    receive({
      jsonrpc: "2.0",
      id: 39,
      method: "session/request_permission",
      params: {
        options: [
          { kind: "allow_once", name: "Allow once", optionId: "allow_once" },
          { kind: "reject_once", name: "Reject once", optionId: "reject_once" }
        ],
        sessionId: "session-1",
        toolCall: {
          kind: "edit",
          title: "Write file"
        }
      }
    });
    await Promise.resolve();

    expect(sent.at(-1)).toEqual({
      jsonrpc: "2.0",
      id: 39,
      result: {
        outcome: {
          outcome: "selected",
          optionId: "reject_once"
        }
      }
    });
  });

  it("does not answer pending peer requests after disposal", async () => {
    const { receive, sent, transport } = createTransport();
    const permissionResolver: {
      current: ((outcome: { optionId: string; outcome: "selected" }) => unknown) | null;
    } = {
      current: null
    };
    const client = new AcpClient({
      permissions: {
        requestPermission: vi.fn(() => new Promise<{ optionId: string; outcome: "selected" }>((resolve) => {
          permissionResolver.current = resolve;
        }))
      },
      transport
    });

    receive({
      jsonrpc: "2.0",
      id: 40,
      method: "session/request_permission",
      params: {
        options: [
          { kind: "allow_once", name: "Allow once", optionId: "allow_once" },
          { kind: "reject_once", name: "Reject once", optionId: "reject_once" }
        ],
        sessionId: "session-1",
        toolCall: {
          kind: "edit",
          title: "Write file"
        }
      }
    });
    await vi.waitFor(() => expect(permissionResolver.current).not.toBeNull());

    await client.dispose();
    const resolvePermission = permissionResolver.current;
    if (!resolvePermission) throw new Error("ACP permission resolver was not registered.");
    resolvePermission({ optionId: "allow_once", outcome: "selected" });
    await Promise.resolve();
    await Promise.resolve();

    expect(sent.some((message) => "id" in message && message.id === 40)).toBe(false);
  });

  it("answers agent filesystem requests through the configured client callbacks", async () => {
    const { receive, sent, transport } = createTransport();
    const readTextFile = vi.fn(async () => "line one\nline two\nline three");
    const writeTextFile = vi.fn(async () => {});
    const client = new AcpClient({
      fileSystem: {
        readTextFile,
        writeTextFile
      },
      transport
    });

    receive({
      jsonrpc: "2.0",
      id: 41,
      method: "fs/read_text_file",
      params: {
        line: 2,
        limit: 1,
        path: "/mock-vault/note.md",
        sessionId: "session-1"
      }
    });
    await Promise.resolve();

    expect(readTextFile).toHaveBeenCalledWith({
      line: 2,
      limit: 1,
      path: "/mock-vault/note.md",
      sessionId: "session-1"
    });
    expect(sent.at(-1)).toEqual({
      jsonrpc: "2.0",
      id: 41,
      result: {
        content: "line two"
      }
    });

    receive({
      jsonrpc: "2.0",
      id: 42,
      method: "fs/write_text_file",
      params: {
        content: "# Updated",
        path: "/mock-vault/note.md",
        sessionId: "session-1"
      }
    });
    await Promise.resolve();

    expect(writeTextFile).toHaveBeenCalledWith({
      content: "# Updated",
      path: "/mock-vault/note.md",
      sessionId: "session-1"
    });
    expect(sent.at(-1)).toEqual({
      jsonrpc: "2.0",
      id: 42,
      result: null
    });
  });
});
