import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isSameOrigin,
  playgroundLock,
  playgroundUnlock,
} from "../server/playground/access";
import { playgroundConfig, playgroundRun } from "../server/playground/http";

const base = "http://localhost/api/search-playground";
const unlock = (code: unknown, origin = "http://localhost") =>
  playgroundUnlock(
    new Request(`${base}/unlock`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ code }),
    }),
  );
const cookieFrom = (response: Response) =>
  (response.headers.get("set-cookie") ?? "").split(";")[0];

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("PLAYGROUND_ACCESS_CODE", "team-code-123");
});

describe("playground access code", () => {
  it("is closed (503) when no access code is configured", async () => {
    vi.stubEnv("PLAYGROUND_ACCESS_CODE", "");
    expect((await playgroundConfig(new Request(`${base}/config`))).status).toBe(
      503,
    );
    expect((await unlock("anything")).status).toBe(503);
  });

  it("rejects a missing or wrong code and never sets a cookie", async () => {
    expect((await playgroundConfig(new Request(`${base}/config`))).status).toBe(
      401,
    );
    const wrong = await unlock("guess");
    expect(wrong.status).toBe(401);
    expect(wrong.headers.get("set-cookie")).toBeNull();
    expect((await unlock("")).status).toBe(400);
    expect((await unlock("team-code-123", "https://evil.example")).status).toBe(
      403,
    );
  });

  it("unlocks with the right code: httpOnly cookie that hides the code itself", async () => {
    const response = await unlock("team-code-123");
    expect(response.status).toBe(200);
    const header = response.headers.get("set-cookie") ?? "";
    expect(header).toContain("HttpOnly");
    expect(header).toContain("SameSite=Strict");
    expect(header).not.toContain("team-code-123");
    const config = await playgroundConfig(
      new Request(`${base}/config`, {
        headers: { cookie: cookieFrom(response) },
      }),
    );
    expect(config.status).toBe(200);
    expect(await config.json()).toEqual({ enabled: false, profiles: [] });
  });

  it("logs everyone out when the code changes, and lock clears the cookie", async () => {
    const cookie = cookieFrom(await unlock("team-code-123"));
    vi.stubEnv("PLAYGROUND_ACCESS_CODE", "new-code");
    expect(
      (
        await playgroundConfig(
          new Request(`${base}/config`, { headers: { cookie } }),
        )
      ).status,
    ).toBe(401);
    const locked = playgroundLock(
      new Request(`${base}/unlock`, { method: "DELETE" }),
    );
    expect(locked.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});

describe("playground runs", () => {
  it("deny cross-origin and disabled runs before calling any provider", async () => {
    const cookie = cookieFrom(await unlock("team-code-123"));
    const run = (origin: string) =>
      playgroundRun(
        new Request(`${base}/run`, {
          method: "POST",
          headers: { origin, cookie },
        }),
      );
    expect((await run("https://evil.example")).status).toBe(403);
    expect((await run("http://localhost")).status).toBe(503);
  });
});

describe("same-origin check", () => {
  const request = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/search-playground/unlock", {
      method: "POST",
      headers,
    });
  it("compares Origin with the Host the browser used, not request.url", () => {
    // `next start` reports localhost in request.url even when the browser used 127.0.0.1.
    expect(
      isSameOrigin(
        request({ origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" }),
      ),
    ).toBe(true);
    expect(
      isSameOrigin(
        request({
          origin: "https://shop.vercel.app",
          "x-forwarded-host": "shop.vercel.app",
          host: "internal:3000",
        }),
      ),
    ).toBe(true);
  });
  it("rejects missing, malformed and foreign origins", () => {
    expect(isSameOrigin(request({ host: "127.0.0.1:3000" }))).toBe(false);
    expect(
      isSameOrigin(request({ origin: "not a url", host: "127.0.0.1:3000" })),
    ).toBe(false);
    expect(
      isSameOrigin(
        request({ origin: "https://evil.example", host: "127.0.0.1:3000" }),
      ),
    ).toBe(false);
  });
});
