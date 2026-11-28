# Marketing

## Scope and status

Owned by the Marketing team: campaigns, newsletters, discounts and promotional pages
([team directory](../../../docs/team-ownership.md)).

Today: automatic promotions (create, change, deactivate, list), discount validation at checkout, and the
order discount for the invoice. This covers story steps j (10 % promotion for M1), k (buy M1 with it) and
Marketing's part of o (invoices). Discount-code management, campaigns, newsletter and the CRM flow are still
in the team's own repository and come in later PRs.

Depends on: the shared catalog (products and categories a promotion targets), checkout (stores the applied
discount with the order; its owner is not assigned yet, see [docs/team-ownership.md](../../../docs/team-ownership.md)),
and Admin & Identity (login and the `marketing_manager` permission).

## Run locally

1. `pnpm install`, then `pnpm db:deploy` against a disposable local database ([prisma/README.md](../../../prisma/README.md)).
2. Set the Marketing variables from `.env.example`:
   - `MARKETING_AUTH_MODE`: `identity` (default) or `local`;
   - `MARKETING_MANAGER_PERMISSION` (default `marketing_manager`);
   - `MARKETING_MANAGER_EMAILS` (local mode only);
   - `MARKETING_RESET_ENABLED`, `MARKETING_RESET_TOKEN`.
3. `pnpm dev`. The back-office screen is `/marketing/promotions`. The MCP server for agents is
   `/api/mcp/marketing` (manager login required).

A promotion can only target products that exist in the shared `product` table. Until the catalog team's code
is in, the system test creates stand-in products M1 and M2 ([tests/system/fixtures.mjs](tests/system/fixtures.mjs)).

### Authorization

- `identity`: the shared Admin & Identity login. Marketing calls
  `checkIdentityPermission(request, MARKETING_MANAGER_PERMISSION)`. The permission name still needs
  confirming with Admin & Identity ([docs/authentication.md](../../../docs/authentication.md) proposes
  Better Auth with shop permissions as the target).
- `local`: a Better Auth session in this app whose email is in `MARKETING_MANAGER_EMAILS`. For local runs and
  the system tests.

The check runs on the server for every back-office request and for the screen.

## Public contract

Contract: [docs/marketing/marketing.yaml](../../../docs/marketing/marketing.yaml) (0.4.0), changelog:
[docs/marketing/CHANGELOG.md](../../../docs/marketing/CHANGELOG.md). Base path `/api/v1/marketing`.
Success is `{ "data": ... }`, errors are `{ "error": { "code", "message", "fieldErrors"? } }`. Money is a
decimal with 2 places plus `currency` (`59.90`, `"EUR"`) on the wire.

| Operation                                                                                               | Who calls it                      | Auth                               | Main errors                                                                                         |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /promotions`, `GET /promotions`, `GET/PATCH /promotions/{id}`, `POST /promotions/{id}/deactivate` | Marketing back office             | marketing manager                  | 400 `invalid_input` / `invalid_id`, 401, 403, 404 `promotion_not_found`, 503 `identity_unavailable` |
| `GET /promotions/active`                                                                                | Storefront                        | public                             | none                                                                                                |
| `POST /discounts/validate`                                                                              | Storefront checkout               | public                             | 400                                                                                                 |
| `POST /events` (`order.placed`)                                                                         | Storefront, server to server      | public                             | 400                                                                                                 |
| `GET /orders/{orderId}/discounts`                                                                       | Accounting (invoice), Marketplace | public                             | 404 `order_discount_not_found`                                                                      |
| `POST /reset`                                                                                           | system tests, agent runs, demo    | off unless enabled; optional token | 401, 404                                                                                            |

Server code in other features imports only from `@/features/marketing/server`
(`validateDiscount`, `getOrderDiscounts`, `listPublicActivePromotions`). The HTTP handlers exported from
there back `src/app/api/v1/marketing/**`.

### How the discount reaches the invoice (step k → o)

1. Storefront calls `POST /discounts/validate` with the cart. The best promotion (or code) comes back with a
   discount per line. One discount per cart; the biggest wins.
2. Checkout stores exactly that discount with the order: one `order_discount` row plus an
   `order_discount_allocation` per line, in minor units (10 % of EUR 59.90 = 599).
3. Storefront sends `order.placed` to `POST /events`; Marketing records the receipt once.
4. Accounting reads the order's discount, directly or through `GET /orders/{orderId}/discounts` (5.99). A 404
   means no discount.

## Data and integrations

Marketing uses the shared shop schema ([docs/commerce/README.md](../../../docs/commerce/README.md), "Pricing
and campaigns"). It has no tables of its own.

| Table                                                           | Marketing                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `promotion`                                                     | writes automatic promotions (`automatic = true`); reads the promotion behind a code |
| `promotion_product`, `promotion_category`                       | writes a promotion's scope; foreign keys to the shared catalog                      |
| `discount_code`                                                 | reads (validate). Code management is not in shop-solution yet                       |
| `order_discount`, `order_discount_allocation`                   | reads only: checkout writes them; code use is counted from non-reversed rows        |
| `event_receipt`                                                 | writes one row per received order event (consumer `marketing`)                      |
| `product`, `category`, `shop_order`, `order_line`, `offer_item` | reads ids only                                                                      |

Money: integer minor units and basis points in the database, decimals in the API. The conversion is exact
(`utils/money.ts`); a value with more than 2 decimal places is rejected, never rounded. Discounts are
computed with decimal.js, rounded half up per line before summing.

Migration in this feature's PR: `20261128180000_promotion_description` adds a nullable `description` to
`promotion` (customer-facing text). It is additive; existing rows keep NULL.

`POST /reset` touches only Marketing's rows. A promotion or code that an order already used is deactivated
instead of deleted, because checkout's rows and invoices point at it.

## Verification

- Module tests (Level 1, mocked database): `pnpm test src/features/marketing`. Story cases are in
  `tests/story-j-k.test.ts` and `tests/order-discount-service.test.ts`.
- System test for steps j, k and o (Level 2, a disposable local PostgreSQL): run the app with
  `MARKETING_AUTH_MODE=local`, `MARKETING_MANAGER_EMAILS=manager@shop.test` and `MARKETING_RESET_ENABLED=true`, then
  `BASE_URL=http://localhost:3000 DATABASE_URL=<same db> MARKETING_RESET_TOKEN=<token> node src/features/marketing/tests/system/steps-j-k.mjs`.
  It plays the catalog and checkout with stand-in rows, checks every step through the API, and exits
  non-zero on any failed check (17 checks).
- MCP server without a model: `BASE_URL=... node src/features/marketing/tests/agent/mcp-smoke.mjs`.
- Agent runs (a model with only our MCP tools; outcomes checked through the API):
  `OPENAI_BASE_URL=... OPENAI_API_KEY=... OPENAI_MODEL=... BASE_URL=... MARKETING_RESET_TOKEN=... node src/features/marketing/tests/agent/run-scenarios.mjs --runs 5`.
- UI (Playwright): `MARKETING_E2E=1 pnpm test:e2e tests/e2e/marketing-promotions.spec.ts` with the same app
  settings. Skipped in CI, which has no database.

Limitations: checkout, the catalog and Accounting's invoices are not in shop-solution yet, so the system test
stands in for them. Discount-code management, `order.cancelled` and free-shipping promotions are not ported.
