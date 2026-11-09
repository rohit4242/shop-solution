import { beforeEach, it, expect, vi } from "vitest";
const session = vi.hoisted(() => vi.fn());
vi.mock("@/features/admin-identity/server", () => ({
  auth: { api: { getSession: session } },
}));
import { playgroundConfig, playgroundRun } from "../server/playground/http";
beforeEach(() => {
  vi.unstubAllEnvs();
  session.mockReset();
  vi.stubEnv("PLAYGROUND_USER_IDS", "approved");
});
it("checks actual HTTP handlers for 401, 403 and approved configuration", async () => {
  session.mockResolvedValue(null);
  expect(
    (
      await playgroundConfig(
        new Request("http://localhost/api/search-playground/config"),
      )
    ).status,
  ).toBe(401);
  session.mockResolvedValue({ user: { id: "outsider" } });
  expect(
    (
      await playgroundRun(
        new Request("http://localhost/api/search-playground/run", {
          method: "POST",
        }),
      )
    ).status,
  ).toBe(403);
  session.mockResolvedValue({ user: { id: "approved" } });
  const result = await playgroundConfig(
    new Request("http://localhost/api/search-playground/config"),
  );
  expect(result.status).toBe(200);
  expect((await result.json()).userId).toBe("approved");
});
it("denies cross-origin and disabled runs before calling any provider", async () => {
  session.mockResolvedValue({ user: { id: "approved" } });
  expect(
    (
      await playgroundRun(
        new Request("http://localhost/api/search-playground/run", {
          method: "POST",
          headers: { origin: "https://evil.example" },
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await playgroundRun(
        new Request("http://localhost/api/search-playground/run", {
          method: "POST",
          headers: { origin: "http://localhost" },
        }),
      )
    ).status,
  ).toBe(503);
});
it("does not pretend a database failure is an authenticated session", async () => {
  session.mockRejectedValue(new Error("database credentials"));
  const response = await playgroundConfig(
    new Request("http://localhost/api/search-playground/config"),
  );
  expect(response.status).toBe(503);
  expect(await response.text()).not.toContain("credentials");
});
