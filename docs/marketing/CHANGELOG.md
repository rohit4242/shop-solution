# Marketing API changelog

Contract: [`marketing.yaml`](marketing.yaml) (OpenAPI 3.1), served under `/api/v1/marketing`.

## 0.4.0 (28 Nov 2026): on the shared shop database

Marketing now uses the canonical shop schema that `main` adopted on 28 Nov (PR #29) instead of its own
`marketing_*` tables. Field names and the decimal money format on the wire are unchanged. Not released
before: 0.3.0 only existed in the draft PR #23.

### Changed

- Storage: promotions in `promotion`, `promotion_product`, `promotion_category`; codes in `discount_code`;
  order events in `event_receipt` (consumer `marketing`). Amounts are stored as minor units and percentages
  as basis points; Marketing converts exactly at the API boundary (`59.90` ↔ `5990`, `10` ↔ `1000`) and
  rejects more than 2 decimal places instead of rounding.
- `promotionId` and `campaignId` are opaque strings (cuids), no longer UUIDs. `invalid_id` now means an
  empty or over-long id.
- `productIds` / `categoryIds` must be ids from the shared catalog. An unknown id is a 400 with
  `fieldErrors.productIds` (or `categoryIds`) instead of being stored.
- `GET /orders/{orderId}/discounts` reads what checkout stored with the order (`order_discount`,
  `order_discount_allocation`). It lists every order line, with `offerId` always set. Reversed discounts
  are ignored. 404 also when the order does not exist.
- `POST /events` acknowledges `order.placed` once per event id. It no longer stores a discount or a
  redemption: checkout records the applied discount with the order, and code use is counted from those rows.
- `POST /reset` removes promotions, codes and Marketing's event receipts. Rows that an order already uses are
  deactivated instead of deleted; the response has `deleted` and `deactivated` counts.
- `PromotionAdmin` no longer has `createdAt` / `updatedAt` (the shared table has no such columns). Lists are
  ordered by `validFrom`, newest first.

### Added

- `description` column on the shared `promotion` table (nullable, migration
  `20261128180000_promotion_description`), so promotions keep their customer-facing text.

### Settled

- Money format: integer minor units in the database, decimals on Marketing's API.
- Who writes the order's discount: checkout, in `order_discount`; Accounting and Marketing read it.

## 0.3.0 (27 Nov 2026): first version in shop-solution (draft only)

Moves the operations that story steps j, k and o need from the Marketing team's own repository into
shop-solution. Field names and behaviour are unchanged unless listed below.

### Added

- `POST /reset`: empties Marketing's tables so every system test and agent run starts from the same
  state. Off (404) unless `MARKETING_RESET_ENABLED=true`; requires `MARKETING_RESET_TOKEN` when set.
- `GET /orders/{orderId}/discounts`: now implemented. New fields `appliedBy`, `code`, `promotionId`,
  `discountTotal`. A promotion discount is now recorded too (before, only code redemptions were), so the
  invoice for step k shows the 10 % promotion.
- `operationId` on every operation.

### Changed

- Authentication: back-office operations use the shared Admin & Identity login and its
  `marketing_manager` permission (`IdentitySession`), or for local runs a Better Auth session plus an email
  allowlist (`LocalSession`). The team repository's mock login (`/dev/login`, `/dev/logout`, `/me`) is not
  part of shop-solution.
- New error `503 identity_unavailable` when the login cannot be checked.
- `POST /events` handles only `order.placed`; `order.cancelled` is answered with 400 until it is moved over.

### Not in shop-solution yet (still in the team repository)

Discount-code management (`/discounts/codes`), newsletter, campaigns, outbox, KPIs, campaign reports and the
CRM flow from 0.2.1. Codes can still be validated and redeemed; there is no API to create them here yet.

### Open

- Money stays a decimal with 2 places plus `currency` (e.g. `59.90 EUR`), as agreed with CRM and used by
  Storefront. The repository convention says integer cents. To settle with Accounting.
- M1's product id and format come from the catalog owner.

## 0.2.1 (session 7, team repository)

CRM ↔ Marketing campaign flow: segments, newsletter status per customer, deliveries, dispatch.

## 0.1.0 (sessions 3 to 6, team repository)

Discount codes, validate, promotions, order events, newsletter, campaigns, KPIs.
