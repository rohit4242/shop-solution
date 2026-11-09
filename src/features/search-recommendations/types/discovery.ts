import type { z } from "zod";
import type {
  offerSchema,
  discoveryItemSchema,
  facetsQuerySchema,
  searchQuerySchema,
  autocompleteQuerySchema,
  recommendationQuerySchema,
} from "../schemas/contracts";
export type MarketplaceOffer = z.infer<typeof offerSchema>;
export type DiscoveryItem = z.infer<typeof discoveryItemSchema>;
export type Filters = z.infer<typeof facetsQuerySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
export interface OfferSource {
  loadOffers(): Promise<unknown>;
}
export interface PurchaseSource {
  loadPurchaseGroups(): Promise<unknown>;
}
export type IndexedOffer = Readonly<
  Omit<MarketplaceOffer, "attributes" | "imageUrls"> & {
    attributes: Readonly<Record<string, string>>;
    imageUrls: readonly string[];
  }
>;
export interface CatalogSnapshot {
  readonly offers: readonly IndexedOffer[];
}
