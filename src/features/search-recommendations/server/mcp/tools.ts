import "server-only";
import { z } from "zod";
import { createOpenApiDocument } from "../../docs/openapi";
import { endpointDefinitions } from "../../docs/registry";

// Derived from the public contract's parsed input shape: numbers here, decimal strings over HTTP.
const spec = createOpenApiDocument();
export const toolNames = [
  "search",
  "facets",
  "autocomplete",
  "similar",
  "also_bought",
] as const;
export type ToolName = (typeof toolNames)[number];
const descriptions: Record<ToolName, string> = {
  search:
    "Find public products by text and filters. Empty q browses. Prices are EUR cents: maxPriceMinor=2500 means €25. Use productId from returned items for recommendations. Defaults include active out-of-stock offers. Returns items, total and pagination.",
  facets:
    "Discover filter values and counts for a search. Each facet ignores its own filter; price range ignores both price bounds. Prices are EUR cents. Returns categories, sellers, availability counts and a nullable price range.",
  autocomplete:
    'Suggest product names from a normalized full-name prefix, e.g. q="wire". Requires at least two characters. Returns suggestions with productId and name, or an empty list.',
  similar:
    'Find alternatives to an active product, e.g. productId="prd_1" from search. Ranks same-category products by shared attributes and price difference, excluding the source. Missing or hidden source returns 404. Returns items, possibly empty. Not purchase evidence.',
  also_bought:
    'Find products occurring with productId (e.g. "prd_1") in synthetic purchase groups. Returns items ranked by co-occurrence, excluding the source. Missing/hidden source returns 404. No evidence means empty items: do not substitute similarity or claim real customer behavior.',
};
function definition(name: ToolName) {
  const key = name === "also_bought" ? "also-bought" : name;
  const endpoint = endpointDefinitions[key];
  const parameters = spec.paths[endpoint.path].get.parameters;
  const shape: Record<string, z.ZodType> = {};
  for (const parameter of parameters) {
    const s = parameter.schema as {
      type?: string;
      enum?: string[];
      minimum?: number;
      maximum?: number;
      minLength?: number;
      maxLength?: number;
      default?: unknown;
    };
    let field: z.ZodType = s.enum
      ? z.enum(s.enum as [string, ...string[]])
      : s.type === "integer" || s.type === "number"
        ? z
            .number()
            .int()
            .min(s.minimum ?? 0)
            .max(s.maximum ?? Number.MAX_SAFE_INTEGER)
        : z
            .string()
            .min(s.minLength ?? 0)
            .max(s.maxLength ?? 200);
    field = field.describe(parameter.description);
    if (s.default !== undefined) field = field.default(s.default);
    else if (!parameter.required) field = field.optional();
    shape[parameter.name] = field;
  }
  return {
    path: endpoint.path,
    description: descriptions[name],
    schema: z.strictObject(shape),
  };
}
export const toolDefinitions = Object.fromEntries(
  toolNames.map((name) => [name, definition(name)]),
) as Record<ToolName, ReturnType<typeof definition>>;

export function configuredOrigin(value = process.env.SEARCH_API_BASE_URL) {
  const candidate =
    value ||
    (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:3000");
  const url = new URL(candidate);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Configure an HTTP(S) origin without credentials, path, query or fragment.",
    );
  return url.origin;
}

export async function callDiscoveryTool(
  name: ToolName,
  input: unknown,
  options: {
    origin?: string;
    fetcher?: typeof fetch;
    signal?: AbortSignal;
  } = {},
) {
  const definition = toolDefinitions[name];
  const args = definition.schema.parse(input);
  const url = new URL(definition.path, configuredOrigin(options.origin));
  for (const [key, value] of Object.entries(args))
    if (value !== undefined) url.searchParams.set(key, String(value));
  const request = {
    method: "GET",
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
  };
  const timeout = AbortSignal.timeout(10_000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  let payload: unknown,
    isError = false;
  try {
    const response = await (options.fetcher ?? fetch)(url, {
      signal,
      redirect: "manual",
      cache: "no-store",
      headers: process.env.VERCEL_AUTOMATION_BYPASS_SECRET
        ? {
            "x-vercel-protection-bypass":
              process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
          }
        : undefined,
    });
    const status = response.status,
      requestId = response.headers.get("x-request-id");
    try {
      const body: unknown = await response.json();
      isError = !response.ok;
      payload = { request, status, requestId, body };
    } catch {
      isError = true;
      payload = {
        request,
        status,
        requestId,
        error: {
          code: "INVALID_UPSTREAM_RESPONSE",
          message: "API returned invalid JSON.",
        },
      };
    }
  } catch {
    isError = true;
    const code = timeout.aborted
      ? "TIMEOUT"
      : options.signal?.aborted
        ? "CANCELLED"
        : "CONNECTION_FAILED";
    payload = {
      request,
      status: null,
      requestId: null,
      error: {
        code,
        message:
          code === "TIMEOUT"
            ? "API request exceeded 10 seconds."
            : code === "CANCELLED"
              ? "Request cancelled."
              : "Could not connect to the discovery API.",
      },
    };
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload) }],
    isError,
  };
}
