import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/search/route";
import { moderationSearchResponseSchema } from "../schemas/contracts";
import { toolDefinitions } from "../server/mcp/tools";

function request(query: string, cookie?: string) {
  return new Request(`http://localhost:3006/api/v1/search?${query}`, {
    headers: cookie ? { Cookie: cookie } : {},
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("moderation search", () => {
  it("checks the current permission on each request and excludes removed offers", async () => {
    vi.stubEnv("ADMIN_IDENTITY_API_URL", "http://localhost:8000");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ allowed: true }))
      .mockResolvedValueOnce(Response.json({ allowed: false }));
    vi.stubGlobal("fetch", fetcher);
    const cookie = "other=ignore; erp_access_token=test-session";
    const response = await GET(
      request("scope=moderation&pageSize=100", cookie),
    );
    const { data } = moderationSearchResponseSchema.parse(
      await response.json(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(data.total).toBe(23);
    expect(
      new Set(data.items.map((item: { status: string }) => item.status)),
    ).toEqual(new Set(["active", "pending", "rejected", "blocked"]));
    expect(fetcher).toHaveBeenCalledWith(
      new URL("http://localhost:8000/auth/check?permission=offers%3Aapprove"),
      expect.objectContaining({
        headers: { Cookie: "erp_access_token=test-session" },
        cache: "no-store",
        redirect: "error",
      }),
    );
    const revoked = await GET(request("scope=moderation", cookie));
    expect(revoked.status).toBe(403);
    expect(await revoked.json()).toEqual({
      error: { code: "FORBIDDEN", message: expect.any(String) },
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("leaves public search and its MCP tool independent of Identity", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const implicit = await GET(request("pageSize=100"));
    const explicit = await GET(
      request("scope=public&pageSize=100", "erp_access_token=test"),
    );
    const body = await implicit.json();
    expect(explicit.status).toBe(200);
    expect(await explicit.json()).toEqual(body);
    expect(body.data.total).toBe(20);
    expect(body.data.items.every((item: object) => !("status" in item))).toBe(
      true,
    );
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      toolDefinitions.search.schema.safeParse({ scope: "moderation" }).success,
    ).toBe(false);
  });

  it("rejects missing login and invalid scope before contacting Identity", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const response = await GET(request("scope=moderation"));
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
    expect((await GET(request("scope=unknown"))).status).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    [401, {}, 401, "UNAUTHENTICATED"],
    [422, {}, 502, "IDENTITY_INVALID_RESPONSE"],
    [503, {}, 503, "IDENTITY_UNAVAILABLE"],
    [200, { allowed: "true" }, 503, "IDENTITY_UNAVAILABLE"],
  ])(
    "maps Identity %i to the agreed response",
    async (upstream, body, status, code) => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(Response.json(body, { status: upstream })),
      );
      const response = await GET(
        request("scope=moderation", "erp_access_token=test"),
      );
      expect(response.status).toBe(status);
      expect((await response.json()).error.code).toBe(code);
    },
  );

  it("fails closed when Identity cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const response = await GET(
      request("scope=moderation", "erp_access_token=test"),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe("IDENTITY_UNAVAILABLE");
  });

  it("does not log protected search text or session cookies", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const response = await GET(request("scope=moderation&q=private-notes"));
      expect(response.status).toBe(401);
      expect(JSON.parse(log.mock.calls[0][0]).query).toEqual({
        scope: "moderation",
      });
    } finally {
      log.mockRestore();
    }
  });
});
