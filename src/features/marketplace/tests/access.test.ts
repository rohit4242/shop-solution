import { afterEach, describe, expect, it } from "vitest";
import { permissionsFor, requirePermission } from "../server/access";
import { MarketplaceError } from "../server/errors";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("permissions (interim rules)", () => {
  it("lets every signed-in user sell, and only listed e-mails moderate", () => {
    process.env.MARKETPLACE_MODERATOR_EMAILS =
      " Mod@Example.com , other@example.com";
    expect([...permissionsFor("seller@example.com")]).toEqual([
      "marketplace:sell",
    ]);
    expect(
      permissionsFor("mod@example.com").has("marketplace:moderate-offers"),
    ).toBe(true);
    expect(
      permissionsFor("mod@example.com").has("marketplace:verify-sellers"),
    ).toBe(true);
  });

  it("answers 401 without a session and 403 without the permission", () => {
    const status = (run: () => unknown) => {
      try {
        run();
      } catch (error) {
        return error instanceof MarketplaceError ? error.status : -1;
      }
      return 200;
    };
    const seller = {
      userId: "u1",
      email: "s@x.de",
      permissions: permissionsFor("s@x.de"),
    };
    expect(status(() => requirePermission(null, "marketplace:sell"))).toBe(401);
    expect(
      status(() => requirePermission(seller, "marketplace:moderate-offers")),
    ).toBe(403);
    expect(status(() => requirePermission(seller, "marketplace:sell"))).toBe(
      200,
    );
  });
});
