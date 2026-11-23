import "server-only";
import { cookies, headers } from "next/headers";
import { timingSafeEqual } from "node:crypto";
export const demoMode = () => process.env.LOGISTICS_DEMO === "1";
export const cookieName = "logistics_demo_session";
export function sameSecret(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
export async function logisticsSession(): Promise<{
  email: string;
  demo: boolean;
} | null> {
  if (demoMode()) {
    const secret = process.env.LOGISTICS_DEMO_TOKEN;
    const value = (await cookies()).get(cookieName)?.value;
    return secret && value && sameSecret(secret, value)
      ? { email: "staff@logistics.demo", demo: true }
      : null;
  }
  const { auth } = await import("@/server/auth");
  const session = await auth.api.getSession({ headers: await headers() });
  const allowed = (process.env.LOGISTICS_STAFF_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return session && allowed.includes(session.user.email.toLowerCase())
    ? { email: session.user.email, demo: false }
    : null;
}
export function validOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    const source = new URL(origin);
    return (
      source.host === request.headers.get("host") &&
      ["http:", "https:"].includes(source.protocol)
    );
  } catch {
    return false;
  }
}
