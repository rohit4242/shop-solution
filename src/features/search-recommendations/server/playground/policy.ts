import "server-only";
import {
  modelProfileSchema,
  type ModelProfile,
  type PlaygroundSettings,
} from "../../schemas/playground";
export function modelProfiles(): ModelProfile[] {
  if (!process.env.PLAYGROUND_MODELS_JSON) return [];
  const profiles = modelProfileSchema
    .array()
    .max(20)
    .parse(JSON.parse(process.env.PLAYGROUND_MODELS_JSON));
  if (new Set(profiles.map((p) => p.id)).size !== profiles.length)
    throw new Error("Duplicate model profiles.");
  return profiles;
}
export function validateSettings(
  settings: PlaygroundSettings,
  profiles: ModelProfile[],
) {
  const profile = profiles.find((p) => p.id === settings.modelId);
  if (!profile) throw new Error("Choose a configured model.");
  if (settings.maxOutputTokens > profile.maxOutputTokens)
    throw new Error("Output token limit exceeds this model profile.");
  if (
    (settings.temperature !== undefined && !profile.temperature) ||
    (settings.topP !== undefined && !profile.topP)
  )
    throw new Error("Sampling setting is unsupported by this model.");
  if (settings.toolChoice !== "auto" && !profile.toolChoice)
    throw new Error("Tool choice is unsupported by this model.");
  if (
    (settings.toolChoice === "required" && !settings.enabledTools.length) ||
    (settings.toolChoice !== "auto" &&
      settings.toolChoice !== "required" &&
      !settings.enabledTools.includes(settings.toolChoice))
  )
    throw new Error("Tool choice must refer to enabled tools.");
  for (const name of Object.keys(settings.descriptionOverrides))
    if (
      !settings.enabledTools.includes(
        name as (typeof settings.enabledTools)[number],
      )
    )
      throw new Error("Description overrides must refer to enabled tools.");
  return profile;
}
export function redact(value: unknown, secrets: string[] = []): unknown {
  if (typeof value === "string")
    return secrets
      .filter(Boolean)
      .reduce((s, secret) => s.split(secret).join("[REDACTED]"), value);
  if (Array.isArray(value)) return value.map((v) => redact(v, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) => [
        key,
        /authorization|cookie|api.?key|password|secret|database.?url/i.test(key)
          ? "[REDACTED]"
          : redact(v, secrets),
      ]),
    );
  return value;
}
