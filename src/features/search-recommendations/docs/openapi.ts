import { z } from "zod";
import { endpointDefinitions } from "./endpoints";
import {
  discoveryItemSchema,
  errorResponseSchema,
  moderationSearchResponseSchema,
} from "../schemas/contracts";
export function createOpenApiDocument() {
  const paths = Object.fromEntries(
    Object.entries(endpointDefinitions).map(([key, endpoint]) => {
      const supportsModeration = key === "search";
      const query = z.toJSONSchema(endpoint.querySchema, { io: "output" });
      const properties = query.properties ?? {};
      const publicResponse = z.toJSONSchema(endpoint.responseSchema);
      return [
        endpoint.path,
        {
          get: {
            operationId: key.replaceAll("-", "_"),
            summary: endpoint.title,
            description:
              endpoint.description +
              " " +
              endpoint.behavior +
              (supportsModeration
                ? " Moderation scope requires a live offers:approve permission check and adds status to each item."
                : ""),
            tags: [
              key === "similar" || key === "also-bought"
                ? "Recommendations"
                : "Search",
            ],
            security: supportsModeration ? [{}, { identitySession: [] }] : [],
            parameters: [
              ...endpoint.parameters.map((parameter) => ({
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
              ...(supportsModeration
                ? [
                    {
                      name: "scope",
                      in: "query",
                      required: false,
                      description:
                        "Defaults to public. Moderation requires an Identity session with offers:approve.",
                      schema: properties.scope,
                    },
                  ]
                : []),
            ],
            responses: {
              "200": {
                description: "Success (including empty results)",
                content: {
                  "application/json": {
                    schema: supportsModeration
                      ? {
                          anyOf: [
                            publicResponse,
                            z.toJSONSchema(moderationSearchResponseSchema),
                          ],
                        }
                      : publicResponse,
                    examples: {
                      success: { value: endpoint.example },
                      empty: { value: endpoint.empty },
                    },
                  },
                },
              },
              ...Object.fromEntries(
                Object.entries({
                  400: "Invalid query",
                  ...(supportsModeration
                    ? {
                        401: "Moderation requires a valid Identity session",
                        403: "Moderation permission denied",
                        502: "Unexpected Identity client error",
                      }
                    : {}),
                  ...(key === "similar" || key === "also-bought"
                    ? { 404: "Product not found" }
                    : {}),
                  503: "Dependency unavailable",
                  500: "Unexpected error",
                }).map(([status, description]) => [
                  status,
                  {
                    description,
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
      version: "1.1.0",
      description:
        "Mock-backed developer API. Marketplace wire contract and purchase source are not finalized. Unknown or repeated query parameters are rejected. Integer query parameters use decimal digits only; prices are pre-discount EUR minor units.",
    },
    servers: [{ url: "/", description: "Current application origin" }],
    paths,
    components: {
      securitySchemes: {
        identitySession: {
          type: "apiKey",
          in: "cookie",
          name: "erp_access_token",
        },
      },
      schemas: {
        DiscoveryItem: z.toJSONSchema(discoveryItemSchema),
        Error: z.toJSONSchema(errorResponseSchema),
      },
    },
  };
}
