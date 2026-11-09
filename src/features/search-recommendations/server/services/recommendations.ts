import "server-only";
import type {
  CatalogSnapshot,
  RecommendationQuery,
} from "../../types/discovery";
import { compare } from "../../utils/text";
import { publicItem } from "./discovery";
import { DiscoveryError } from "./errors";
export function sourceProduct(snapshot: CatalogSnapshot, productId: string) {
  const source = snapshot.offers.find((o) => o.productId === productId);
  if (!source)
    throw new DiscoveryError("PRODUCT_NOT_FOUND", 404, "Product not found.");
  return source;
}
export function similar(snapshot: CatalogSnapshot, q: RecommendationQuery) {
  const source = sourceProduct(snapshot, q.productId);
  const shared = (attrs: Readonly<Record<string, string>>) =>
    Object.entries(source.attributes).filter(([k, v]) => attrs[k] === v).length;
  return {
    items: snapshot.offers
      .filter(
        (o) =>
          o.productId !== source.productId &&
          o.category === source.category &&
          (!q.availability || o.availability === q.availability),
      )
      .sort(
        (a, b) =>
          shared(b.attributes) - shared(a.attributes) ||
          Math.abs(a.priceMinor - source.priceMinor) -
            Math.abs(b.priceMinor - source.priceMinor) ||
          compare(a.productId, b.productId),
      )
      .slice(0, q.limit)
      .map(publicItem),
  };
}
export function alsoBought(
  snapshot: CatalogSnapshot,
  q: RecommendationQuery,
  groups: readonly { readonly productIds: readonly string[] }[],
) {
  sourceProduct(snapshot, q.productId);
  const counts = new Map<string, number>();
  for (const group of groups)
    if (group.productIds.includes(q.productId))
      for (const id of new Set(group.productIds))
        if (id !== q.productId) counts.set(id, (counts.get(id) ?? 0) + 1);
  return {
    items: snapshot.offers
      .filter(
        (o) =>
          counts.has(o.productId) &&
          (!q.availability || o.availability === q.availability),
      )
      .sort(
        (a, b) =>
          (counts.get(b.productId) ?? 0) - (counts.get(a.productId) ?? 0) ||
          compare(a.productId, b.productId),
      )
      .slice(0, q.limit)
      .map(publicItem),
  };
}
