# Marketing

## Scope and status

Owned by the Marketing team: campaigns, newsletters, discounts and promotional pages
([team directory](../../../docs/team-ownership.md)).

Today: automatic promotions (create, change, deactivate, list) and discount validation at checkout.

Next, once agreed with Storefront and Accounting: how checkout stores the applied discount with the order and how the
invoice reads it. Discount-code management, campaigns and newsletters come in later PRs.

Depends on the shared catalog (the products and categories a promotion targets) and on Admin & Identity (login and the
`marketing_manager` permission).

## Run locally

1. `pnpm install`, then `pnpm db:deploy` against a disposable local database ([prisma/README.md](../../../prisma/README.md)).
2. Set the Marketing variables from `.env.example`:
   - `MARKETING_AUTH_MODE`: `identity` (default) or `local`;
   - `MARKETING_MANAGER_PERMISSION` (default `marketing_manager`);
   - `MARKETING_MANAGER_EMAILS` (local mode only);
   - `MARKETING_RESET_ENABLED`, `MARKETING_RESET_TOKEN` (local test setup only; reset is always off in a production
     build).
3. `pnpm dev`, then open `/marketing/promotions`.

A promotion can only target products that exist in the shared `product` table.

### Authorization

- `identity`: the shared Admin & Identity login. Marketing calls
  `checkIdentityPermission(request, MARKETING_MANAGER_PERMISSION)`. The permission name still needs confirming with
  Admin & Identity.
- `local`: a Better Auth session in this app whose email is in `MARKETING_MANAGER_EMAILS`, for local runs and tests.

The check runs on the server for every back-office request and for the screen.

## Public contract

Developer docs: `/docs/marketing` on the running site (source in `docs/` and `components/docs/`). Contract:
[api/openapi.yaml](api/openapi.yaml) (0.4.0), also served at `/docs/marketing/openapi.yaml` and `/docs/marketing/openapi.json`; changelog:
[api/CHANGELOG.md](api/CHANGELOG.md). Base path
`/api/v1/marketing`. Success is `{ "data": ... }`, errors are `{ "error": { "code", "message", "fieldErrors"? } }`.
Money is a decimal with 2 places plus `currency` (`59.90`, `"EUR"`) on the wire.

| Operation                                                                                               | Who calls it          | Auth                       | Main errors                                                                                         |
| ------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /promotions`, `GET /promotions`, `GET/PATCH /promotions/{id}`, `POST /promotions/{id}/deactivate` | Marketing back office | marketing manager          | 400 `invalid_input` / `invalid_id`, 401, 403, 404 `promotion_not_found`, 503 `identity_unavailable` |
| `GET /promotions/active`                                                                                | Storefront            | public                     | none                                                                                                |
| `POST /discounts/validate`                                                                              | Storefront checkout   | public                     | 400                                                                                                 |
| `POST /reset`                                                                                           | local tests           | local only; optional token | 401, 404                                                                                            |

Server code in other features imports from `@/features/marketing/server`: `validateDiscount(cart)` and
`listPublicActivePromotions(now)`. The same promotion operations are also available to AI agents at
`/api/mcp/marketing` (manager login; no reset or delete).

## Data and integrations

Marketing uses the shared shop schema ([docs/commerce/README.md](../../../docs/commerce/README.md), "Pricing and
campaigns") and has no tables of its own.

| Table                                     | Marketing                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `promotion`                               | writes automatic promotions (`automatic = true`); reads the promotion behind a code |
| `promotion_product`, `promotion_category` | writes a promotion's scope (foreign keys to the catalog)                            |
| `discount_code`                           | reads (validate)                                                                    |
| `order_discount`                          | reads only: counts a code's applied, non-reversed uses for its limits               |
| `product`, `category`                     | reads ids only                                                                      |

Money: cents and basis points in the database, decimals in the API. The conversion is exact; a value with more than
2 decimal places is rejected, never rounded. Discounts are rounded half up per line before summing.

Schema change for review: migration `20261128180000_promotion_description` adds a nullable `description` to
`promotion` (the customer-facing promotion text). It is additive.

`POST /reset` touches only Marketing's rows. A promotion or code that an order already used is deactivated instead of
deleted.

## Verification

- Module tests: `pnpm test src/features/marketing`.
- System test for promotions and validation (needs the app with `MARKETING_AUTH_MODE=local`,
  `MARKETING_MANAGER_EMAILS=manager@shop.test`, `MARKETING_RESET_ENABLED=true` and a disposable database):
  `BASE_URL=http://localhost:3000 DATABASE_URL=<same db> MARKETING_RESET_TOKEN=<token> node src/features/marketing/tests/system/steps-j-k.mjs`.
  It adds stand-in catalog rows (M1, M2) because the catalog is not in the repo yet.
- UI test: `MARKETING_E2E=1 pnpm test:e2e tests/e2e/marketing-promotions.spec.ts` with the same app settings. Skipped in
  CI, which has no database.
