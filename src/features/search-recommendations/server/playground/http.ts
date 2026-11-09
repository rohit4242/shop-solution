import "server-only";
import { modelProfiles, validateSettings } from "./policy";
import { accessMessages, isSameOrigin, playgroundAccess } from "./access";
import { runInputSchema } from "../../schemas/playground";
import { streamRun } from "./runner";
function failure(status: number, message: string) {
  return Response.json(
    { error: { code: `PLAYGROUND_${status}`, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
export async function playgroundConfig(request: Request) {
  const access = playgroundAccess(request);
  if (access !== 200) return failure(access, accessMessages[access]);
  try {
    return Response.json(
      {
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
  const access = playgroundAccess(request);
  if (access !== 200) return failure(access, accessMessages[access]);
  if (!isSameOrigin(request))
    return failure(403, "Same-origin requests are required.");
  if (process.env.PLAYGROUND_ENABLED !== "true")
    return failure(503, "The playground is disabled.");
  if (!process.env.OPENAI_API_KEY)
    return failure(503, "The model connection is not configured.");
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
