import "server-only";
import { createMcpHandler } from "mcp-handler";
import { stringify } from "yaml";
import { createOpenApiDocument } from "../../docs/openapi";
import { callDiscoveryTool, toolDefinitions, toolNames } from "./tools";
export const mcpHandler = createMcpHandler(
  (server) => {
    for (const name of toolNames) {
      const definition = toolDefinitions[name];
      server.registerTool(
        name,
        {
          description: definition.description,
          inputSchema: definition.schema,
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
        async (args, context) =>
          callDiscoveryTool(name, args, { signal: context.mcpReq.signal }),
      );
    }
    server.registerResource(
      "openapi",
      "erp://search-recommendations/openapi",
      {
        description:
          "OpenAPI 3.1 contract for the mock-backed Search & Recommendations API.",
        mimeType: "application/yaml",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/yaml",
            text: stringify(createOpenApiDocument()),
          },
        ],
      }),
    );
  },
  {
    serverInfo: { name: "shop-search-recommendations", version: "1.0.0" },
    maxSubscriptions: 0,
  },
);
export function openApiYamlResponse() {
  return new Response(stringify(createOpenApiDocument()), {
    headers: {
      "Content-Type": "application/yaml",
      "Content-Disposition": 'attachment; filename="openapi.yaml"',
    },
  });
}
