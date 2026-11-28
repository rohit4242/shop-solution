# Marketing status report (session 8)

Marketing team · Rhythm Kaushik · as of **Sat 28 Nov 2026**, to be updated on Mon 30 Nov

Status: **works** = runs in shop-solution and its tests pass · **partly** = works, but a partner module is missing or
stood in for by the test · **doesn't work** = not shown.

## Our steps

| Step                                      | What it should do                                                        | Status                            | Evidence                                                                                                                                                                            | Why / what is missing                                                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------ | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **j** Create 10 % promotion for M1        | Promotion with period and conditions, created in the shared UI           | **works** (once PR #23 is merged) | Screen `/marketing/promotions`; 145 module tests; UI test 10/10; system test 5/5 runs; agents 10/10                                                                                 | M1 is a stand-in catalog row (`M1`, 59.90) until the catalog owner's code is in                                                                                                                                  |
| **k** Buy a second M1 with the promotion  | Storefront gets the discount from us; it appears on Accounting's invoice | **partly**                        | PR #23: validate → 5.99 off 59.90 (system test 5/5). Follow-up branch: stored with the order as 599 cents in the shared `order_discount` (system test 5/5 with a checkout stand-in) | Storefront's checkout and Accounting's invoice are not in shop-solution; who sends `order.placed`, how the routes are protected and how the invoice reads the discount are still to agree (maintainer's request) |
| **o** Invoices for f and k (we take part) | Two invoices, one with the discount                                      | **partly**                        | Follow-up branch: `/orders/{id}/discounts` gives 5.99 for the k order, 404 for the f order                                                                                          | Accounting's invoices are not in shop-solution; the read is not in PR #23 until the hand-over is agreed                                                                                                          |

## What works on our side

- Promotions, discount validation and order events moved into shop-solution: [PR #23](https://github.com/rohit4242/shop-solution/pull/23)
  (draft, all CI checks green locally).
- **Update 28 Nov:** the maintainer moved `main` to one shared shop database model (PRs #28–#33), which already contains
  Marketing's tables (`promotion`, `discount_code`, `order_discount`, …) with amounts in whole cents, and named #23 as
  the PR that has to move onto them. **Done the same day:** Marketing has no tables of its own any more; it converts
  exactly between cents and our API's `59.90`. All evidence in this zip was re-run on the shared schema.
- **Scope agreed with the maintainer (28 Nov):** PR #23 = promotion management + discount validation. The order hand-over
  (`POST /events`, `GET /orders/{id}/discounts`, both without a login before) moved to the follow-up branch until
  Storefront and Accounting agree. Reset is local test setup only (always off in a production build). The promotions
  screen was checked against the shared design guide at 390 px and 1280 px (screenshots in a [PR #23 comment](https://github.com/rohit4242/shop-solution/pull/23#issuecomment-7233539902)).
- Follow-up branch: the discount of an order (promotion or code) is stored with the order by checkout, per line, so the
  invoice can show the step-k promotion; `GET /orders/{id}/discounts` reads it back as 5.99.
- `POST /api/v1/marketing/reset`: removes Marketing's rows only (keeps, deactivated, what an order uses); off unless
  enabled, optional token.
- Contract `marketing.yaml` 0.4.0 + changelog, lint-valid.
- Login through Admin & Identity's permission check (`marketing_manager`), or a local mode for tests.
- **Agents:** MCP server with 6 tools in PR #23 (7 with the follow-up). Two scenarios, 5 runs × 2 models: **20/20** in the final round, again 20/20 on
  the shared schema. The first
  stricter round found agents saying "done" while the promotion had lost its end date (3/10); fixed with an update tool.

## What doesn't work, and why

- **Partner modules missing** (checked 28 Nov): only Search & Recommendations and Logistics have code on `main`;
  Marketplace has 4 draft PRs (#24–#27); Storefront, Accounting, Admin & Identity, CRM have no code and no PR. Step k needs Storefront + Accounting.
- **Orders, checkout and inventory have no owner**, so nobody creates the order in step k (and f, l).
- **Shared login not tested live:** our check against Admin & Identity is covered by unit tests only; their service was
  not available to us.
- **Cross-module agent scenario not run:** checkout → invoice needs Storefront and Accounting.

## Open decisions with other teams

| Question                                                                                 | With                    | Status                                                                                                                                       |
| ---------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| M1's product id and id format                                                            | catalog owner           | open                                                                                                                                         |
| Invoice reads the discount from us (`/orders/{id}/discounts`) or from Storefront's order | Accounting              | settled by the shared schema (28 Nov): checkout writes `OrderDiscount` per order line, Accounting reads it; our endpoint reads the same rows |
| Money format: repo convention is integer cents, our API uses decimals (`59.90`)          | Accounting, maintainers | settled (28 Nov): cents in the database, our API converts                                                                                    |
| Owner of orders/checkout and inventory (steps f, k, l)                                   | all teams               | open                                                                                                                                         |
| Permission name `marketing_manager` and a demo user that has it                          | Admin & Identity        | open                                                                                                                                         |

## Next steps

Maintainer approves the fork CI run and adds us to the review roster → #23 ready for review (2 reviewers from 2 other
teams) → merged. Then agree the order hand-over with Storefront and Accounting and open the follow-up PR → joint test of
steps k and o once their code exists.
