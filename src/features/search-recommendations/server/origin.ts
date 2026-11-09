import "server-only";

type Env = Record<string, string | undefined>;

/** Accept only a bare http(s) origin: no credentials, path, query or fragment. */
export function normalizeOrigin(value: string): string {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error(
      "Use an HTTP(S) origin without credentials, path, query or fragment.",
    );
  return url.origin;
}

/** The deployed address Vercel gives this app, or null when not on Vercel. */
function vercelOrigin(env: Env): string | null {
  if (env.VERCEL_ENV === "production" && env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return env.VERCEL_URL ? `https://${env.VERCEL_URL}` : null;
}

/**
 * Where our own Search API is reachable. Never derived from a request's Host
 * header. Order: SEARCH_API_BASE_URL, then Vercel's system variables, then
 * localhost during development.
 */
export function apiOrigin(env: Env = process.env): string {
  const candidate =
    env.SEARCH_API_BASE_URL ||
    vercelOrigin(env) ||
    (env.NODE_ENV === "production" ? null : "http://127.0.0.1:3000");
  if (!candidate)
    throw new Error("Set SEARCH_API_BASE_URL to the app's public origin.");
  return normalizeOrigin(candidate);
}

export const mcpPath = "/api/mcp/search-recommendations";

/** Our MCP endpoint, which the playground connects to. */
export function mcpUrl(env: Env = process.env): string {
  return `${apiOrigin(env)}${mcpPath}`;
}

/** The API origin for documentation, or null when the address is unknown (never throws). */
export function displayOrigin(env: Env = process.env): string | null {
  try {
    return apiOrigin(env);
  } catch {
    return null;
  }
}

/** The MCP endpoint for documentation, or null when the address is unknown (never throws). */
export function displayMcpUrl(env: Env = process.env): string | null {
  const origin = displayOrigin(env);
  return origin ? `${origin}${mcpPath}` : null;
}
