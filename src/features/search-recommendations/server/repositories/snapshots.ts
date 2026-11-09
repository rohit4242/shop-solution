import "server-only";
import { catalogSchema, purchaseGroupsSchema } from "../../schemas/contracts";
import type {
  CatalogSnapshot,
  OfferSource,
  PurchaseSource,
} from "../../types/discovery";
import { DiscoveryError } from "../services/errors";
// A rejected initialization is not cached; successful immutable snapshots live for this process.
function lazySnapshot<T>(
  load: () => Promise<T>,
  code: string,
  message: string,
) {
  let pending: Promise<T> | undefined;
  return () => {
    if (!pending)
      pending = load().catch(() => {
        pending = undefined;
        throw new DiscoveryError(code, 503, message);
      });
    return pending;
  };
}
export function createCatalogLoader(source: OfferSource) {
  return lazySnapshot<CatalogSnapshot>(
    async () => {
      const offers = catalogSchema.parse(await source.loadOffers());
      return Object.freeze({
        offers: Object.freeze(
          offers
            .filter((o) => o.status === "active")
            .map((o) =>
              Object.freeze({
                ...o,
                attributes: Object.freeze(o.attributes),
                imageUrls: Object.freeze(o.imageUrls),
              }),
            ),
        ),
      });
    },
    "CATALOG_UNAVAILABLE",
    "Catalog data is temporarily unavailable.",
  );
}
export function createPurchaseLoader(source: PurchaseSource) {
  return lazySnapshot(
    async () =>
      Object.freeze(
        purchaseGroupsSchema.parse(await source.loadPurchaseGroups()).map((g) =>
          Object.freeze({
            purchaseId: g.purchaseId,
            productIds: Object.freeze([...new Set(g.productIds)]),
          }),
        ),
      ),
    "RECOMMENDATION_DATA_UNAVAILABLE",
    "Purchase data is temporarily unavailable.",
  );
}
