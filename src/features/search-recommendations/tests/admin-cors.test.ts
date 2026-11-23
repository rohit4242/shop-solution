import { afterEach, describe, expect, it, vi } from "vitest";
import * as route from "@/app/api/v1/search/route";

const admin = "http://localhost:8000";
const url = "http://localhost:3006/api/v1/search?scope=moderation";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("local Admin moderation CORS", () => {
  it("returns credentialed CORS on authorized and denied browser requests", async () => {
    vi.stubEnv("SEARCH_ENABLE_LOCAL_ADMIN_CORS", "true");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ allowed: true }))
        .mockResolvedValueOnce(Response.json({ allowed: false })),
    );
    for (const status of [200, 403, 401]) {
      const response = await route.GET(
        new Request(url, {
          headers:
            status === 401
              ? { Origin: admin }
              : { Origin: admin, Cookie: "erp_access_token=test-session" },
        }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("access-control-allow-origin")).toBe(admin);
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
      expect(response.headers.get("vary")).toContain("Origin");
    }
  });

  it("withholds CORS from other origins and when the local option is off", async () => {
    for (const [enabled, origin] of [
      ["true", "http://localhost:8001"],
      ["false", admin],
    ]) {
      vi.stubEnv("SEARCH_ENABLE_LOCAL_ADMIN_CORS", enabled);
      const response = await route.GET(
        new Request(url, { headers: { Origin: origin } }),
      );
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(
        response.headers.get("access-control-allow-credentials"),
      ).toBeNull();
    }
  });

  it("allows a GET preflight with Content-Type and rejects unsupported methods or headers", async () => {
    vi.stubEnv("SEARCH_ENABLE_LOCAL_ADMIN_CORS", "true");
    for (const [method, header, status] of [
      ["GET", "content-type", 204],
      ["POST", "content-type", 403],
      ["GET", "authorization", 403],
    ] as const) {
      const response = await route.OPTIONS(
        new Request(url, {
          method: "OPTIONS",
          headers: {
            Origin: admin,
            "Access-Control-Request-Method": method,
            "Access-Control-Request-Headers": header,
          },
        }),
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        status === 204 ? admin : null,
      );
    }
  });
});
