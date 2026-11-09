import { z } from "zod";

export interface Product {
  productId: string;
  name: string;
  categoryId: string;
  priceMinor: number;
  currency: "EUR";
  tags: readonly string[];
  isPublished: boolean;
}

export type ProductSummary = Pick<
  Product,
  "productId" | "name" | "categoryId" | "priceMinor" | "currency"
>;

const searchFiltersSchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  minPriceMinor: z.number().int().nonnegative().optional(),
  maxPriceMinor: z.number().int().nonnegative().optional(),
}).refine(
  ({ minPriceMinor, maxPriceMinor }) =>
    minPriceMinor === undefined || maxPriceMinor === undefined ||
    minPriceMinor <= maxPriceMinor,
  { message: "Minimum price must not exceed maximum price", path: ["minPriceMinor"] },
);

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export interface SearchResult {
  items: ProductSummary[];
  total: number;
}

const compareLexically = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Search trusted catalog records; invalid filters throw a ZodError. */
export function searchProducts(
  products: readonly Product[],
  filters: SearchFilters = {},
): SearchResult {
  const { q, categoryId, minPriceMinor, maxPriceMinor } = searchFiltersSchema.parse(filters);
  const query = (q ?? "").trim().toLowerCase();
  const items = products
    .filter((product) =>
      product.isPublished &&
      product.name.toLowerCase().includes(query) &&
      (categoryId === undefined || product.categoryId === categoryId) &&
      (minPriceMinor === undefined || product.priceMinor >= minPriceMinor) &&
      (maxPriceMinor === undefined || product.priceMinor <= maxPriceMinor),
    )
    .map(({ productId, name, categoryId, priceMinor, currency }) => ({
      productId, name, categoryId, priceMinor, currency,
    }))
    .sort((a, b) => compareLexically(a.name, b.name) || compareLexically(a.productId, b.productId));

  return { items, total: items.length };
}
