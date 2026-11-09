import "server-only";
import { auth } from "@/features/admin-identity/server";
import { authorizeUser, modelProfiles, validateSettings } from "./policy";
import { runInputSchema } from "../../schemas/playground";
import { streamRun } from "./runner";
export async function playgroundAccess(request: Request) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });
    const status = authorizeUser(
      session?.user.id ?? null,
      process.env.PLAYGROUND_USER_IDS ?? "",
    );
    return { status, userId: status === 200 ? session!.user.id : null };
  } catch {
    return { status: 503, userId: null };
  }
}
function failure(status: number, message: string) {
  return Response.json(
    { error: { code: `PLAYGROUND_${status}`, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function playgroundConfig(request: Request) {
  const access = await playgroundAccess(request);
  if (access.status !== 200)
    return failure(
      access.status,
      access.status === 401
        ? "Sign in to continue."
        : access.status === 403
          ? "Your account is not approved for the playground."
          : "Authentication is unavailable.",
    );
  try {
    return Response.json(
      {
        userId: access.userId,
        enabled: process.env.PLAYGROUND_ENABLED === "true",
        profiles: modelProfiles(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return failure(503, "Model profiles are not configured correctly.");
  }
}
export async function playgroundRun(request: Request) {
  const access = await playgroundAccess(request);
  if (access.status !== 200)
    return failure(
      access.status,
      access.status === 401
        ? "Sign in to continue."
        : access.status === 403
          ? "Your account is not approved."
          : "Authentication is unavailable.",
    );
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return failure(403, "Same-origin requests are required.");
  if (process.env.PLAYGROUND_ENABLED !== "true")
    return failure(503, "The playground is disabled.");
  if (
    !process.env.CHAT_AI_API_KEY ||
    !process.env.CHAT_AI_BASE_URL ||
    !process.env.SEARCH_MCP_URL
  )
    return failure(503, "Model or MCP connection is not configured.");
  try {
    // Enforce a byte cap while reading, including requests without Content-Length.
    const reader = request.body?.getReader();
    if (!reader) return failure(400, "A JSON request is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 128_000) {
        await reader.cancel();
        return failure(413, "Request exceeds 128 KB.");
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const input = runInputSchema.parse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    const profile = validateSettings(input.settings, modelProfiles());
    return streamRun(input, profile, request.signal);
  } catch {
    return failure(
      400,
      "Invalid messages, model or settings. Check the configured model capabilities and limits.",
    );
  }
}
