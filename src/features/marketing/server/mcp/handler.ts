import "server-only";

import { createMcpHandler } from "mcp-handler";
import { fail } from "../../utils/http";
import { checkMarketingManager } from "../session";
import { marketingTools } from "./tools";

// POST /api/mcp/marketing (Streamable HTTP). The whole server is for the Marketing back office, so the
// marketing-manager check runs at the door, before any tool: same login as the screen and the API.

const mcp = createMcpHandler(
  (server) => {
    for (const [name, tool] of Object.entries(marketingTools)) {
      server.registerTool(
        name,
        {
          description: tool.description,
          inputSchema: tool.schema,
          annotations: {
            readOnlyHint: tool.readOnly,
            destructiveHint: false,
            idempotentHint: tool.readOnly || name === "deactivate_promotion",
            openWorldHint: false,
          },
        },
        // Each tool parses its own input with its schema; the cast only satisfies the generic signature.
        async (args: unknown) =>
          (tool.run as (input: unknown) => ReturnType<typeof tool.run>)(args),
      );
    }
  },
  {
    serverInfo: { name: "shop-marketing", version: "0.3.0" },
    maxSubscriptions: 0,
  },
);

export async function marketingMcpHandler(request: Request) {
  const access = await checkMarketingManager(request);
  if (!access.ok) {
    return access.status === 401
      ? fail(401, "unauthorized", "Login required.")
      : access.status === 403
        ? fail(403, "forbidden", "You need the marketing_manager permission.")
        : fail(
            503,
            "identity_unavailable",
            "Could not check your login. Try again in a moment.",
          );
  }
  return mcp(request);
}
