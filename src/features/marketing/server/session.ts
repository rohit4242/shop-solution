import "server-only";

import { checkIdentityPermission } from "@/features/admin-identity/server";

// Who may manage promotions. Two modes (MARKETING_AUTH_MODE):
// - "identity" (default): the shared login. Admin & Identity checks the permission
//   MARKETING_MANAGER_PERMISSION (default "marketing_manager") for the erp_access_token cookie.
// - "local": a Better Auth session in this app whose email is listed in MARKETING_MANAGER_EMAILS.
//   For local runs and system tests while the Identity service is not running.
// Never trust a browser-supplied role: both modes decide on the server.

export const MARKETING_MANAGER = "marketing_manager";

export type ManagerCheck =
  { ok: true } | { ok: false; status: 401 | 403 | 503 };

async function checkLocal(request: Request): Promise<ManagerCheck> {
  const { auth } = await import("@/server/auth");
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return { ok: false, status: 401 };
  const allowed = (process.env.MARKETING_MANAGER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(session.user.email.toLowerCase())
    ? { ok: true }
    : { ok: false, status: 403 };
}

async function checkIdentity(request: Request): Promise<ManagerCheck> {
  const permission =
    process.env.MARKETING_MANAGER_PERMISSION?.trim() || MARKETING_MANAGER;
  const result = await checkIdentityPermission(request, permission);
  if (result === "allowed") return { ok: true };
  if (result === "unauthenticated") return { ok: false, status: 401 };
  if (result === "forbidden") return { ok: false, status: 403 };
  return { ok: false, status: 503 };
}

export function checkMarketingManager(request: Request): Promise<ManagerCheck> {
  return process.env.MARKETING_AUTH_MODE === "local"
    ? checkLocal(request)
    : checkIdentity(request);
}
