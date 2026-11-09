import { describe, it, expect } from "vitest";
import {
  authorizeUser,
  validateSettings,
  redact,
} from "../server/playground/policy";
import { settingsSchema, runExportSchema } from "../schemas/playground";
const profile = {
  id: "test",
  label: "Test",
  model: "test-model",
  maxOutputTokens: 2048,
  temperature: true,
  topP: false,
  toolChoice: true,
};
describe("playground boundaries", () => {
  it("denies anonymous, unapproved and empty-allowlist access", () => {
    expect(authorizeUser(null, "u1")).toBe(401);
    expect(authorizeUser("u2", "u1")).toBe(403);
    expect(authorizeUser("u1", "")).toBe(403);
    expect(authorizeUser("u1", "u1,u2")).toBe(200);
  });
  it("validates settings, model capabilities and selected tools", () => {
    const settings = settingsSchema.parse({ modelId: "test" });
    expect(validateSettings(settings, [profile]).id).toBe("test");
    expect(() =>
      validateSettings({ ...settings, modelId: "unknown" }, [profile]),
    ).toThrow();
    expect(() =>
      validateSettings({ ...settings, topP: 0.5 }, [profile]),
    ).toThrow();
    expect(() =>
      validateSettings({ ...settings, maxOutputTokens: 4096 }, [profile]),
    ).toThrow();
    expect(() =>
      validateSettings(
        { ...settings, enabledTools: [], toolChoice: "search" },
        [profile],
      ),
    ).toThrow();
    expect(
      settingsSchema.safeParse({ ...settings, temperature: 0.2, topP: 0.5 })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...settings, maxSteps: 11 }).success,
    ).toBe(false);
  });
  it("redacts keys and known secrets recursively, without leaking authorization", () => {
    expect(
      redact(
        {
          authorization: "Bearer abc",
          nested: { message: "key=xyz", cookie: "s=1" },
        },
        ["xyz"],
      ),
    ).toEqual({
      authorization: "[REDACTED]",
      nested: { message: "key=[REDACTED]", cookie: "[REDACTED]" },
    });
  });
  it("rejects malformed imported runs", () => {
    expect(
      runExportSchema.safeParse({
        version: 1,
        run: { events: [{ execute: "fetch(secret)" }] },
      }).success,
    ).toBe(false);
  });
});
