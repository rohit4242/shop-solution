import { readIdentitySession } from "@/features/admin-identity/server";

function jsonResponse(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const session = await readIdentitySession(request);
  switch (session.kind) {
    case "anonymous":
      return jsonResponse({ authenticated: false });
    case "authenticated":
      return jsonResponse({
        authenticated: true,
        email: session.email,
        displayName: session.displayName,
      });
    case "invalid":
      return jsonResponse(
        {
          error: {
            code: "IDENTITY_SESSION_INVALID_RESPONSE",
            message:
              "The Admin & Identity service returned an invalid session response.",
          },
        },
        502,
      );
    case "unavailable":
      return jsonResponse(
        {
          error: {
            code: "IDENTITY_SESSION_UNAVAILABLE",
            message:
              "Could not check the Admin & Identity session. Search remains available; try again.",
          },
        },
        503,
      );
  }
}
