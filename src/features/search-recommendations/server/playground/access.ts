import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";

// The playground spends our Chat AI key, so it is locked with one shared team
// code (PLAYGROUND_ACCESS_CODE). Entering the right code sets an httpOnly
// cookie holding a hash of the code; changing the env value logs everyone out.

const cookieName = "search_playground";
const thirtyDays = 60 * 60 * 24 * 30;
const unlockSchema = z.strictObject({ code: z.string().min(1).max(200) });

export type AccessStatus = 200 | 401 | 503;

const token = (code: string) =>
  createHash("sha256").update(`search-playground:${code}`).digest("hex");

function expectedToken(): string | null {
  const code = process.env.PLAYGROUND_ACCESS_CODE;
  return code ? token(code) : null;
}

function same(a: string, b: string) {
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return value.join("=");
  }
  return null;
}

function cookie(request: Request, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}

/**
 * True when the browser's Origin header matches the host it sent the request
 * to. Cross-site pages cannot forge either header. request.url is not used:
 * behind `next start` or a proxy it may name a different host.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    new URL(request.url).host;
  if (!origin) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** 200 with a valid code cookie, 401 without, 503 when no code is configured. */
export function playgroundAccess(request: Request): AccessStatus {
  const expected = expectedToken();
  if (!expected) return 503;
  const presented = readCookie(request, cookieName);
  return presented && same(presented, expected) ? 200 : 401;
}

export const accessMessages: Record<Exclude<AccessStatus, 200>, string> = {
  401: "Enter the team access code to continue.",
  503: "The playground has no access code configured.",
};

function reply(status: number, body: unknown, setCookie?: string) {
  const headers: Record<string, string> = { "Cache-Control": "no-store" };
  if (setCookie) headers["Set-Cookie"] = setCookie;
  return Response.json(body, { status, headers });
}

const failure = (status: number, message: string) =>
  reply(status, { error: { code: `PLAYGROUND_${status}`, message } });

/** POST { code }: sets the access cookie when the code is right. */
export async function playgroundUnlock(request: Request) {
  if (!isSameOrigin(request))
    return failure(403, "Same-origin requests are required.");
  const expected = expectedToken();
  if (!expected) return failure(503, accessMessages[503]);
  let code: string;
  try {
    const text = await request.text();
    if (text.length > 1_000) throw new Error("Too large");
    code = unlockSchema.parse(JSON.parse(text)).code;
  } catch {
    return failure(400, "Send the access code as JSON: { code }.");
  }
  const presented = token(code);
  if (!same(presented, expected)) {
    await new Promise((resolve) => setTimeout(resolve, 500)); // slow down guessing
    return failure(401, "That access code is not correct.");
  }
  return reply(200, { unlocked: true }, cookie(request, presented, thirtyDays));
}

/** DELETE: removes the access cookie from this browser. */
export function playgroundLock(request: Request) {
  return reply(200, { unlocked: false }, cookie(request, "", 0));
}
