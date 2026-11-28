# Marketplace

## Scope and status

Owned by the Marketplace team: seller onboarding, seller listings with moderation, the public offer catalog, and seller dashboards. See the [team directory](../../../docs/team-ownership.md).

Implemented on the [canonical shop schema](../../../prisma/schema.prisma). There is no Marketplace-specific table or migration. This feature reads and writes the shared `Seller`, `Product`, `Offer`, `OfferItem` and `InventoryBalance` models described in the [shared shop data model](../../../docs/commerce/README.md).

- **API:** `/api/v1/marketplace/*`, contract 3.0.0 ([OpenAPI](api/openapi.yaml)).
- **UI:** seller dashboard at `/seller`. It covers sign-in (interim), shop setup, listing products with variations and images, sales, and shop details.
- **Moderation:** API only. Admin & Identity builds the moderation pages (agreed in session 6).

Commission and payouts are listed under Marketplace in the ownership table, but no code exists for them yet. The schema has no commission or payout record (see [Open decisions](#open-decisions)).

## Run locally

Follow the [repository setup](../../../README.md#local-setup), then:

```sh
# .env
MARKETPLACE_MODERATOR_EMAILS="you@example.com"   # may approve shops and offers
MARKETPLACE_IMAGE_DIR=""                          # empty: .data/marketplace-images
```

Open `/seller`, create an account, set up a shop and list a product. Listing needs at least one row in `Category`. Marketplace only reads categories, and the repository has no seed yet. For a local database only:

```sql
INSERT INTO category (id, slug, name) VALUES ('cat_home', 'home-kitchen', 'Home & Kitchen');
```

To make the listing public, sign in as a moderator and call `POST /api/v1/marketplace/sellers/{sellerId}/approve` and `POST /api/v1/marketplace/offers/{offerId}/approve`. The offer then appears in `GET /api/v1/marketplace/catalog/offers`.

| Variable                       | Purpose                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------ |
| `MARKETPLACE_MODERATOR_EMAILS` | Interim: comma-separated e-mails that may verify shops and moderate offers.                |
| `MARKETPLACE_IMAGE_DIR`        | Interim local directory for image bytes. Defaults to `.data/marketplace-images` (ignored). |

## Public contract

- **OpenAPI:** [api/openapi.yaml](api/openapi.yaml), also served at `/api/v1/marketplace/openapi.yaml` and `/api/v1/marketplace/openapi.json`. It is generated from the Zod schemas the routes validate with ([api/openapi.ts](api/openapi.ts)). After changing a schema or route, run `node --import tsx scripts/export-marketplace-contract.ts` and commit the YAML. `tests/contract.test.ts` fails when the YAML is stale or a route and the document disagree.
- **In-app callers** (Storefront, Search & Recommendations, Analytics) import the same operations from `@/features/marketplace/server`. Server code doesn't fetch these routes over HTTP.

Conventions: IDs are the canonical `cuid` IDs, without prefixes. Money is integer minor units, VAT included (`1999` = EUR 19.99), EUR only for now. Timestamps are ISO 8601 UTC. Success bodies are `{ data }`; failures are `{ error: { code, message, fieldErrors? } }`. Statuses are lowercase on the wire.

| Route                                         | Who                                           | Server function                 |
| --------------------------------------------- | --------------------------------------------- | ------------------------------- |
| `GET /catalog/offers`                         | public                                        | `listCatalogOffers`             |
| `GET /categories`                             | public                                        | `listCategories`                |
| `GET /offers/{offerId}`                       | public                                        | `getOffer`                      |
| `GET /products/{productId}`                   | public                                        | `getProduct`                    |
| `GET /sellers/{sellerId}`                     | public                                        | `getSeller`                     |
| `GET /sellers/{sellerId}/offers`              | public                                        | `listSellerOffers`              |
| `GET /images/{imageKey}`                      | public once a public offer uses it; see below | `getListingImage`               |
| `POST /sellers`                               | signed-in user                                | `registerSeller`                |
| `GET /sellers/me`                             | signed-in user                                | `getMyShop`                     |
| `PATCH /sellers/{sellerId}`                   | shop member                                   | `updateSeller`                  |
| `POST /sellers/{sellerId}/images`             | shop member                                   | `uploadListingImage`            |
| `POST /sellers/{sellerId}/offers`             | shop member                                   | `createOffer`                   |
| `PATCH /offers/{offerId}`                     | shop member                                   | `updateOffer`                   |
| `GET /offers?sellerId=&status=`               | shop member (own shop) or offer moderator     | `listOffers`                    |
| `GET /sellers/{sellerId}/sales`               | shop member                                   | `listSales`                     |
| `GET /sellers?status=`                        | seller moderator                              | `listSellers`                   |
| `POST /sellers/{sellerId}/approve`, `/reject` | seller moderator                              | `approveSeller`, `rejectSeller` |
| `POST /offers/{offerId}/approve`, `/reject`   | offer moderator                               | `approveOffer`, `rejectOffer`   |

**Offer shape.** An offer carries its product's name, description, category (`categorySlug`) and attributes. `items` lists its active offer items: one per variant, each with `offerItemId`, price, `stock` (`onHand`) and `available` (`onHand − held`). A product without variations has a single item whose `variantCode` is `default` (`hasVariations: false`). Carts and order lines reference `offerItemId`.

**Catalog feed** for Search and Storefront: run a full load by following `nextCursor` until it is null, then poll with `updatedSince` set to the largest `updatedAt` you have seen. Listing edits (product facts, price, stock set by the seller, images) bump the offer's `updatedAt`. Stock changes made by checkout do not, so read `available` when you need current availability. Offers that stop being public drop out of the feed, so repeat a full load from time to time.

### Business rules

- **Shops.** `pending` → `active` (approved) or `terminated` (rejected, with a reason). `suspended` and `terminated` shops cannot change details or list products. A user has at most one shop that is not `terminated`. Registering makes the session user a `SellerMember` with role `owner`. Every seller operation checks that membership; a browser-supplied seller ID is only a lookup key.
- **Listing.** `createOffer` creates a `draft` `Product` with its variants, the shop's `pending` `Offer`, one `OfferItem` and `InventoryBalance` per variant, and `OfferImage` rows. A moderator moves the offer to `active` or `rejected`. Approving also activates the product while it is still `draft`. An archived product stays archived.
- **Review on edit.** Changing text, category, attributes, images, which variations exist, their labels or images, or measurements sends an `active` offer back to `pending`. Price and stock changes do not. Any edit of a `rejected` offer resubmits it. `blocked` and `removed` offers are locked.
- **Shared products.** Product facts (name, description, category, attributes, measurements) can only change while no other shop offers the same product (`PRODUCT_SHARED`). Price, stock and images are per offer.
- **Variations.** Up to 100. Removed variations are deactivated (`OfferItem.active = false`), never deleted, so carts and order history keep their references. Turning variations off reuses the product's `default` variant. Measurements are stored on each variant; the offer shows the first item's.
- **Stock.** The seller sets `InventoryBalance.onHand`. It cannot go below `held` (`STOCK_BELOW_HELD`). Reservations and decrements belong to the checkout owner.
- **Public reads.** An offer is public only when the offer, its shop and its product are `active` and it has an active item. Public reads never return a shop's legal name, e-mail or address.
- **Images.** JPG, PNG or WEBP, at most 5 MiB, detected from the file signature. An upload returns an `imageKey` (`mkt_<sellerId>_<random>`) bound to that shop. Each key can be attached to one offer once, as an offer image or an item image (`IMAGE_IN_USE`). An image is public once a public offer uses it. Before that, only shop members can see it, plus offer moderators once it is attached; anyone else gets 404.
- **Sales.** `listSales` reads the canonical `OrderLine` rows of the shop's offer items with the order status and whether a payment is `CONFIRMED`. Marketplace records no sale and writes no order, payment or stock decrement.

### Errors

| HTTP      | Codes                                                                                                                                                     |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400       | `VALIDATION_ERROR` (with `fieldErrors`, including an unknown `categorySlug` or image key)                                                                 |
| 401       | `UNAUTHENTICATED` (checked before a request body is read)                                                                                                 |
| 403       | `FORBIDDEN` (missing permission, another shop, another shop's image, or a cross-site write)                                                               |
| 404       | `SELLER_NOT_FOUND`, `OFFER_NOT_FOUND`, `PRODUCT_NOT_FOUND`, `IMAGE_NOT_FOUND`                                                                             |
| 409       | `SELLER_EXISTS`, `SELLER_NOT_ALLOWED`, `OFFER_LOCKED`, `INVALID_STATUS_CHANGE`, `PRODUCT_SHARED`, `STOCK_BELOW_HELD`, `IMAGE_IN_USE`, `CONCURRENT_UPDATE` |
| 413 / 415 | `IMAGE_TOO_LARGE` / `INVALID_IMAGE`                                                                                                                       |

## Data and integrations

| Shared model                    | Marketplace use                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Seller`, `SellerMember`        | Writes. Shops, their status and the owner membership.                                                   |
| `Product`, `ProductVariant`     | Writes products that sellers list (see open decision 2); activates a `draft` product on first approval. |
| `Offer`, `OfferItem`            | Writes. Listings, moderation status, prices, active items.                                              |
| `InventoryBalance`              | Writes `onHand` only (see open decision 4). Reads `held`.                                               |
| `OfferImage`                    | Writes. Storage key and metadata; bytes are in the image store.                                         |
| `Category`                      | Reads. Choosing a listing category.                                                                     |
| `OrderLine`, `Order`, `Payment` | Reads. A shop's sales.                                                                                  |
| `User`                          | References through `SellerMember.userId` (Better Auth, Admin & Identity).                               |

Code layout follows the [feature guide](../../../docs/feature-guide.md):

| Path                                               | What it does                                                                    |
| -------------------------------------------------- | ------------------------------------------------------------------------------- |
| `schemas/marketplace.schema.ts`                    | Zod validation of every input                                                   |
| `types/marketplace.ts`                             | Response shapes (client-safe)                                                   |
| `server/services/rules.ts`                         | Pure business rules: visibility, review on edit, items, held stock, image keys  |
| `server/services/*.ts`                             | Sellers, offers, images, sales                                                  |
| `server/repositories/mappers.ts`, `image-store.ts` | Canonical rows ↔ contract shapes; image byte storage                            |
| `server/access.ts`                                 | Session → actor and interim permissions                                         |
| `server/api-handlers.ts`, `server/http.ts`         | One handler per route; `src/app/api/v1/marketplace/**/route.ts` re-exports them |
| `components/`                                      | Seller dashboard                                                                |

**Depends on:** Admin & Identity (Better Auth session; `readShopActor` and `checkShopPermission` once published; moderation pages; catalog categories). **Consumers:** Storefront and Search & Recommendations (catalog reads), Analytics (catalog and sales reads). Checkout writes the orders that `listSales` reads.

### Interim choices

Each is in one place, so it can be swapped without touching callers.

| Topic         | Today                                                                                                           | Replace when                                                    |
| ------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Session       | `server/access.ts` calls `@/server/auth` directly                                                               | Admin & Identity exports `readShopActor`                        |
| Moderators    | E-mails in `MARKETPLACE_MODERATOR_EMAILS` (`permissionsFor`)                                                    | Admin & Identity exports `checkShopPermission` and grants roles |
| Login UI      | A sign-in and sign-up card on `/seller` using Admin & Identity's `authClient` (`components/seller-sign-in.tsx`) | The shared `/login` page exists                                 |
| Image storage | Local disk (`server/repositories/image-store.ts`, `MARKETPLACE_IMAGE_DIR`)                                      | The class picks object storage                                  |

### Open decisions

1. **Commission and payouts.** The schema has no commission rate, payout, or Accounting acknowledgement per order line. The earlier draft stored `invoiceStatus` and `invoiceId` on its own sale table. If Accounting needs a seller-side record, attach it to `OrderLine` through an agreed relation.
2. **Who creates products.** Marketplace creates a `draft` `Product` for each new listing and activates it on approval. Catalog editing belongs provisionally to Admin & Identity. Agree whether sellers may create products and how a seller offers an existing product. There is no operation for that yet.
3. **Categories.** There is no category writer or seed. Listing needs at least one category.
4. **Stock authority.** Inventory ownership is unassigned. Marketplace writes only `onHand` for its sellers' items and never `held`.
5. **Variant order.** `ProductVariant` and `OfferItem` have no position column, so items are returned in creation order. A seller's reordering of variations is not kept.
6. **Image storage** and cleanup of uploads that were never attached.

## Verification

```sh
pnpm docs:check
pnpm lint
pnpm typecheck
pnpm test        # src/features/marketplace/tests: rules, schemas, access, dashboard logic, contract
pnpm build
```

The unit tests cover the rules without a database. Service behavior against PostgreSQL was checked on a disposable database with the committed migrations. Those steps are listed in the PR and are not automated in CI.
