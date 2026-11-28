import "server-only";
import { forbidden, unauthenticated } from "./errors";

export type Permission =
  | "marketplace:sell"
  | "marketplace:verify-sellers"
  | "marketplace:moderate-offers";

/** The signed-in person a request acts for. Never built from browser-supplied IDs. */
export type Actor = {
  userId: string;
  email: string;
  permissions: ReadonlySet<Permission>;
};

const emailList = (value: string | undefined) =>
  new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );

/**
 * Interim permission rules until Admin & Identity publishes `checkShopPermission`
 * (docs/authentication.md): every signed-in user may open a shop; moderators
 * are listed by e-mail in MARKETPLACE_MODERATOR_EMAILS. Access to a specific
 * shop is never a permission: it is the `SellerMember` row (services/sellers.ts).
 * Replace this function, not its callers.
 */
export function permissionsFor(email: string): Set<Permission> {
  const permissions = new Set<Permission>(["marketplace:sell"]);
  if (
    emailList(process.env.MARKETPLACE_MODERATOR_EMAILS).has(email.toLowerCase())
  ) {
    permissions.add("marketplace:verify-sellers");
    permissions.add("marketplace:moderate-offers");
  }
  return permissions;
}

/**
 * The Better Auth session behind these request headers, or null. Interim
 * until Admin & Identity ships `readShopActor` in its server entry point.
 */
export async function readActor(headers: Headers): Promise<Actor | null> {
  const { auth } = await import("@/server/auth");
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
    permissions: permissionsFor(session.user.email),
  };
}

export function requirePermission(
  actor: Actor | null,
  permission: Permission,
): Actor {
  if (!actor) throw unauthenticated();
  if (!actor.permissions.has(permission))
    throw forbidden("Your account lacks permission for this operation.");
  return actor;
}
