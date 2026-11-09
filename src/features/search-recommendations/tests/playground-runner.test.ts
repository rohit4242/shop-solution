import { beforeEach, it, expect, vi } from "vitest";
import { MockLanguageModelV4 } from "ai/test";
import { simulateReadableStream } from "ai";
import { z } from "zod";
const mocks = vi.hoisted(() => ({
  model: undefined as unknown,
  close: vi.fn(),
  execute: vi.fn(),
}));
vi.mock("@ai-sdk/openai-compatible", () => ({
  createOpenAICompatible: () => ({ chatModel: () => mocks.model }),
}));
vi.mock("@ai-sdk/mcp", () => ({
  createMCPClient: async () => ({
    listTools: async () => ({
      tools: [
        {
          name: "search",
          description: "Search",
          inputSchema: { type: "object" },
        },
      ],
    }),
    toolsFromDefinitions: () => ({
      search: {
        description: "Search",
        inputSchema: z.object({ q: z.string() }),
        execute: mocks.execute,
      },
    }),
    close: mocks.close,
  }),
}));
import { modelBaseUrl, streamRun } from "../server/playground/runner";
import { runInputSchema } from "../schemas/playground";
const profile = {
  id: "test",
  label: "Test",
  model: "test",
  maxOutputTokens: 2048,
  temperature: true,
  topP: false,
  toolChoice: true,
};
const usage = {
  inputTokens: {
    total: 3,
    noCache: 3,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: 2, text: 2, reasoning: undefined },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SEARCH_API_BASE_URL", "http://localhost:3000");
  vi.stubEnv("OPENAI_API_KEY", "test-secret");
});
it("uses the real SDK loop, emits tool results, and closes the MCP client", async () => {
  mocks.execute.mockResolvedValue({
    content: [
      { type: "text", text: '{"status":200,"body":{"data":{"items":[]}}}' },
    ],
  });
  mocks.model = new MockLanguageModelV4({
    doStream: [
      {
        stream: simulateReadableStream({
          chunks: [
            {
              type: "tool-call",
              toolCallId: "call1",
              toolName: "search",
              input: '{"q":"wireless"}',
            },
            {
              type: "finish",
              finishReason: { unified: "tool-calls", raw: undefined },
              usage,
            },
          ],
        }),
      },
      {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start", id: "t" },
            { type: "text-delta", id: "t", delta: "No matches." },
            { type: "text-end", id: "t" },
            {
              type: "finish",
              finishReason: { unified: "stop", raw: undefined },
              usage,
            },
          ],
        }),
      },
    ],
  });
  const input = runInputSchema.parse({
    settings: { modelId: "test", enabledTools: ["search"] },
    messages: [{ role: "user", content: "Search" }],
  });
  const response = streamRun(input, profile, new AbortController().signal);
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  expect(events.find((e) => e.type === "tool-call").data.arguments).toEqual({
    q: "wireless",
  });
  expect(events.find((e) => e.type === "tool-result").data.result).toBeTruthy();
  expect(events.at(-1).data.state).toBe("completed");
  expect(mocks.execute).toHaveBeenCalledTimes(1);
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("retains a failed outcome and cleans up when the model fails", async () => {
  mocks.model = new MockLanguageModelV4({
    doStream: async () => {
      throw new Error("test-secret");
    },
  });
  const response = streamRun(
    runInputSchema.parse({
      settings: { modelId: "test", enabledTools: ["search"] },
      messages: [{ role: "user", content: "Search" }],
    }),
    profile,
    new AbortController().signal,
  );
  const text = await response.text();
  expect(text).not.toContain("test-secret");
  expect(text).toContain('"state":"failed"');
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("enforces the twenty-call ceiling even within one model step", async () => {
  mocks.execute.mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
  mocks.model = new MockLanguageModelV4({
    doStream: {
      stream: simulateReadableStream({
        chunks: [
          ...Array.from({ length: 25 }, (_, i) => ({
            type: "tool-call" as const,
            toolCallId: `call${i}`,
            toolName: "search",
            input: '{"q":"wireless"}',
          })),
          {
            type: "finish",
            finishReason: { unified: "tool-calls", raw: undefined },
            usage,
          },
        ],
      }),
    },
  });
  const response = streamRun(
    runInputSchema.parse({
      settings: { modelId: "test", enabledTools: ["search"] },
      messages: [{ role: "user", content: "Search" }],
    }),
    profile,
    new AbortController().signal,
  );
  const text = await response.text();
  expect(mocks.execute.mock.calls.length).toBeLessThanOrEqual(20);
  expect(text).toContain('"state":"limit_reached"');
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("stops before executing tools after cancellation", async () => {
  const controller = new AbortController();
  controller.abort();
  mocks.model = new MockLanguageModelV4({
    doStream: async () => {
      throw new Error("cancelled");
    },
  });
  const response = streamRun(
    runInputSchema.parse({
      settings: { modelId: "test", enabledTools: ["search"] },
      messages: [{ role: "user", content: "Search" }],
    }),
    profile,
    controller.signal,
  );
  const text = await response.text();
  expect(text).toContain('"state":"cancelled"');
  expect(mocks.execute).not.toHaveBeenCalled();
  expect(mocks.close).toHaveBeenCalledTimes(1);
});
it("uses OpenAI by default and any OpenAI-compatible base URL when set", () => {
  expect(modelBaseUrl({})).toBe("https://api.openai.com/v1");
  expect(
    modelBaseUrl({ OPENAI_BASE_URL: "https://openrouter.ai/api/v1" }),
  ).toBe("https://openrouter.ai/api/v1");
});
