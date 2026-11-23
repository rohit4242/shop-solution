import "server-only";
import { z } from "zod";

const userSchema = z.object({
  user_id: z.string().regex(/^usr_[0-9a-f]{32}$/),
  email: z.string(),
  display_name: z.string(),
  roles: z.array(z.string()),
  is_active: z.literal(true),
});
const permissionSchema = z.object({ allowed: z.boolean() });

function sessionCookie(request: Request) {
  const pair = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("erp_access_token="));
  return pair && pair.length > "erp_access_token=".length ? pair : undefined;
}

async function identityFetch(path: string, cookie: string, timeout: number) {
  return fetch(
    new URL(
      path,
      process.env.ADMIN_IDENTITY_API_URL?.trim() || "http://localhost:8000",
    ),
    {
      headers: { Cookie: cookie },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    },
  );
}

export async function readIdentitySession(request: Request) {
  const cookie = sessionCookie(request);
  if (!cookie) return { kind: "anonymous" } as const;
  const response = await identityFetch("/auth/session", cookie, 10_000).catch(
    () => undefined,
  );
  if (response?.status === 401) return { kind: "anonymous" } as const;
  if (!response?.ok) return { kind: "unavailable" } as const;
  const session = userSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  if (!session.success) return { kind: "invalid" } as const;
  return {
    kind: "authenticated",
    email: session.data.email,
    displayName: session.data.display_name,
  } as const;
}

export async function checkIdentityPermission(
  request: Request,
  permission: string,
) {
  const cookie = sessionCookie(request);
  if (!cookie) return "unauthenticated";
  const query = new URLSearchParams({ permission });
  const response = await identityFetch(
    `/auth/check?${query}`,
    cookie,
    8_000,
  ).catch(() => undefined);
  if (response?.status === 401) return "unauthenticated";
  if (response?.status === 403) return "forbidden";
  if (response && response.status >= 400 && response.status < 500)
    return "invalid";
  if (!response?.ok) return "unavailable";
  const result = permissionSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  if (!result.success) return "unavailable";
  return result.data.allowed ? "allowed" : "forbidden";
}
