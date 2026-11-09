import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import fixtures from "./products.json";
import { searchProducts, type Product } from "./product-search";

const products = fixtures as Product[];
const ids = (result: ReturnType<typeof searchProducts>) => result.items.map((p) => p.productId);

describe("searchProducts", () => {
  it("returns sorted published summaries and their total by default", () => {
    const result = searchProducts(products);
    expect(ids(result)).toEqual(["p-01", "p-02", "p-05", "p-06", "p-03"]);
    expect(result.total).toBe(5);
    expect(result.items[0]).toEqual({
      productId: "p-01", name: "Alpine Mug", categoryId: "home",
      priceMinor: 1000, currency: "EUR",
    });
  });

  it.each(["", "  \t\n "])("treats an empty trimmed query as matching all eligible records: %j", (q) => {
    expect(searchProducts(products, { q })).toEqual(searchProducts(products));
  });

  it("trims queries and matches case-insensitive name substrings", () => {
    expect(ids(searchProducts(products, { q: "  PiNe m  " }))).toEqual(["p-01", "p-02"]);
    expect(searchProducts(products, { q: "ceramic" }).total).toBe(0);
  });

  it("combines all filters with AND and includes both price boundaries", () => {
    const result = searchProducts(products, {
      q: "mug", categoryId: "home", minPriceMinor: 1000, maxPriceMinor: 1500,
    });
    expect(ids(result)).toEqual(["p-01", "p-02"]);
    expect(result.total).toBe(2);
    expect(searchProducts(products, { q: "mug", categoryId: "outdoors" }).total).toBe(0);
  });

  it("uses exact category IDs", () => {
    expect(ids(searchProducts(products, { categoryId: "outdoors" }))).toEqual(["p-03"]);
    expect(searchProducts(products, { categoryId: "HOME" }).total).toBe(0);
    expect(searchProducts(products, { categoryId: "" }).total).toBe(0);
  });

  it("supports individual bounds, equal bounds, and zero", () => {
    expect(ids(searchProducts(products, { minPriceMinor: 1500 }))).toEqual(["p-02", "p-05", "p-03"]);
    expect(ids(searchProducts(products, { maxPriceMinor: 1000 }))).toEqual(["p-01", "p-06"]);
    expect(ids(searchProducts(products, { minPriceMinor: 1500, maxPriceMinor: 1500 }))).toEqual(["p-02", "p-03"]);
    expect(ids(searchProducts(products, { minPriceMinor: 0, maxPriceMinor: 0 }))).toEqual(["p-06"]);
  });

  it.each(["minPriceMinor", "maxPriceMinor"] as const)("rejects invalid %s", (bound) => {
    for (const value of [-1, 0.5, NaN, Infinity, -Infinity]) {
      expect(() => searchProducts(products, { [bound]: value })).toThrow(ZodError);
    }
  });

  it("rejects reversed bounds even for an empty catalog", () => {
    expect(() => searchProducts([], { minPriceMinor: 2, maxPriceMinor: 1 })).toThrow(ZodError);
  });

  it("returns empty results for no matches, empty catalogs, or unpublished matches", () => {
    expect(searchProducts(products, { q: "missing" })).toEqual({ items: [], total: 0 });
    expect(searchProducts([], {})).toEqual({ items: [], total: 0 });
    expect(searchProducts(products, { q: "Hidden" })).toEqual({ items: [], total: 0 });
  });

  it("uses lexical name and ID ordering regardless of input order", () => {
    const catalog = [
      { ...products[0], name: "alpha", productId: "p-1" },
      { ...products[0], name: "Zebra", productId: "p-2" },
      { ...products[0], name: "Zebra", productId: "p-10" },
    ];
    expect(ids(searchProducts(catalog))).toEqual(["p-10", "p-2", "p-1"]);
    expect(searchProducts([...catalog].reverse())).toEqual(searchProducts(catalog));
  });

  it("does not modify the catalog, nested tags, or filters and returns independent summaries", () => {
    const before = structuredClone(products);
    const catalog = Object.freeze(products.map((p) => Object.freeze({
      ...p, tags: Object.freeze([...p.tags]),
    })));
    const filters = Object.freeze({ q: "  MUG  " });
    const result = searchProducts(catalog, filters);
    result.items[0].name = "Changed";
    expect(catalog).toEqual(before);
    expect(filters).toEqual({ q: "  MUG  " });
  });
});
