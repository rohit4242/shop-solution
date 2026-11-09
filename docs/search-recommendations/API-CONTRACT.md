# Search & Recommendations API contract — mock implementation

The implemented developer reference is `/docs/search-recommendations`, and the downloadable machine-readable contract is `/docs/search-recommendations/openapi.json`. Start with `pnpm dev` and open http://localhost:3000/docs/search-recommendations.

## Agreement status

Marketplace's latest message confirms its proposed product/article and offer ownership, one offer per product, offer moderation and embedded product fields in GET /offers?updatedSince. Its final envelope, authentication, pagination and update semantics are not supplied. Admin acknowledgment and consumer review are pending. No repository-wide ownership change or live integration is implied.

This supersedes earlier endpoint proposals. Older review notes are kept under [exercises/session-4-context-package](exercises/session-4-context-package/README.md).

## Incoming data

Marketplace-shaped mock records: offerId/productId/sellerId strings; name/description/category strings; attributes string dictionary; imageUrls HTTP(S) array; priceMinor nonnegative safe integer; currency EUR; availability in_stock/out_of_stock; status active/pending/rejected/blocked/removed; ISO updatedAt with timezone. Product/offer IDs must be unique; maximum 10,000 records. Only active offers become public. One offer per product; no join or best-offer selection. Price includes VAT and excludes Marketing discounts.

Synthetic purchase provider: `{purchaseId: string, productIds: string[]}[]`. Unique purchase IDs, deduplicated products. This is a local fixture contract, not an order contract with another team. Real owner is unassigned.

## Outgoing APIs

All methods GET, no authentication, no-store responses. Storefront is the expected consumer.

| Path                                | Query                                                                                   | Data response                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------- |
| /api/v1/search                      | q, category, sellerId, availability, minPriceMinor, maxPriceMinor, sort, page, pageSize | items, total, page, pageSize                  |
| /api/v1/search/facets               | same filters, without sort/page/pageSize                                                | categories, sellers, availability, priceRange |
| /api/v1/search/autocomplete         | q, category, availability, limit                                                        | suggestions: productId/name                   |
| /api/v1/recommendations/similar     | productId, availability, limit                                                          | items                                         |
| /api/v1/recommendations/also-bought | productId, availability, limit                                                          | items                                         |

Public item: offerId, productId, sellerId, name, category, imageUrls, priceMinor, currency, availability. Envelope `{data: ...}`. No score, status, purchase or user data is returned.

Query limit 200 chars/20 terms; autocomplete minimum 2 chars. Default page 1/pageSize 20 (max100), autocomplete limit5 (max10), recommendation limit5 (max20). Sort relevance/price_asc/price_desc/name_asc. Price bounds inclusive; nonnegative safe integer digits only; min<=max. Optional filters absent include all public matching products, including out-of-stock. Unknown and repeated query keys are invalid.

Errors `{error:{code,message}}`: 400 INVALID_INPUT, 404 PRODUCT_NOT_FOUND, 503 CATALOG_UNAVAILABLE/RECOMMENDATION_DATA_UNAVAILABLE, 500 INTERNAL_ERROR. No matches returns 200 empty; provider failures never masquerade as empty results.

## Examples and source of truth

```sh
curl 'http://localhost:3000/api/v1/search?q=wireless'
curl 'http://localhost:3000/api/v1/search/facets?q=wireless'
curl 'http://localhost:3000/api/v1/search/autocomplete?q=wire'
curl 'http://localhost:3000/api/v1/recommendations/similar?productId=prd_1'
curl 'http://localhost:3000/api/v1/recommendations/also-bought?productId=prd_1'
```

Zod schemas: `src/features/search-recommendations/schemas/contracts.ts`. Inferred types: `types/discovery.ts`. Endpoint descriptions, examples and parameter metadata: `docs/registry.ts` inside the feature. OpenAPI derives validation schemas from Zod. Documentation tests compare example JSON against actual API responses and validate empty response shapes.

Web docs provide full response examples, error tables, ranking, disjunctive facets, data flow, team dependencies and adapter integration gates. All functionality is mock-backed until reviewed providers replace the fixtures. Two external-group approvals and affected-owner reviews are still required before merge.
