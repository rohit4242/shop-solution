export interface Product {
  productId: string;
  name: string;
  categoryId: string;
  priceMinor: number;
  currency: string;
  tags: readonly string[];
  isPublished: boolean;
}

export interface SearchFilters {
  query?: string;
  categoryId?: string;
  minPriceMinor?: number;
  maxPriceMinor?: number;
}

export type ProductSummary = Pick<
  Product,
  'productId' | 'name' | 'categoryId' | 'priceMinor' | 'currency'
>;

export interface SearchResult {
  products: ProductSummary[];
  total: number;
}

const lexicalCompare = (a: string, b: string): number =>
  a < b ? -1 : a > b ? 1 : 0;

/** Prices are integer minor units; category IDs and sorting are case-sensitive. */
export function searchProducts(
  catalog: readonly Product[],
  filters: SearchFilters = {},
): SearchResult {
  const { minPriceMinor, maxPriceMinor, categoryId } = filters;
  for (const bound of [minPriceMinor, maxPriceMinor]) {
    if (bound !== undefined && (!Number.isInteger(bound) || bound < 0)) {
      throw new RangeError('Price bounds must be non-negative finite integers');
    }
  }
  if (
    minPriceMinor !== undefined &&
    maxPriceMinor !== undefined &&
    minPriceMinor > maxPriceMinor
  ) {
    throw new RangeError('Minimum price must not exceed maximum price');
  }

  const query = (filters.query ?? '').trim().toLowerCase();
  const products = catalog
    .filter(product =>
      product.isPublished === true &&
      product.name.toLowerCase().includes(query) &&
      (categoryId === undefined || product.categoryId === categoryId) &&
      (minPriceMinor === undefined || product.priceMinor >= minPriceMinor) &&
      (maxPriceMinor === undefined || product.priceMinor <= maxPriceMinor),
    )
    .map(({ productId, name, categoryId, priceMinor, currency }) => ({
      productId, name, categoryId, priceMinor, currency,
    }))
    .sort((a, b) =>
      lexicalCompare(a.name, b.name) || lexicalCompare(a.productId, b.productId),
    );

  return { products, total: products.length };
}
