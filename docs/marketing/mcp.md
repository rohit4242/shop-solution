# Use Marketing with your AI agent (MCP)

Marketing's MCP server lets an AI agent manage promotions with the same rules as the back-office screen and the HTTP API. It runs inside the app, so there is nothing extra to start.

| Setting   | Value                                                                                             |
| --------- | ------------------------------------------------------------------------------------------------- |
| Endpoint  | `/api/mcp/marketing` on the running site, e.g. `http://localhost:3000/api/mcp/marketing`          |
| Transport | Streamable HTTP                                                                                   |
| Login     | A marketing manager's session cookie, the same login as `/marketing/promotions`                   |
| Errors    | 401 without a login, 403 without the `marketing_manager` permission, 503 if the login check fails |

The login check runs before any tool. Which login counts depends on `MARKETING_AUTH_MODE` ([Authorization](../../src/features/marketing/README.md#authorization) in the feature README).

## Tools

The tool descriptions the agent sees are in [tools.ts](../../src/features/marketing/server/mcp/tools.ts). Every tool calls the same services as the HTTP API, so input rules and errors match the [contract](marketing.yaml).

| Tool                     | Changes data | What it does                                                                                           |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------------------ |
| `list_active_promotions` | no           | Promotions that apply at checkout right now                                                            |
| `list_promotions`        | no           | All promotions, including inactive and future ones, with their `promotionId`. Optional filter `active` |
| `create_promotion`       | yes          | Creates an automatic promotion: `percent` or `fixed`, optional products or categories, optional period |
| `update_promotion`       | yes          | Changes only the fields sent; the period, products and name stay as they are                           |
| `deactivate_promotion`   | yes          | Stops a promotion at once. Promotions are never deleted                                                |
| `check_cart_discount`    | no           | The discount a cart gets at checkout, exactly as Storefront sees it. Nothing is ordered or recorded    |

There is no delete or reset tool. Test data is reset through `POST /api/v1/marketing/reset`, which is off in a production build.

## Connect an agent

Sign in first and pass the session cookie on every MCP request. With the AI SDK MCP client:

```js
import { createMCPClient } from "@ai-sdk/mcp";

const signIn = await fetch(`${BASE_URL}/api/auth/sign-in/email`, {
  method: "POST",
  headers: { "content-type": "application/json", origin: BASE_URL },
  body: JSON.stringify({ email, password }),
});
const cookie = signIn.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ");

const mcp = await createMCPClient({
  transport: {
    type: "http",
    url: `${BASE_URL}/api/mcp/marketing`,
    headers: { cookie },
  },
});
const tools = await mcp.tools();
```

Two scripts show the full flow against a local app:

- [mcp-smoke.mjs](../../src/features/marketing/tests/agent/mcp-smoke.mjs) checks the login, lists the tools and calls `create_promotion` and `check_cart_discount` without a model.
- [run-scenarios.mjs](../../src/features/marketing/tests/agent/run-scenarios.mjs) gives a model only these tools, runs the agent scenarios and checks the outcome through the HTTP API. Commands are under [Verification](../../src/features/marketing/README.md#verification).

## What we learned from the agent runs

In the first runs the server had no update tool, so "raise the promotion to 10 %" meant deactivate plus create. Agents often dropped the end date on the way and still reported success. Adding `update_promotion` fixed it: 20 of 20 runs passed afterwards. Details are in the [session 8 test report](exercises/session-8-finished-erp/test-report.md#agent-runs-27-and-28-nov-2026-groq).
