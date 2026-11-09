import { createOpenApiDocument } from "@/features/search-recommendations/server";
export function GET() {
  return Response.json(createOpenApiDocument(), {
    headers: {
      "Content-Disposition":
        'attachment; filename="search-recommendations.openapi.json"',
    },
  });
}
