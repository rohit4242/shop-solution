import { afterEach, describe, expect, it, vi } from "vitest";
import { checkIdentityPermission } from "@/features/admin-identity/server";
import { auth } from "@/server/auth";
import { checkMarketingManager } from "../server/session";

vi.mock("@/features/admin-identity/server", () => ({
  checkIdentityPermission: vi.fn(),
}));
vi.mock("@/server/auth", () => ({ auth: { api: { getSession: vi.fn() } } }));

const request = () =>
  new Request("http://localhost/api/v1/marketing/promotions");
const session = (email: string) => ({ user: { email } }) as never;

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("identity mode (default): the shared Admin & Identity login", () => {
  it.each([
    ["allowed", { ok: true }],
    ["unauthenticated", { ok: false, status: 401 }],
    ["forbidden", { ok: false, status: 403 }],
    ["invalid", { ok: false, status: 503 }],
    ["unavailable", { ok: false, status: 503 }],
  ] as const)("maps %s", async (result, expected) => {
    vi.mocked(checkIdentityPermission).mockResolvedValue(result);
    expect(await checkMarketingManager(request())).toEqual(expected);
    expect(checkIdentityPermission).toHaveBeenCalledWith(
      expect.any(Request),
      "marketing_manager",
    );
  });

  it("uses MARKETING_MANAGER_PERMISSION when set", async () => {
    vi.stubEnv("MARKETING_MANAGER_PERMISSION", "marketing.promotions.manage");
    vi.mocked(checkIdentityPermission).mockResolvedValue("allowed");
    await checkMarketingManager(request());
    expect(checkIdentityPermission).toHaveBeenCalledWith(
      expect.any(Request),
      "marketing.promotions.manage",
    );
  });
});

describe("local mode: Better Auth session + MARKETING_MANAGER_EMAILS", () => {
  it("is 401 without a session", async () => {
    vi.stubEnv("MARKETING_AUTH_MODE", "local");
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    expect(await checkMarketingManager(request())).toEqual({
      ok: false,
      status: 401,
    });
  });

  it("allows a listed email (case-insensitive) and forbids others", async () => {
    vi.stubEnv("MARKETING_AUTH_MODE", "local");
    vi.stubEnv(
      "MARKETING_MANAGER_EMAILS",
      " manager@shop.test , other@shop.test",
    );
    vi.mocked(auth.api.getSession).mockResolvedValue(
      session("Manager@Shop.test"),
    );
    expect(await checkMarketingManager(request())).toEqual({ ok: true });
    vi.mocked(auth.api.getSession).mockResolvedValue(
      session("customer@shop.test"),
    );
    expect(await checkMarketingManager(request())).toEqual({
      ok: false,
      status: 403,
    });
  });

  it("forbids everyone when the list is empty", async () => {
    vi.stubEnv("MARKETING_AUTH_MODE", "local");
    vi.mocked(auth.api.getSession).mockResolvedValue(
      session("manager@shop.test"),
    );
    expect(await checkMarketingManager(request())).toEqual({
      ok: false,
      status: 403,
    });
  });
});
