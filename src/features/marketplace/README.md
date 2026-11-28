# marketplace

Scope: seller onboarding, product listings with moderation, seller dashboards, and the hand-off of recorded sales to Accounting.

Commission: the class ownership table lists "commissions" under Marketplace. Our proposal is that **Accounting calculates and books commission and payouts**, and Marketplace only reports each sale line to Accounting. This needs Accounting's agreement (see [Open decisions](#open-decisions)).

Status: **in progress — PR 2 of 4 (business logic).** The sections below describe the finished feature; PRs 1–4 add it in steps: data model, business logic, API and OpenAPI, seller dashboard.

Read ../../../docs/architecture.md and ../../../docs/coding-conventions.md.

## Contract

- **OpenAPI:** [api/openapi.yaml](api/openapi.yaml), also served at `/api/v1/marketplace/openapi.yaml` and `/api/v1/marketplace/openapi.json`. Import it into Postman, Insomnia, Swagger UI or a client generator.
- The document is generated from the Zod schemas the routes validate with ([api/openapi.ts](api/openapi.ts)). After changing a schema or route, run `node --import tsx scripts/export-marketplace-contract.ts` and commit the YAML. `tests/contract.test.ts` fails when the YAML is stale or a route and the document disagree.
- **In-app consumers** (Storefront, Search & Recommendations, Analytics) call the same operations from `@/features/marketplace/server`, not over HTTP.

## Where things are

| Path                                 | What it does                                                                     |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| `schemas/marketplace.schema.ts`      | Zod validation of every input                                                    |
| `types/marketplace.ts`               | Response shapes (client-safe)                                                    |
| `server/services/rules.ts`           | Pure business rules: visibility, review on edit, variations, cursor, image types |
| `server/services/*.ts`               | Sellers, offers, images, sales, Accounting client                                |
| `server/access.ts`                   | Session → actor and permissions; service token                                   |
| `server/api-handlers.ts`             | One handler per route; `src/app/api/v1/marketplace/**/route.ts` re-export them   |
| `components/`                        | Seller dashboard: sign-in (interim), shop setup, products, sales, shop details   |
| `api/openapi.ts`, `api/openapi.yaml` | The contract                                                                     |
| `tests/`                             | Rules, schemas, access, dashboard logic, contract                                |

## Owned data

Only Marketplace writes these tables. Other features read through the server functions, never through Prisma directly.

| Table                         | Model                       | Holds                                                                                                              |
| ----------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `marketplace_seller`          | `MarketplaceSeller`         | A shop: owner (`userId`), public display name, private legal name, contact e-mail, address, status                 |
| `marketplace_offer`           | `MarketplaceOffer`          | A seller's listing: name, description, category, attributes, price, stock, images, measurements, moderation status |
| `marketplace_offer_variation` | `MarketplaceOfferVariation` | Variations of an offer (for example "Blue / M") with their own price, stock and images                             |
| `marketplace_listing_image`   | `MarketplaceListingImage`   | Uploaded images (JPG, PNG, WEBP, max 5 MiB), bytes included                                                        |
| `marketplace_sale_line`       | `MarketplaceSaleLine`       | One offer sold in one order, and whether Accounting has invoiced it                                                |

Migration: `prisma/migrations/20261127000100_marketplace_core`, including hand-written CHECK constraints (positive prices, stock range, country code, image size).

References that are deliberately **not** foreign keys: `MarketplaceSeller.userId` is the Better Auth `user.id` (Admin & Identity's table), and `MarketplaceSaleLine.orderId` comes from the order owner, which is not assigned yet.

## Conventions

- IDs carry a prefix: `sel_` seller, `off_` offer, `prd_` product, `var_` variation, `img_` image, `sal_` sale line.
- Money is integer minor units, VAT included: `1999` = EUR 19.99. Only `EUR`.
- Timestamps are ISO 8601 UTC.
- Success: `{ data: ... }`. Failure: `{ error: { code, message, fieldErrors? } }`.

## Business rules

Seller: `pending` → `active` (approved) or `terminated` (rejected, with a reason). `suspended` and `terminated` shops cannot change their details or list products. A user has at most one shop that is not `terminated`. The owner is always the session user. A `userId` from the browser is rejected.

Offer: a new offer starts `pending`. A moderator moves it to `active` or `rejected` (with a reason). Changing name, description, category, attributes, images, variation labels or images, or measurements of an `active` offer sends it back to `pending`. Price and stock changes do not. Any edit of a `rejected` offer resubmits it. `blocked` and `removed` offers are locked.

Public: an offer is public only when it is `active` **and** its shop is `active`. Public reads never return a seller's legal name, e-mail or address. An image becomes public once a public offer uses it.

Variations: an offer has either one price and stock, or 1–100 variations. With variations, the offer price is the cheapest variation and its stock is the sum.

Sales: the offer must be public and without variations. Stock decreases atomically, so concurrent orders cannot oversell. One line per order and offer. The line is then sent to Accounting. If Accounting is unreachable, the sale still succeeds and stays `pending` for a retry.

## Operations

All routes are under `/api/v1/marketplace`. The OpenAPI document has the full request and response shapes.

| Route                                          | Who                                                         | Server function                 |
| ---------------------------------------------- | ----------------------------------------------------------- | ------------------------------- |
| `GET /catalog/offers`                          | public                                                      | `listCatalogOffers`             |
| `GET /offers/{offerId}`                        | public                                                      | `getOffer`                      |
| `GET /products/{productId}`                    | public                                                      | `getProduct`                    |
| `GET /sellers/{sellerId}`                      | public                                                      | `getSeller`                     |
| `GET /sellers/{sellerId}/offers`               | public                                                      | `listSellerOffers`              |
| `GET /images/{imageId}`                        | public once used by a public offer; else owner or moderator | `getListingImage`               |
| `POST /sellers`                                | signed-in user                                              | `registerSeller`                |
| `GET /sellers/me`                              | signed-in user                                              | `getMyShop`                     |
| `PATCH /sellers/{sellerId}`                    | shop owner                                                  | `updateSeller`                  |
| `POST /sellers/{sellerId}/images`              | shop owner                                                  | `uploadListingImage`            |
| `POST /sellers/{sellerId}/offers`              | shop owner                                                  | `createOffer`                   |
| `PATCH /offers/{offerId}`                      | shop owner                                                  | `updateOffer`                   |
| `GET /offers?sellerId=&status=`                | shop owner (own shop) or offer moderator                    | `listOffers`                    |
| `GET /sellers?status=`                         | seller moderator                                            | `listSellers`                   |
| `POST /sellers/{sellerId}/approve`, `/reject`  | seller moderator                                            | `approveSeller`, `rejectSeller` |
| `POST /offers/{offerId}/approve`, `/reject`    | offer moderator                                             | `approveOffer`, `rejectOffer`   |
| `POST /sales`                                  | service token (order owner)                                 | `recordSale`                    |
| `GET /sales?orderId=&sellerId=&invoiceStatus=` | shop owner (own shop) or service token                      | `listSales`                     |
| `POST /sales/{saleId}/accounting-handoff`      | shop owner or service token                                 | `retryAccountingHandoff`        |

**Catalog feed** for Search and Storefront: do a full load once by following `nextCursor` until it is null, then poll with `updatedSince` set to the largest `updatedAt` you have seen. Offers that stop being public drop out of the feed, so repeat a full load from time to time.

## Errors

| HTTP      | Codes                                                                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400       | `VALIDATION_ERROR` (with `fieldErrors`)                                                                                                                                                                   |
| 401       | `UNAUTHENTICATED`                                                                                                                                                                                         |
| 403       | `FORBIDDEN` (missing permission, another seller's shop or image, or a request from another site)                                                                                                          |
| 404       | `SELLER_NOT_FOUND`, `OFFER_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `SALE_NOT_FOUND`, `IMAGE_NOT_FOUND`                                                                                                           |
| 409       | `SELLER_EXISTS`, `SELLER_NOT_ALLOWED`, `OFFER_LOCKED`, `OFFER_NOT_AVAILABLE`, `INVALID_STATUS_CHANGE`, `DUPLICATE_SALE`, `INSUFFICIENT_STOCK`, `ALREADY_INVOICED`, `INVOICE_REFUSED`, `CONCURRENT_UPDATE` |
| 413 / 415 | `IMAGE_TOO_LARGE` / `INVALID_IMAGE`                                                                                                                                                                       |
| 503       | `ACCOUNTING_UNAVAILABLE`                                                                                                                                                                                  |

## Interim choices

These work today and are each in one place, so they can be swapped without touching callers.

| Topic           | Today                                                                                                                              | Replace when                                                            |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Permissions     | Every signed-in user may sell; moderators are the e-mails in `MARKETPLACE_MODERATOR_EMAILS` (`server/access.ts`, `permissionsFor`) | Admin & Identity defines roles                                          |
| Login UI        | A small sign-in and sign-up card on `/seller`, using Admin & Identity's public `authClient` (`components/seller-sign-in.tsx`)      | The shared login pages exist                                            |
| Service callers | `Authorization: Bearer $MARKETPLACE_SERVICE_TOKEN` for `POST /sales` and service reads (`isServiceCaller`)                         | The class agrees service authentication                                 |
| Image storage   | Bytes in `marketplace_listing_image.data` (Postgres, max 5 MiB)                                                                    | The class picks object storage                                          |
| Accounting      | `POST {MARKETPLACE_ACCOUNTING_API_URL}/commission-invoices` (Accounting API 1.2.0 shape)                                           | Accounting moves into this app; then call their server function instead |
| Moderation UI   | API only (as agreed in session 6: Admin & Identity builds the moderation pages)                                                    | —                                                                       |

## Configuration

| Variable                           | Purpose                                                                    |
| ---------------------------------- | -------------------------------------------------------------------------- |
| `MARKETPLACE_MODERATOR_EMAILS`     | Comma-separated e-mails that may approve shops and offers                  |
| `MARKETPLACE_SERVICE_TOKEN`        | Bearer token for service callers. Empty: nobody can record sales over HTTP |
| `MARKETPLACE_ACCOUNTING_API_URL`   | Accounting base URL. Empty: sales stay `pending`                           |
| `MARKETPLACE_ACCOUNTING_API_TOKEN` | Optional bearer token for Accounting                                       |

## Dependencies

- **Admin & Identity:** Better Auth sessions (used now). Roles for `marketplace:sell`, `marketplace:verify-sellers` and `marketplace:moderate-offers` (interim rules until then). Moderation pages on our approve and reject routes.
- **Accounting:** takes a sale line (`saleId`, `orderId`, `sellerId`, `offerId`, `quantity`, `unitPriceMinor`, `grossMinor`, `currency`, `soldAt`) and returns `invoiceId`, or 409/422 with `{ error: { code, message } }` to refuse.
- **Order owner (unassigned):** calls `recordSale` when an order is paid.
- **Storefront, Search & Recommendations:** read through the catalog functions or routes.

## Open decisions

1. **Commission.** Accounting calculates it (our proposal) or Marketplace does (the ownership table).
2. **Product identity.** The architecture says not to redefine product identity, and gives catalog editing provisionally to Admin & Identity. Today every offer gets its own `productId`. Agree whether seller listings are the catalog products or link to products owned elsewhere.
3. The interim choices above.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test          # includes src/features/marketplace/tests (rules, schemas, access, dashboard logic, contract)
pnpm build
```

Manual check: set `MARKETPLACE_MODERATOR_EMAILS` to your e-mail, open `/seller`, create an account and a shop, add a product, then approve both with `POST /api/v1/marketplace/sellers/{id}/approve` and `/offers/{id}/approve` while signed in as the moderator. The offer then appears in `GET /api/v1/marketplace/catalog/offers`.

## Ownership

The Marketplace class team owns this area. GitHub handles and reviewers will be assigned after class agreement.
