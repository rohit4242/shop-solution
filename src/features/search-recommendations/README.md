# Search & Recommendations

Mock-backed implementation of five anonymous GET APIs and developer documentation. Storefront owns shopping UI; our UI is developer-facing only. No database tables or migrations are owned here.

## Public interfaces

- `/api/v1/search`: text matching, filters, sorting, pagination.
- `/api/v1/search/facets`: disjunctive category, seller, stock counts and price range.
- `/api/v1/search/autocomplete`: normalized product-name prefix suggestions.
- `/api/v1/recommendations/similar`: same-category attribute/price ranking.
- `/api/v1/recommendations/also-bought`: synthetic co-purchase ranking, empty without evidence.
- `/docs/search-recommendations`: browser documentation, examples, request explorer.
- `/docs/search-recommendations/openapi.json`: schema-derived OpenAPI 3.1 download.

All JSON success responses use `{ data: ... }`; failures use `{ error: { code, message } }`. Public endpoints require no token and return only active offers, including out-of-stock offers by default. Requests reject unknown/repeated keys and invalid numbers. Query defaults, limits, schemas, response examples and errors are documented on the website and in [API-CONTRACT.md](../../../docs/search-recommendations/API-CONTRACT.md).

Public client-safe exports: `DiscoveryItem`, `MarketplaceOffer`, response-envelope types and wire query-parameter types (inferred from Zod). Public server exports: `handleDiscoveryRequest`, documentation composition and OpenAPI generation. Routes consume `server/index.ts`. Schemas live in `schemas/`, pure normalization in `utils/`, matching and recommendation logic in `server/services/`, source adapters and lazy snapshot loading in `server/repositories/`. Zod schemas and inferred types define contracts; no other team's internals are imported.

## Data sources and limits

Marketplace's latest clarification says it stores products/articles and offers, one offer per product; moderation is on the offer, and its proposed `/offers?updatedSince=...` embeds product details. Admin acknowledgment and final envelope/auth/paging/change semantics remain pending. This local adapter is a proposal, not a live integration or repository-wide ownership change.

Mock catalog: 24 records, 4 categories, 3 sellers, all moderation states, stock states, accent and zero-price cases. EUR only; attributes are string-valued. Prices include VAT before Marketing discounts. Catalog loads reject duplicate offer/product IDs, malformed records, and more than 10,000 records. Immutable snapshots load once per process; concurrent requests share initialization, failures retry, and no incremental refresh exists yet.

Purchase provider: three synthetic groups, no users or PII. Real source ownership and qualifying/refunded-order semantics are unconfirmed. No similarity fallback disguises missing co-purchase evidence.

Errors: `INVALID_INPUT` (400), `PRODUCT_NOT_FOUND` (404), `CATALOG_UNAVAILABLE` (503), `RECOMMENDATION_DATA_UNAVAILABLE` (503), `INTERNAL_ERROR` (500). Hidden/missing sources are indistinguishable. All public API responses use `Cache-Control: no-store`.

## Development and verification

Run `pnpm dev` and visit `/docs/search-recommendations`. The catalog does not require a database. The application retains its existing Prisma/auth setup. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. See [implementation verification](../../../docs/search-recommendations/IMPLEMENTATION-VERIFICATION.md) for actual results and local toolchain limitations.

Tests exercise actual route exports, provider failures, visibility, ranking, filters, facets, pagination, snapshot concurrency, and documentation examples against real fixture responses. OpenAPI schemas are derived from Zod; prose covers rules JSON Schema cannot express, including repeated HTTP keys and price relationships.

## Handoff

Marketplace, Admin and Storefront contract reviews plus two external-group approvals remain required before merge. Purchase ownership is not assigned to Accounting or Storefront by this implementation. Live sync, auth/admin search, webhooks, discounts, personalization, persistence and deployment are deferred.

Historical exercise submission files and evidence remain unchanged. The current [MODULE.md](MODULE.md) describes implementation; submission/MODULE.md is a frozen exercise artifact.

## MCP and team playground (Session 5)

The public Streamable HTTP endpoint `/api/mcp/search-recommendations` exposes five tools mirroring the existing GET API and the `erp://search-recommendations/openapi` resource. Python stdio is available under `tools/search-recommendations-mcp`. Both adapters translate to HTTP; feature business logic remains here. The scoped internal HTTP exception awaits maintainer review.

`/docs/search-recommendations/playground` is a developer-only experiment surface, not Storefront UI. Better Auth sessions plus the explicit `PLAYGROUND_USER_IDS` allowlist gate `/api/search-playground/config` and `/api/search-playground/run`. The default configuration disables model runs. Model URLs/credentials stay server-side. Runs stream normalized event evidence and are stored only in each user's browser; no feature database tables were added.

Read [Session 5 setup and status](../../../docs/search-recommendations/session-5-mcp/README.md). Run `pnpm contract:check`, `pnpm test:e2e` and the Python adapter tests in addition to the repository checks. The generated YAML and Python tool contract must remain in sync with Zod/metadata. No real provider or deployment capability is claimed until verified with genuine configuration.
