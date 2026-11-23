import { handleDiscoveryRequest } from "@/features/search-recommendations/server";

export const dynamic = "force-dynamic";
function allowedAdminOrigin(request: Request) {
  if (process.env.SEARCH_ENABLE_LOCAL_ADMIN_CORS !== "true") return;
  const url = URL.parse(
    process.env.SEARCH_ADMIN_UI_ORIGIN?.trim() || "http://localhost:8000",
  );
  if (
    url &&
    (url.protocol === "https:" || url.protocol === "http:") &&
    url.href === `${url.origin}/` &&
    request.headers.get("Origin") === url.origin
  ) {
    return url.origin;
  }
}

function addAdminHeaders(headers: Headers, origin: string) {
  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Credentials", "true");
}

export async function GET(request: Request) {
  const response = await handleDiscoveryRequest("search", request);
  response.headers.append("Vary", "Origin");
  const origin = allowedAdminOrigin(request);
  if (origin) addAdminHeaders(response.headers, origin);
  return response;
}

export function OPTIONS(request: Request) {
  const headers = new Headers({
    Allow: "GET, HEAD, OPTIONS",
    "Cache-Control": "no-store",
    Vary: "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
  });
  const method = request.headers.get("Access-Control-Request-Method");
  if (!method) return new Response(null, { status: 204, headers });

  const requestedHeaders = (
    request.headers.get("Access-Control-Request-Headers") ?? ""
  )
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter(Boolean);
  const origin = allowedAdminOrigin(request);
  if (
    !origin ||
    method !== "GET" ||
    requestedHeaders.some((name) => name !== "content-type")
  ) {
    return new Response(null, { status: 403, headers });
  }

  addAdminHeaders(headers, origin);
  headers.set("Access-Control-Allow-Methods", "GET");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(null, { status: 204, headers });
}
