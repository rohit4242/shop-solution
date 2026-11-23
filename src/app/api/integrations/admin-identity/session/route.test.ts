import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const userResponse = {
  user_id: "usr_00000000000000000000000000000001",
  email: "admin@example.com",
  display_name: "Admin",
  roles: ["admin"],
  is_active: true,
};

function request(cookie?: string) {
  return new Request(
    "http://localhost/api/integrations/admin-identity/session",
    {
      headers: cookie ? { cookie } : undefined,
    },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Admin & Identity session integration", () => {
  it.each([
    [" ", "http://localhost:8000/auth/session"],
    [
      "https://identity.example.test",
      "https://identity.example.test/auth/session",
    ],
  ])("resolves the Identity API URL from %j", async (base, expected) => {
    vi.stubEnv("ADMIN_IDENTITY_API_URL", base);
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 401 }));
    vi.stubGlobal("fetch", fetchMock);
    await GET(request("erp_access_token=shared-token"));
    expect(fetchMock).toHaveBeenCalledWith(
      new URL(expected),
      expect.any(Object),
    );
  });

  it("returns anonymous without calling Identity when the shared cookie is absent", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("forwards only the shared Identity cookie and returns a minimal session", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json(userResponse, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      request("other_cookie=ignored; erp_access_token=shared-token"),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      new URL("http://localhost:8000/auth/session"),
      expect.objectContaining({
        headers: { Cookie: "erp_access_token=shared-token" },
        cache: "no-store",
      }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      authenticated: true,
      email: "admin@example.com",
      displayName: "Admin",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("treats an expired shared session as anonymous", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );

    const response = await GET(request("erp_access_token=expired"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: false });
  });

  it("reports Identity outages without blocking discovery APIs", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("connection refused")),
    );

    const response = await GET(request("erp_access_token=shared-token"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: {
        code: "IDENTITY_SESSION_UNAVAILABLE",
        message:
          "Could not check the Admin & Identity session. Search remains available; try again.",
      },
    });
  });

  it("rejects malformed Identity responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({})));

    const response = await GET(request("erp_access_token=shared-token"));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        code: "IDENTITY_SESSION_INVALID_RESPONSE",
        message:
          "The Admin & Identity service returned an invalid session response.",
      },
    });
  });
});
