import { modelProfiles } from "../src/features/search-recommendations/server/playground/policy";
import { configuredOrigin } from "../src/features/search-recommendations/server/mcp/tools";
const missing: string[] = [];
for (const key of [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "CHAT_AI_API_KEY",
  "CHAT_AI_BASE_URL",
  "SEARCH_API_BASE_URL",
  "SEARCH_MCP_URL",
  "SEARCH_PUBLIC_MCP_URL",
  "PLAYGROUND_USER_IDS",
  "PLAYGROUND_MODELS_JSON",
])
  if (!process.env[key]) missing.push(key);
if (process.env.PLAYGROUND_ENABLED !== "true")
  missing.push("PLAYGROUND_ENABLED=true");
try {
  configuredOrigin(process.env.SEARCH_API_BASE_URL);
} catch {
  missing.push("valid explicit SEARCH_API_BASE_URL");
}
for (const key of [
  "BETTER_AUTH_URL",
  "CHAT_AI_BASE_URL",
  "SEARCH_MCP_URL",
  "SEARCH_PUBLIC_MCP_URL",
]) {
  try {
    const url = new URL(process.env[key] ?? "");
    if (url.protocol !== "https:" || url.username || url.password)
      throw new Error();
  } catch {
    missing.push(`${key}: HTTPS URL without credentials`);
  }
}
try {
  const profiles = modelProfiles();
  if (
    !profiles.length ||
    profiles.some((p) => /REPLACE|placeholder/i.test(p.model))
  )
    missing.push("verified model profiles");
} catch {
  missing.push("valid PLAYGROUND_MODELS_JSON");
}
if (missing.length) {
  console.error(
    "Release configuration incomplete (values are never printed):\n" +
      missing.map((s) => `- ${s}`).join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    "Configuration shape checks passed. Still require database login, actual model/tool calling, duration limits, external-client checks and review gates before release.",
  );
}
