import "server-only";
import { timingSafeEqual } from "node:crypto";
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
 * Interim permission rules until Admin & Identity defines roles:
 * every signed-in user may run a shop; moderators are listed by e-mail in
 * MARKETPLACE_MODERATOR_EMAILS. Replace this function, not its callers.
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

/** The Better Auth session behind these request headers, or null. */
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

/**
 * Service-to-service callers (the order owner, Accounting) send
 * `Authorization: Bearer <MARKETPLACE_SERVICE_TOKEN>`. Interim until the class
 * agrees how services authenticate; with no token configured, nobody passes.
 */
export function isServiceCaller(headers: Headers): boolean {
  const expected = process.env.MARKETPLACE_SERVICE_TOKEN?.trim();
  const given = headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
