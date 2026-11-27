# marketing

Scope: Campaigns, newsletters, discounts and promotional pages.

Status: promotions and discounts for story steps j, k and o are implemented. Campaigns, newsletter and
discount-code management are still in the team's own repository and come in later PRs.

Read ../../../docs/architecture.md and ../../../docs/coding-conventions.md.

## Integration contract

Contract: [docs/marketing/marketing.yaml](../../../docs/marketing/marketing.yaml) (0.3.0), changelog:
[docs/marketing/CHANGELOG.md](../../../docs/marketing/CHANGELOG.md). Base path `/api/v1/marketing`.
Success is `{ "data": ... }`, errors are `{ "error": { "code", "message", "fieldErrors"? } }`.

| Operation                                                                                               | Who calls it                      | Auth                               | Main errors                                                                                         |
| ------------------------------------------------------------------------------------------------------- | --------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `POST /promotions`, `GET /promotions`, `GET/PATCH /promotions/{id}`, `POST /promotions/{id}/deactivate` | Marketing back office             | marketing manager                  | 400 `invalid_input` / `invalid_id`, 401, 403, 404 `promotion_not_found`, 503 `identity_unavailable` |
| `GET /promotions/active`                                                                                | Storefront                        | public                             | none                                                                                                |
| `POST /discounts/validate`                                                                              | Storefront checkout               | public                             | 400                                                                                                 |
| `POST /events` (`order.placed`)                                                                         | Storefront, server to server      | public                             | 400                                                                                                 |
| `GET /orders/{orderId}/discounts`                                                                       | Accounting (invoice), Marketplace | public                             | 404 `order_discount_not_found`                                                                      |
| `POST /reset`                                                                                           | system tests, agent runs, demo    | off unless enabled; optional token | 401, 404                                                                                            |

Server code in other modules imports only from `@/features/marketing/server`
(`validateDiscount`, `getOrderDiscounts`, `listPublicActivePromotions`); the HTTP handlers are exported
from there for `src/app/api/v1/marketing/**`. The back-office screen is `/marketing/promotions`.

### How the discount reaches the invoice (step k → o)

1. Storefront calls `POST /discounts/validate` with the cart. The best promotion (or code) is returned
   with a discount per line. One discount per cart, the biggest wins.
2. Storefront sends `order.placed` to `POST /events`, with `discountCode` only if the code won.
3. Marketing stores the applied discount for that order: the code's, or else the best promotion live at
   order time (the same rules as step 1).
4. Accounting reads `GET /orders/{orderId}/discounts` for the invoice. 404 means no discount.

## Authorization

`MARKETING_AUTH_MODE` (see `.env.example`):

- `identity` (default): the shared Admin & Identity login. Marketing calls
  `checkIdentityPermission(request, MARKETING_MANAGER_PERMISSION)` (default `marketing_manager`).
  The permission name still needs confirming with Admin & Identity.
- `local`: a Better Auth session in this app whose email is in `MARKETING_MANAGER_EMAILS`. For local runs
  and the system tests while the Identity service is not running.

The check runs on the server for every back-office request and for the screen.

## Owned data

Marketing is the only writer of these tables. We store other modules' IDs (order, product, customer),
never copies of their data.

| Table                      | Content                                                                |
| -------------------------- | ---------------------------------------------------------------------- |
| `marketing_promotion`      | Automatic promotions: type, value, products/categories, period, active |
| `marketing_discount_code`  | Codes (stored uppercase), limits, scope                                |
| `marketing_redemption`     | One use of a code per order; counts toward limits                      |
| `marketing_order_discount` | The discount applied to an order, per line (for the invoice)           |
| `marketing_received_event` | Every received event, for exactly-once handling                        |

## Money

A decimal with 2 places plus `currency` (`59.90`, `"EUR"`), computed with decimal.js, rounded half up per
line before summing. This differs from the repository convention (integer cents); it is open with
Accounting and the maintainers.

## Tests

- Module tests (Level 1, no database): `pnpm test src/features/marketing`. The story cases are in
  `tests/story-j-k.test.ts`.
- System test for steps j, k and o (Level 2, real database): start the app with
  `MARKETING_AUTH_MODE=local`, `MARKETING_MANAGER_EMAILS=manager@shop.test`,
  `MARKETING_RESET_ENABLED=true`, then run
  `BASE_URL=http://localhost:3000 MARKETING_RESET_TOKEN=<token> node src/features/marketing/tests/system/steps-j-k.mjs`.
  It resets, creates the promotion, buys M1, checks the invoice data through the API, and exits non-zero on
  any failed check. `M1_PRODUCT_ID` and `M1_PRICE` override the stand-in values.
- UI (Playwright): `MARKETING_E2E=1 pnpm test:e2e tests/e2e/marketing-promotions.spec.ts` with the same app
  settings. Skipped in CI, which has no database.

## Ownership

The Marketing class team owns this area. GitHub handles and reviewers will be assigned after class agreement.
