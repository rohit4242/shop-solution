import { handleDiscoveryRequest } from "@/features/search-recommendations/server";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
  return handleDiscoveryRequest("similar", request);
}
