import { z } from "zod";
export const names = [
  "search",
  "facets",
  "autocomplete",
  "similar",
  "also_bought",
] as const;
export const modelProfileSchema = z.strictObject({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(100),
  model: z.string().min(1).max(160),
  maxOutputTokens: z.number().int().min(1).max(4096),
  temperature: z.boolean(),
  topP: z.boolean(),
  toolChoice: z.boolean(),
});
export type ModelProfile = z.infer<typeof modelProfileSchema>;
export const settingsSchema = z
  .strictObject({
    modelId: z.string().min(1).max(80),
    instructions: z.string().max(8000).default(""),
    temperature: z.number().min(0).max(2).optional(),
    topP: z.number().min(0).max(1).optional(),
    maxOutputTokens: z.number().int().min(1).max(4096).default(1024),
    maxSteps: z.number().int().min(1).max(10).default(5),
    enabledTools: z
      .array(z.enum(names))
      .max(5)
      .refine((v) => new Set(v).size === v.length)
      .default([...names]),
    toolChoice: z.enum(["auto", "required", ...names]).default("auto"),
    descriptionOverrides: z
      .partialRecord(z.enum(names), z.string().min(1).max(4000))
      .default({}),
    includeOpenApi: z.boolean().default(false),
  })
  .refine(
    (v) => v.temperature === undefined || v.topP === undefined,
    "Choose temperature or top-p, not both.",
  );
export type PlaygroundSettings = z.infer<typeof settingsSchema>;
export const messageSchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(16000),
});
export const runInputSchema = z
  .strictObject({
    settings: settingsSchema,
    messages: z.array(messageSchema).min(1).max(30),
  })
  .refine(
    (v) => v.messages.at(-1)?.role === "user",
    "Last message must be from the user.",
  );
export const eventSchema = z.strictObject({
  runId: z.string(),
  seq: z.number().int().nonnegative(),
  time: z.string(),
  step: z.number().int().nonnegative(),
  type: z.string().max(80),
  data: z.unknown(),
});
export type RunEvent = z.infer<typeof eventSchema>;
export const runSchema = z.strictObject({
  id: z.string().min(1).max(100),
  createdAt: z.string(),
  settings: settingsSchema,
  messages: z.array(messageSchema).max(30),
  events: z.array(eventSchema).max(20000),
  answer: z.string().max(200000),
  outcome: z.enum([
    "connecting",
    "running",
    "completed",
    "failed",
    "cancelled",
    "limit_reached",
  ]),
  exported: z.boolean().default(false),
});
export type SavedRun = z.infer<typeof runSchema>;
export const runExportSchema = z.strictObject({
  version: z.literal(1),
  run: runSchema,
});
export const presetSchema = z.strictObject({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(80),
  settings: settingsSchema,
});
export type Preset = z.infer<typeof presetSchema>;
