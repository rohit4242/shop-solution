// Agent runs for Marketing's scenarios (lecture 8): a model gets ONLY the tools from our MCP server
// (/api/mcp/marketing), does the task, and afterwards code checks the real state through the HTTP API.
// The agent's own answer is recorded, never trusted: "done" is not a test result.
//
//   OPENAI_BASE_URL=https://api.groq.com/openai/v1 OPENAI_API_KEY=<groq key> OPENAI_MODEL=<model> \
//   BASE_URL=http://localhost:3000 MARKETING_RESET_TOKEN=<token> \
//   node src/features/marketing/tests/agent/run-scenarios.mjs [--scenario <id>|all] [--runs 5] [--out results.json]
//
// App: MARKETING_AUTH_MODE=local, MARKETING_MANAGER_EMAILS=manager@shop.test, MARKETING_RESET_ENABLED=true.

import { writeFileSync } from "node:fs";
import { createMCPClient } from "@ai-sdk/mcp";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText, isStepCount } from "ai";

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const API = `${BASE}/api/v1/marketing`;
const RUNS = Number(arg("runs", "5"));
const ONLY = arg("scenario", "all");
const OUT = arg("out", null);
const MANAGER = process.env.MANAGER_EMAIL ?? "manager@shop.test";
const PASSWORD = process.env.TEST_PASSWORD ?? "story-test-password-1";
const PAUSE_MS = Number(process.env.AGENT_PAUSE_MS ?? "4000"); // free Groq tier: stay under tokens/minute

for (const name of ["OPENAI_API_KEY", "OPENAI_MODEL"]) {
  if (!process.env[name]) throw new Error(`Set ${name}. Never commit the key.`);
}
// Some providers (Groq) reject the model's own reasoning when it is sent back on the next turn.
async function withoutReasoningEcho(url, init) {
  if (init?.body && typeof init.body === "string") {
    const body = JSON.parse(init.body);
    for (const message of body.messages ?? []) {
      delete message.reasoning_content;
      delete message.reasoning;
    }
    init = { ...init, body: JSON.stringify(body) };
  }
  return fetch(url, init);
}
const provider = createOpenAICompatible({
  name: "agent-provider",
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY,
  fetch: withoutReasoningEcho,
});
const model = provider.chatModel(process.env.OPENAI_MODEL);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// --- HTTP helpers (the checks use the API, not the agent's tools) -------------------------------------
async function call(method, url, { body, cookie, headers = {} } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      ...(cookie && { cookie }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await response.json();
  } catch {
    /* empty */
  }
  return {
    status: response.status,
    json,
    setCookie: response.headers.getSetCookie?.() ?? [],
  };
}
async function login() {
  let res = await call("POST", `${BASE}/api/auth/sign-in/email`, {
    body: { email: MANAGER, password: PASSWORD },
  });
  if (res.status !== 200)
    res = await call("POST", `${BASE}/api/auth/sign-up/email`, {
      body: { email: MANAGER, password: PASSWORD, name: "Manager" },
    });
  const cookie = res.setCookie.map((c) => c.split(";")[0]).join("; ");
  if (!cookie) throw new Error(`login failed: HTTP ${res.status}`);
  return cookie;
}
const resetHeaders = process.env.MARKETING_RESET_TOKEN
  ? { authorization: `Bearer ${process.env.MARKETING_RESET_TOKEN}` }
  : {};
async function reset() {
  const res = await call("POST", `${API}/reset`, { headers: resetHeaders });
  if (res.status !== 200) throw new Error(`reset failed: HTTP ${res.status}`);
}
const allPromotions = async (cookie) =>
  (await call("GET", `${API}/promotions`, { cookie })).json?.data ?? [];
const cartM1 = async () =>
  (
    await call("POST", `${API}/discounts/validate`, {
      body: {
        currency: "EUR",
        items: [{ productId: "M1", unitPrice: 59.9, quantity: 1 }],
      },
    })
  ).json?.data;

// Berlin is UTC+1 in December.
const END_OF_31_DEC = Date.parse("2026-12-31T23:59:00+01:00");
const START_OF_1_JAN = Date.parse("2027-01-01T00:00:00+01:00");

// --- Scenarios ---------------------------------------------------------------------------------------
const scenarios = {
  "m1-promotion-created": {
    step: "j",
    task: "Create a promotion that gives 10 % off the wireless mouse M1 (product id M1), valid from today until 31 December 2026.",
    setup: async () => {},
    check: async (cookie, answer) => {
      const all = await allPromotions(cookie);
      const active =
        (await call("GET", `${API}/promotions/active`)).json?.data ?? [];
      const p = active[0];
      const validTo = p?.validTo ? Date.parse(p.validTo) : NaN;
      return [
        [
          "exactly one promotion exists (none created twice)",
          all.length === 1,
          all.length,
        ],
        [
          "exactly one promotion is active now",
          active.length === 1,
          active.length,
        ],
        [
          "it applies only to M1",
          JSON.stringify(p?.productIds) === '["M1"]' &&
            (p?.categoryIds ?? []).length === 0,
          p && { productIds: p.productIds, categoryIds: p.categoryIds },
        ],
        [
          "it is percent with value 10",
          p?.type === "percent" && p?.value === 10,
          p && { type: p.type, value: p.value },
        ],
        [
          "it starts today or earlier",
          !!p && Date.parse(p.validFrom) <= Date.now() + 60_000,
          p?.validFrom,
        ],
        [
          "it includes the whole of 31 Dec 2026 and ends by 1 Jan 2027 (Berlin)",
          validTo >= END_OF_31_DEC && validTo <= START_OF_1_JAN,
          p?.validTo,
        ],
        [
          "checkout gives 5.99 off M1 at 59.90",
          (await cartM1())?.discountTotal === 5.99,
          undefined,
        ],
        ["the agent reported success", claimsSuccess(answer), undefined],
      ];
    },
  },
  "m1-promotion-raised": {
    step: "j (change) → k",
    task:
      "M1 (product id M1) currently has a 5 % promotion. Raise it to 10 %. Afterwards a customer buying one M1 at 59.90 EUR " +
      "must get exactly 10 % off, not more and not less. Tell me the discount amount the customer gets.",
    setup: async (cookie) => {
      const res = await call("POST", `${API}/promotions`, {
        cookie,
        body: {
          name: "M1 5 %",
          description: "5 % off M1",
          type: "percent",
          value: 5,
          productIds: ["M1"],
          validTo: "2026-12-31T23:59:59+01:00",
        },
      });
      if (res.status !== 201)
        throw new Error(`setup failed: HTTP ${res.status}`);
      return { originalEnd: res.json.data.validTo };
    },
    // Outcome checks only: the agent may update the 5 % promotion in place or replace it.
    check: async (cookie, answer, { originalEnd }) => {
      const all = await allPromotions(cookie);
      const activeM1 = all.filter(
        (p) => p.active && p.productIds.includes("M1"),
      );
      const cart = await cartM1();
      return [
        [
          "exactly one active promotion for M1",
          activeM1.length === 1,
          activeM1.map(
            (p) => `${p.value}${p.type === "percent" ? "%" : "EUR"}`,
          ),
        ],
        [
          "the active one is 10 %",
          activeM1[0]?.type === "percent" && activeM1[0]?.value === 10,
          activeM1[0] && { type: activeM1[0].type, value: activeM1[0].value },
        ],
        // Added after the first 10 runs: "raise it" keeps the period. A replacement without an end date
        // runs forever, and the first version of these checks let that through.
        [
          "the 10 % promotion keeps the original end (31 Dec 2026)",
          !!activeM1[0]?.validTo &&
            Date.parse(activeM1[0].validTo) === Date.parse(originalEnd),
          activeM1[0] && { validTo: activeM1[0].validTo, originalEnd },
        ],
        [
          "checkout gives exactly 5.99 off M1 at 59.90",
          cart?.discountTotal === 5.99 && cart?.appliedBy === "promotion",
          cart && {
            discountTotal: cart.discountTotal,
            appliedBy: cart.appliedBy,
          },
        ],
        ["the agent's answer states 5.99", /5[.,]99/.test(answer), undefined],
        ["the agent reported success", claimsSuccess(answer), undefined],
      ];
    },
  },
};

function claimsSuccess(text) {
  return (
    !!text &&
    !/\b(could not|couldn't|cannot|can't|unable|failed|error|not possible|did not)\b/i.test(
      text,
    )
  );
}

const SYSTEM = () =>
  `You are the back-office assistant of the Marketing team of an online shop. Today is ${new Date().toISOString().slice(0, 10)}; ` +
  "the shop's time zone is Europe/Berlin (UTC+1 in winter). Use the tools for every change and every fact. " +
  "Check your work with the read-only tools before you answer. If something did not work, say so plainly.";

async function runOnce(id, scenario, index) {
  await reset();
  const cookie = await login();
  const context = (await scenario.setup(cookie)) ?? {};
  const mcp = await createMCPClient({
    transport: {
      type: "http",
      url: `${BASE}/api/mcp/marketing`,
      headers: { cookie },
    },
  });
  const started = Date.now();
  let answer = "",
    toolCalls = [],
    usage = {},
    error = null;
  try {
    const tools = await mcp.tools();
    const result = await generateText({
      model,
      system: SYSTEM(),
      prompt: scenario.task,
      tools,
      stopWhen: isStepCount(12),
      temperature: 0.2,
    });
    answer = result.text;
    toolCalls = result.steps.flatMap((step) =>
      step.toolCalls.map((c) => ({ tool: c.toolName, input: c.input })),
    );
    usage = result.usage ?? {};
  } catch (e) {
    error = String(e?.message ?? e).slice(0, 300);
  } finally {
    await mcp.close();
  }
  const checks = (await scenario.check(cookie, answer, context)).map(
    ([name, ok, got]) => ({ name, ok: !!ok, got }),
  );
  const stateChecks = checks.filter(
    (c) => c.name !== "the agent reported success",
  );
  const passed = !error && stateChecks.every((c) => c.ok);
  const saidDone =
    checks.find((c) => c.name === "the agent reported success")?.ok ?? false;
  const record = {
    scenario: id,
    run: index,
    passed,
    saidDoneButFailed: saidDone && !passed,
    error,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    tokens: {
      input: usage.inputTokens ?? null,
      output: usage.outputTokens ?? null,
    },
    toolCalls,
    answer,
    checks,
  };
  console.log(
    `${passed ? "PASS" : "FAIL"}  ${id} #${index}  ${record.seconds}s  tools: ${toolCalls.map((c) => c.tool).join(", ") || "none"}`,
  );
  for (const c of checks.filter((c) => !c.ok))
    console.log(
      `      ✗ ${c.name}${c.got !== undefined ? `  got ${JSON.stringify(c.got)}` : ""}`,
    );
  if (error) console.log(`      ✗ error: ${error}`);
  return record;
}

const records = [];
for (const [id, scenario] of Object.entries(scenarios)) {
  if (ONLY !== "all" && ONLY !== id) continue;
  for (let i = 1; i <= RUNS; i++) {
    records.push(await runOnce(id, scenario, i));
    await sleep(PAUSE_MS);
  }
}
await reset();

console.log(
  `\nModel: ${process.env.OPENAI_MODEL} via ${process.env.OPENAI_BASE_URL ?? "OpenAI"}`,
);
for (const id of [...new Set(records.map((r) => r.scenario))]) {
  const all = records.filter((r) => r.scenario === id);
  const runs = all.filter((r) => !r.harnessError);
  const errors = all.length - runs.length;
  const pass = runs.filter((r) => r.passed).length;
  const lied = runs.filter((r) => r.saidDoneButFailed).length;
  const tokens = runs.reduce(
    (sum, r) => sum + (r.tokens.input ?? 0) + (r.tokens.output ?? 0),
    0,
  );
  console.log(
    `${id}: ${pass}/${runs.length} pass · "done" but failed: ${lied} · harness errors: ${errors} · avg tokens ${Math.round(tokens / runs.length)}`,
  );
}
if (OUT)
  writeFileSync(
    OUT,
    JSON.stringify(
      {
        model: process.env.OPENAI_MODEL,
        baseUrl: process.env.OPENAI_BASE_URL,
        date: new Date().toISOString(),
        records,
      },
      null,
      2,
    ),
  );
process.exit(0);
