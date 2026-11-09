import { z } from "zod";
import { endpointDefinitions } from "./registry";
import { discoveryItemSchema, errorResponseSchema } from "../schemas/contracts";
export function createOpenApiDocument() {
  const paths = Object.fromEntries(
    Object.entries(endpointDefinitions).map(([key, endpoint]) => {
      const query = z.toJSONSchema(endpoint.querySchema, { io: "output" });
      const properties = query.properties ?? {};
      return [
        endpoint.path,
        {
          get: {
            operationId: key.replaceAll("-", "_"),
            summary: endpoint.title,
            description: endpoint.description + " " + endpoint.behavior,
            tags: [
              key === "similar" || key === "also-bought"
                ? "Recommendations"
                : "Search",
            ],
            security: [],
            parameters: endpoint.parameters.map((parameter) => ({
              name: parameter.name,
              in: "query",
              required: parameter.required ?? false,
              description:
                parameter.description +
                (parameter.defaultValue
                  ? ` Default: ${parameter.defaultValue}.`
                  : ""),
              schema: properties[parameter.name],
            })),
            responses: {
              "200": {
                description: "Success (including empty results)",
                content: {
                  "application/json": {
                    schema: z.toJSONSchema(endpoint.responseSchema),
                    examples: {
                      success: { value: endpoint.example },
                      empty: { value: endpoint.empty },
                    },
                  },
                },
              },
              ...Object.fromEntries(
                [
                  400,
                  ...(key === "similar" || key === "also-bought" ? [404] : []),
                  503,
                  500,
                ].map((status) => [
                  String(status),
                  {
                    description:
                      status === 400
                        ? "Invalid query"
                        : status === 404
                          ? "Product not found"
                          : status === 503
                            ? "Dependency unavailable"
                            : "Unexpected error",
                    content: {
                      "application/json": {
                        schema: z.toJSONSchema(errorResponseSchema),
                      },
                    },
                  },
                ]),
              ),
            },
          },
        },
      ];
    }),
  );
  return {
    openapi: "3.1.0",
    info: {
      title: "Search & Recommendations",
      version: "1.0.0",
      description:
        "Mock-backed developer API. Marketplace wire contract and purchase source are not finalized. Unknown or repeated query parameters are rejected. Integer query parameters use decimal digits only; prices are pre-discount EUR minor units.",
    },
    servers: [{ url: "/", description: "Current application origin" }],
    paths,
    components: {
      schemas: {
        DiscoveryItem: z.toJSONSchema(discoveryItemSchema),
        Error: z.toJSONSchema(errorResponseSchema),
      },
    },
  };
}
