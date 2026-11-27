# Marketing API changelog

Contract: [`marketing.yaml`](marketing.yaml) (OpenAPI 3.1), served under `/api/v1/marketing`.

## 0.3.0 (27 Nov 2026): first version in shop-solution

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
