import { describe, expect, it } from 'vitest';
import catalog from './products.json';
import { searchProducts, type SearchFilters } from './searchProducts';

const ids = (filters?: SearchFilters) =>
  searchProducts(catalog, filters).products.map(product => product.productId);

describe('searchProducts', () => {
  it('returns published summaries ordered by name and then ID, with their count', () => {
    const result = searchProducts(catalog);
    expect(result.total).toBe(5);
    expect(result.products.map(product => product.productId)).toEqual([
      'p-01', 'p-02', 'p-05', 'p-06', 'p-03',
    ]);
    expect(result.products[0]).toEqual({
      productId: 'p-01', name: 'Alpine Mug', categoryId: 'home',
      priceMinor: 1000, currency: 'EUR',
    });
  });

  it.each(['', '   ', '\n\t'])('treats an empty trimmed query %j as no text filter', query => {
    expect(ids({ query })).toEqual(ids());
  });

  it('trims queries and matches name substrings without case sensitivity', () => {
    expect(ids({ query: '  PiNe mU  ' })).toEqual(['p-01', 'p-02']);
    expect(ids({ query: 'ceramic' })).toEqual([]);
    expect(ids({ query: 'Hidden' })).toEqual([]);
  });

  it('matches category IDs exactly', () => {
    expect(ids({ categoryId: 'outdoors' })).toEqual(['p-03']);
    expect(ids({ categoryId: 'HOME' })).toEqual([]);
    expect(ids({ categoryId: '' })).toEqual([]);
  });

  it('combines all filters with AND and includes both boundaries', () => {
    expect(ids({ query: 'mug', categoryId: 'home', minPriceMinor: 1000, maxPriceMinor: 1500 }))
      .toEqual(['p-01', 'p-02']);
    expect(ids({ query: 'mug', categoryId: 'outdoors', minPriceMinor: 1000, maxPriceMinor: 1500 }))
      .toEqual([]);
    expect(ids({ minPriceMinor: 1500, maxPriceMinor: 1500 })).toEqual(['p-02', 'p-03']);
  });

  it('supports single bounds and zero', () => {
    expect(ids({ minPriceMinor: 1500 })).toEqual(['p-02', 'p-05', 'p-03']);
    expect(ids({ maxPriceMinor: 1000 })).toEqual(['p-01', 'p-06']);
    expect(ids({ minPriceMinor: 0, maxPriceMinor: 0 })).toEqual(['p-06']);
  });

  it.each(['minPriceMinor', 'maxPriceMinor'] as const)('rejects invalid %s even on an empty catalog', key => {
    for (const value of [-1, -0.5, 0.5, NaN, Infinity, -Infinity]) {
      expect(() => searchProducts([], { [key]: value })).toThrow(RangeError);
    }
  });

  it('rejects minimum greater than maximum', () => {
    expect(() => searchProducts(catalog, { minPriceMinor: 1, maxPriceMinor: 0 }))
      .toThrow(RangeError);
  });

  it('returns an empty list and zero count for no matches or no input', () => {
    expect(searchProducts(catalog, { query: 'missing' })).toEqual({ products: [], total: 0 });
    expect(searchProducts([])).toEqual({ products: [], total: 0 });
  });

  it('uses lexical rather than locale or numeric ordering regardless of input order', () => {
    const products = [
      { ...catalog[0], name: 'a', productId: '2' },
      { ...catalog[0], name: 'Z', productId: '2' },
      { ...catalog[0], name: 'Z', productId: '10' },
    ];
    const result = searchProducts(products);
    expect(result.products.map(p => [p.name, p.productId])).toEqual([
      ['Z', '10'], ['Z', '2'], ['a', '2'],
    ]);
    expect(searchProducts([...products].reverse())).toEqual(result);
  });

  it('does not modify inputs or expose mutable input records in results', () => {
    const snapshot = structuredClone(catalog);
    const input = Object.freeze(catalog.map(p => Object.freeze({
      ...p, tags: Object.freeze([...p.tags]),
    })));
    const filters = Object.freeze({ query: ' mug ', minPriceMinor: 1000 });
    const result = searchProducts(input, filters);
    result.products[0].name = 'Changed';
    expect(input).toEqual(snapshot);
    expect(filters).toEqual({ query: ' mug ', minPriceMinor: 1000 });
  });
});
