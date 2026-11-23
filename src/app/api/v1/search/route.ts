import { handleDiscoveryRequest } from "@/features/search-recommendations/server";

export const dynamic = "force-dynamic";
const adminOrigin = "http://localhost:8000";

function allowsAdminOrigin(request: Request) {
  return (
    process.env.SEARCH_ENABLE_LOCAL_ADMIN_CORS === "true" &&
    request.headers.get("Origin") === adminOrigin
  );
}

function addAdminHeaders(headers: Headers) {
  headers.set("Access-Control-Allow-Origin", adminOrigin);
  headers.set("Access-Control-Allow-Credentials", "true");
}

export async function GET(request: Request) {
  const response = await handleDiscoveryRequest("search", request);
  response.headers.append("Vary", "Origin");
  if (allowsAdminOrigin(request)) addAdminHeaders(response.headers);
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
  if (
    !allowsAdminOrigin(request) ||
    method !== "GET" ||
    requestedHeaders.some((name) => name !== "content-type")
  ) {
    return new Response(null, { status: 403, headers });
  }

  addAdminHeaders(headers);
  headers.set("Access-Control-Allow-Methods", "GET");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(null, { status: 204, headers });
}
