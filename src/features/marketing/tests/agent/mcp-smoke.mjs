// Checks the Marketing MCP server without a model: login required, tools listed, tools call the real API.
//   BASE_URL=http://localhost:3000 node src/features/marketing/tests/agent/mcp-smoke.mjs
import { createMCPClient } from "@ai-sdk/mcp";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const URL_ = `${BASE}/api/mcp/marketing`;
let failed = 0;
const check = (name, ok, got) => {
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  got ${JSON.stringify(got)}`}`,
  );
  if (!ok) failed += 1;
};

const anonymous = await fetch(URL_, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
  },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
check("without login → 401", anonymous.status === 401, anonymous.status);

const signIn = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE },
  body: JSON.stringify({
    email: process.env.MANAGER_EMAIL ?? "manager@shop.test",
    password: process.env.TEST_PASSWORD ?? "story-test-password-1",
  }),
});
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");
const client = await createMCPClient({
  transport: { type: "http", url: URL_, headers: { cookie } },
});
try {
  const tools = await client.tools();
  const names = Object.keys(tools).sort();
  check(
    "six tools, no reset or delete",
    JSON.stringify(names) ===
      JSON.stringify([
        "check_cart_discount",
        "create_promotion",
        "deactivate_promotion",
        "get_order_discount",
        "list_active_promotions",
        "list_promotions",
      ]),
    names,
  );
  const text = (r) => JSON.parse(r.content[0].text);
  const created = text(
    await tools.create_promotion.execute(
      {
        name: "smoke",
        description: "smoke test",
        type: "percent",
        value: 10,
        productIds: ["M1"],
      },
      { toolCallId: "1", messages: [] },
    ),
  );
  check("create_promotion creates one", !!created.data?.promotionId, created);
  const bad = await tools.create_promotion.execute(
    { name: "bad", description: "x", type: "percent", value: 150 },
    { toolCallId: "2", messages: [] },
  );
  check(
    "invalid input → isError with fieldErrors.value",
    bad.isError === true && !!text(bad).error?.fieldErrors?.value,
    bad,
  );
  const cart = text(
    await tools.check_cart_discount.execute(
      {
        currency: "EUR",
        items: [{ productId: "M1", unitPrice: 59.9, quantity: 1 }],
      },
      { toolCallId: "3", messages: [] },
    ),
  );
  check("check_cart_discount → 5.99", cart.data?.discountTotal === 5.99, cart);
  const off = text(
    await tools.deactivate_promotion.execute(
      { promotionId: created.data.promotionId },
      { toolCallId: "4", messages: [] },
    ),
  );
  check("deactivate_promotion → inactive", off.data?.active === false, off);
} finally {
  await client.close();
}
console.log(failed ? `\n${failed} FAILED` : "\nALL PASSED");
process.exit(failed ? 1 : 0);
