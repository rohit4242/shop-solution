import "server-only";
import { randomUUID } from "node:crypto";
import { endpointDefinitions } from "../../docs/registry";
import { ZodError } from "zod";
import {
  searchQuerySchema,
  facetsQuerySchema,
  autocompleteQuerySchema,
  recommendationQuerySchema,
} from "../../schemas/contracts";
import type { OfferSource, PurchaseSource } from "../../types/discovery";
import {
  createCatalogLoader,
  createPurchaseLoader,
} from "../repositories/snapshots";
import {
  mockOfferSource,
  mockPurchaseSource,
} from "../repositories/mock-sources";
import { search, facets, autocomplete } from "./discovery";
import { similar, alsoBought, sourceProduct } from "./recommendations";
import { DiscoveryError } from "./errors";
export type Operation =
  "search" | "facets" | "autocomplete" | "similar" | "also-bought";
export function createDiscoveryApi(
  offers: OfferSource,
  purchases: PurchaseSource,
) {
  const catalog = createCatalogLoader(offers),
    purchaseGroups = createPurchaseLoader(purchases);
  return async (operation: Operation, request: Request): Promise<Response> => {
    const requestId = randomUUID(),
      started = performance.now();
    let status = 200;
    const headers = { "Cache-Control": "no-store", "X-Request-ID": requestId };
    try {
      const params: Record<string, string> = Object.create(null);
      for (const [key, value] of new URL(request.url).searchParams) {
        if (Object.hasOwn(params, key))
          throw new DiscoveryError(
            "INVALID_INPUT",
            400,
            "Repeated query parameters are not allowed.",
          );
        params[key] = value;
      }
      // Validate before loading either dependency.
      let data: unknown;
      if (operation === "search") {
        const q = searchQuerySchema.parse(params);
        data = search(await catalog(), q);
      } else if (operation === "facets") {
        const q = facetsQuerySchema.parse(params);
        data = facets(await catalog(), q);
      } else if (operation === "autocomplete") {
        const q = autocompleteQuerySchema.parse(params);
        data = autocomplete(await catalog(), q);
      } else {
        const q = recommendationQuerySchema.parse(params),
          snapshot = await catalog();
        sourceProduct(snapshot, q.productId);
        data =
          operation === "similar"
            ? similar(snapshot, q)
            : alsoBought(snapshot, q, await purchaseGroups());
      }
      return Response.json({ data }, { headers });
    } catch (error) {
      const failure =
        error instanceof DiscoveryError
          ? error
          : error instanceof ZodError
            ? new DiscoveryError(
                "INVALID_INPUT",
                400,
                "Invalid query parameters. See the endpoint documentation.",
              )
            : new DiscoveryError(
                "INTERNAL_ERROR",
                500,
                "An unexpected error occurred.",
              );
      status = failure.status;
      return Response.json(
        { error: { code: failure.code, message: failure.message } },
        { status: failure.status, headers },
      );
    } finally {
      const url = new URL(request.url);
      const allowed = new Set(
        endpointDefinitions[operation].parameters.map((p) => p.name),
      );
      console.info(
        JSON.stringify({
          type: "discovery-request",
          requestId,
          operation,
          method: request.method,
          path: url.pathname,
          query: Object.fromEntries(
            [...url.searchParams].filter(([key]) => allowed.has(key)),
          ),
          status,
          durationMs: Math.round(performance.now() - started),
        }),
      );
    }
  };
}
export const handleDiscoveryRequest = createDiscoveryApi(
  mockOfferSource,
  mockPurchaseSource,
);
