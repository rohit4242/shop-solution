# 4. Data ownership (Marketing's rows)

Checked 28 Nov 2026: shop-solution has no data ownership table yet. `main` now has one shared shop database
([`docs/commerce/README.md`](https://github.com/rohit4242/shop-solution/blob/main/docs/commerce/README.md)): it lists which
teams _use_ each table, but says the class still has to name who may _change_ each kind of record
([`docs/team-ownership.md`](https://github.com/rohit4242/shop-solution/blob/main/docs/team-ownership.md): orders, checkout,
payments and inventory are unassigned). Until the class adds the table, these are Marketing's rows, as documented in
`src/features/marketing/README.md` (PR #23):

| Data                                                                                         | Writer                                                                   | Shared table(s)                                                             | Used by                                                        | How others read it                                                                                 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Automatic promotions and their conditions (type, value, products/categories, period, active) | Marketing                                                                | `promotion` (`automatic = true`), `promotion_product`, `promotion_category` | Storefront                                                     | `GET /promotions/active`, `POST /discounts/validate`                                               |
| Discount codes and their limits                                                              | Marketing (code management not ported yet)                               | `discount_code` and its `promotion`                                         | Storefront                                                     | `POST /discounts/validate`                                                                         |
| Discount applied to an order, per line                                                       | **checkout** (owner not assigned yet), using Marketing's validate result | `order_discount`, `order_discount_allocation`                               | Accounting (invoice), Marketplace, Marketing (code-use limits) | to agree with Storefront and Accounting (proposal: directly, or `GET /orders/{orderId}/discounts`) |
| Order events Marketing received (follow-up)                                                  | Marketing                                                                | `event_receipt` (consumer `marketing`)                                      | –                                                              | internal                                                                                           |

**Data Marketing uses but does not own** (we read only the IDs): products and categories (catalog owner), orders and
order lines (owner not decided yet), customers (CRM / Admin & Identity), logins and permissions (Admin & Identity).

_To do: copy the full table here once it exists in `constitution.md`, with its date._
