# Marketing API changelog

Contract: [openapi.yaml](openapi.yaml) (OpenAPI 3.1), served under `/api/v1/marketing`.

## 0.4.0 (28 Nov 2026): first version in shop-solution

Promotion management and discount validation on the shared shop schema. Earlier versions (0.1.0 to 0.3.0) lived in
the Marketing team's own repository.

### Operations

- Back office (marketing manager): `POST /promotions`, `GET /promotions`, `GET/PATCH /promotions/{id}`,
  `POST /promotions/{id}/deactivate`.
- Public: `GET /promotions/active`, `POST /discounts/validate`.
- Local test setup only: `POST /reset` (always off in a production build; in development only with
  `MARKETING_RESET_ENABLED=true`, optional bearer token).

### Compared with the team repository's 0.3.0

- Money on the wire is unchanged: a decimal with 2 places plus `currency` (`59.90`, `"EUR"`). The database stores
  cents and basis points; Marketing converts exactly and rejects more than 2 decimal places.
- `promotionId` and `campaignId` are opaque strings (cuids), no longer UUIDs.
- `productIds` / `categoryIds` must be ids from the shared catalog; an unknown id is a 400 with
  `fieldErrors.productIds` (or `categoryIds`).
- `PromotionAdmin` has no `createdAt` / `updatedAt`; lists are ordered by `validFrom`, newest first.
- A code's use for `maxUses` / `maxUsesPerCustomer` is counted from applied, non-reversed `order_discount` rows.
- The reset response has `deleted` and `deactivated` counts.

### Not in this version

`POST /events` (`order.placed`) and `GET /orders/{orderId}/discounts` wait for an agreement with Storefront and
Accounting on how checkout stores the applied discount and how the invoice reads it.

### Schema

Migration `20261128180000_promotion_description`: a nullable `description` on `promotion`, for review.
