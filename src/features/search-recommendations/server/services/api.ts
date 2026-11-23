import "server-only";
import { checkIdentityPermission } from "@/features/admin-identity/server";
import { randomUUID } from "node:crypto";
import { endpointDefinitions } from "../../docs/endpoints";
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
import { search, facets, autocomplete, publicItem } from "./discovery";
import { similar, alsoBought, sourceProduct } from "./recommendations";
import { DiscoveryError } from "./errors";
export type Operation =
  "search" | "facets" | "autocomplete" | "similar" | "also-bought";
const moderationFailures = {
  unauthenticated: new DiscoveryError(
    "UNAUTHENTICATED",
    401,
    "Sign in to use moderation search.",
  ),
  forbidden: new DiscoveryError(
    "FORBIDDEN",
    403,
    "Offer moderation permission is required.",
  ),
  unavailable: new DiscoveryError(
    "IDENTITY_UNAVAILABLE",
    503,
    "Could not check offer moderation permission.",
  ),
  invalid: new DiscoveryError(
    "IDENTITY_INVALID_RESPONSE",
    502,
    "Identity rejected the permission check unexpectedly.",
  ),
};
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
        if (q.scope === "moderation") {
          const permission = await checkIdentityPermission(
            request,
            "offers:approve",
          );
          if (permission !== "allowed") throw moderationFailures[permission];
          data = search((await catalog()).moderation, q, (offer) => ({
            ...publicItem(offer),
            status: offer.status,
          }));
        } else {
          data = search((await catalog()).public, q, publicItem);
        }
      } else if (operation === "facets") {
        const q = facetsQuerySchema.parse(params);
        data = facets((await catalog()).public, q);
      } else if (operation === "autocomplete") {
        const q = autocompleteQuerySchema.parse(params);
        data = autocomplete((await catalog()).public, q);
      } else {
        const q = recommendationQuerySchema.parse(params),
          snapshot = (await catalog()).public;
        if (operation === "also-bought") sourceProduct(snapshot, q.productId);
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
      const moderation =
        operation === "search" &&
        url.searchParams.getAll("scope").includes("moderation");
      console.info(
        JSON.stringify({
          type: "discovery-request",
          requestId,
          operation,
          method: request.method,
          path: url.pathname,
          query: moderation
            ? { scope: "moderation" }
            : Object.fromEntries(
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
