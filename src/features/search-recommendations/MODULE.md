# Search & Recommendations module context

## Purpose

Provide search, facets, autocomplete, similar products and also-bought APIs. Own developer documentation only; Storefront owns customer UI. This release uses mocks and no database or external search infrastructure.

## Structure

`schemas/contracts.ts`: Zod input/output schemas. `types/discovery.ts`: inferred types/provider interfaces. `server/repositories/`: validated mock providers and immutable lazy snapshots. `server/services/`: search, recommendations, HTTP handling. `server/index.ts`: server-only public interface. `components/` and `docs/`: developer reference with shared endpoint metadata and schema-derived OpenAPI. App routes are thin.

## Incoming contracts

Marketplace says product=article, it stores products and offers, one offer per product, moderation on offers, and GET /offers?updatedSince includes product details. Admin acknowledgment and final wire/auth/pagination/change rules are still pending. Validate offerId, productId, sellerId, name, description, category, attributes, imageUrls, priceMinor, currency, availability, status and updatedAt. Local assumptions: EUR, string attributes, integer nonnegative safe prices; only active records public. Catalog maximum 10,000; reject duplicate product/offer IDs. VAT included, Marketing discounts excluded. No catalog join.

Purchase groups are synthetic purchaseId/productIds inputs with unique purchase IDs and deduplicated products. Real owner and qualification rules remain unknown; no user tables.

## Outgoing contracts

Anonymous GET /api/v1/search, /search/facets, /search/autocomplete, /recommendations/similar and /recommendations/also-bought. Paths after /api/v1 are relative to that prefix. All use {data:...} or {error:{code,message}} with no-store. Public item fields: offerId, productId, sellerId, name, category, imageUrls, priceMinor, currency, availability. Never expose internal fields.

Search: q/category/sellerId/availability/minPriceMinor/maxPriceMinor/sort/page/pageSize. Empty query browses; max 200 characters/20 terms. Page 1, size 20/max 100. Facets use same filters without sort/paging, ignoring own filter. Autocomplete: q minimum 2 chars, category/availability, limit 5/max 10. Recommendations: productId/availability, limit 5/max 20. Unknown/repeated keys and malformed numbers rejected. Missing or hidden sources 404; dependency failures 503; no matches 200 empty.

## Logic and pitfalls

Normalize accents/case, Unicode tokenize, require all terms. Highest field weight per term name 4/category 2/attributes 2/description 1; exact full name +10. Stable name/ID ties. Similar: same category, shared attribute pairs, price difference, ID. Also-bought: pair once per purchase, count descending then ID; empty without evidence, never substitute similarity. Active out-of-stock products included unless filtered. Snapshot loads shared once/process, failed loads retry. No live refresh, persistent index or production scalability claim.

## Conventions and validation

Strict TS, Zod, server-only, feature public interfaces; no cross-team database access. Validate requests before providers. Use local provider injection in tests. Documentation: /docs/search-recommendations with examples and OpenAPI. Run pnpm lint/typecheck/test/build and HTTP/browser checks. Preserve submission evidence. Cross-group review and live contracts remain pending; do not deploy or assign unowned domains.
