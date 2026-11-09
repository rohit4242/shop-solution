import "server-only";
import type {
  AutocompleteQuery,
  CatalogSnapshot,
  DiscoveryItem,
  Filters,
  IndexedOffer,
  SearchQuery,
} from "../../types/discovery";
import { compare, normalize, tokens } from "../../utils/text";
export function publicItem(o: IndexedOffer): DiscoveryItem {
  return {
    offerId: o.offerId,
    productId: o.productId,
    sellerId: o.sellerId,
    name: o.name,
    category: o.category,
    imageUrls: [...o.imageUrls],
    priceMinor: o.priceMinor,
    currency: o.currency,
    availability: o.availability,
  };
}
export function relevance(o: IndexedOffer, q: string): number | null {
  const terms = [...new Set(tokens(q))];
  if (!terms.length) return q.trim() ? null : 0;
  const fields: [string[], number][] = [
    [tokens(o.name), 4],
    [tokens(o.category), 2],
    [tokens(Object.entries(o.attributes).flat().join(" ")), 2],
    [tokens(o.description), 1],
  ];
  let score = 0;
  for (const term of terms) {
    const weight = fields.find(([words]) =>
      words.some((word) => word.includes(term)),
    )?.[1];
    if (!weight) return null;
    score += weight;
  }
  return score + (normalize(o.name) === normalize(q) ? 10 : 0);
}
export function matches(o: IndexedOffer, f: Filters): boolean {
  return (
    relevance(o, f.q) !== null &&
    (!f.category || o.category === f.category) &&
    (!f.sellerId || o.sellerId === f.sellerId) &&
    (!f.availability || o.availability === f.availability) &&
    (f.minPriceMinor === undefined || o.priceMinor >= f.minPriceMinor) &&
    (f.maxPriceMinor === undefined || o.priceMinor <= f.maxPriceMinor)
  );
}
const byName = (a: IndexedOffer, b: IndexedOffer) =>
  compare(normalize(a.name), normalize(b.name)) ||
  compare(a.productId, b.productId);
export function search(snapshot: CatalogSnapshot, q: SearchQuery) {
  const ranked = snapshot.offers
    .filter((o) => matches(o, q))
    .map((o) => ({ offer: o, score: relevance(o, q.q) ?? 0 }));
  ranked.sort(
    (a, b) =>
      (q.sort === "relevance"
        ? b.score - a.score
        : q.sort === "price_asc"
          ? a.offer.priceMinor - b.offer.priceMinor
          : q.sort === "price_desc"
            ? b.offer.priceMinor - a.offer.priceMinor
            : 0) || byName(a.offer, b.offer),
  );
  const offset = (q.page - 1) * q.pageSize;
  return {
    items: ranked
      .slice(offset, offset + q.pageSize)
      .map((x) => publicItem(x.offer)),
    total: ranked.length,
    page: q.page,
    pageSize: q.pageSize,
  };
}
export function facets(snapshot: CatalogSnapshot, f: Filters) {
  function counts(key: "category" | "sellerId" | "availability") {
    const count = new Map<string, number>();
    for (const o of snapshot.offers)
      if (matches(o, { ...f, [key]: undefined }))
        count.set(o[key], (count.get(o[key]) ?? 0) + 1);
    return [...count].sort(([a], [b]) => compare(a, b));
  }
  const prices = snapshot.offers
    .filter((o) =>
      matches(o, { ...f, minPriceMinor: undefined, maxPriceMinor: undefined }),
    )
    .map((o) => o.priceMinor);
  return {
    categories: counts("category").map(([category, count]) => ({
      category,
      count,
    })),
    sellers: counts("sellerId").map(([sellerId, count]) => ({
      sellerId,
      count,
    })),
    availability: counts("availability").map(([availability, count]) => ({
      availability,
      count,
    })),
    priceRange: prices.length
      ? {
          minPriceMinor: Math.min(...prices),
          maxPriceMinor: Math.max(...prices),
        }
      : null,
  };
}
export function autocomplete(snapshot: CatalogSnapshot, q: AutocompleteQuery) {
  return {
    suggestions: snapshot.offers
      .filter(
        (o) =>
          normalize(o.name).startsWith(normalize(q.q)) &&
          (!q.category || o.category === q.category) &&
          (!q.availability || o.availability === q.availability),
      )
      .sort(byName)
      .slice(0, q.limit)
      .map(({ productId, name }) => ({ productId, name })),
  };
}
