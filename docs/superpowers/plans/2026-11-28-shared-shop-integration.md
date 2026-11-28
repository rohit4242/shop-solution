# Canonical shop database refactor plan

**Goal** — Adopt a single relational model for the classroom shop so all teams share canonical catalog, customer, order, payment, and fulfillment records.

**Design** — [Canonical database and team map](../../commerce/README.md), [review draft](../../commerce/shop-schema.draft.prisma), and the repo's [architecture](../../architecture.md) and [review policy](../../review-policy.md).

## 1. Agree the business entities and prepare contribution checks

- [ ] Confirm `Product → ProductVariant`, `Seller → Offer → OfferItem`, and `OfferItem → InventoryBalance` with Admin & Identity, Marketplace, Storefront, and Search. Use a test with two sellers listing the same product and separate stock and prices.
- [ ] Name the writers for catalog edits, checkout, orders, stock, and payment confirmation. Record the permissions, stable IDs, formats, and public read APIs before editing the application schema.
- [ ] Confirm identity authority, discount and tax rounding, and the one-invoice and one-shipment constraints for the initial story. Confirm the Accounting-to-Logistics handoff and Marketing's `order.placed` compatibility contract.
- [ ] Populate the trusted class roster and resolve authorized fork CI actions. Verify a sample fork PR can satisfy quality checks and two independent-group approvals.

**Acceptance** — Partner teams can identify the same product, offer item, customer, and order in shared fixtures and agree which interface owns each mutation.

## 2. Choose the migration path from actual database state

- [ ] Read PostgreSQL migration history in each authorized shared environment. Compare current `prisma/migrations/` with [Marketing #23](https://github.com/rohit4242/shop-solution/pull/23) and [Marketplace #24](https://github.com/rohit4242/shop-solution/pull/24). Treat draft-only tables as proposals until their migration status is known.
- [ ] Where only auth is applied, add forward migrations from the existing auth baseline. Revise the draft PRs to consume those canonical models as a dependency, with the author's coordination.
- [ ] Where a draft schema is already applied, keep its SQL history and add forward migrations to create the canonical tables, backfill, and reconcile them. Retire old storage in a separate approved cleanup after consumers have switched and counts and financial totals agree.
- [ ] Prepare fixtures for auth users, an offer with variants and images, a promotion and code, and a paid order with allocated discount. Rehearse upgrades on disposable databases and keep an explicit mapping for any legacy IDs. Validate using the team PR sources before replacing generated client calls.

**Acceptance** — A clean database and each supported upgrade baseline reach the same target model, existing logins remain usable, and mapped records and amounts reconcile exactly.

## 3. Land the canonical catalog and switch readers

- [ ] Add reviewed catalog and seller models to `prisma/schema.prisma`, with their migration under `prisma/migrations/`. Map sellers and memberships; normalize categories and product variants. Identify duplicates with the catalog owners before linking offers to existing products. Convert the base price and stock to one default `OfferItem`; map variants to their sellable items.
- [ ] Agree image storage. Verify every migrated image remains reachable through the public offer contract. Preserve offer status and apply the existing moderation and visibility rules when switching readers.
- [ ] Coordinate Marketplace's dependency stack [#24](https://github.com/rohit4242/shop-solution/pull/24) → [#25](https://github.com/rohit4242/shop-solution/pull/25) → [#26](https://github.com/rohit4242/shop-solution/pull/26) → [#27](https://github.com/rohit4242/shop-solution/pull/27). Publish provider contracts through feature server entry points. Switch Storefront and Search to the same reader.

**Acceptance** — Both sellers can offer the same product, stock is separate per offer item, and unapproved offers or inactive sellers do not appear in public catalog reads.

## 4. Create one canonical checkout and payment path

- [ ] Add customer, cart, order, line, address snapshot, inventory reservation, and payment models in owner-reviewed migrations. Keep order creation and the first outbox write in one transaction. Validate the customer, offer item, and currency on write.
- [ ] Checkout applies a confirmed promotion and stores `OrderDiscount` and its allocation once with the order. Adapt Marketing #23's Decimal JSON to minor units with exact conversion. In the integration fixture, a 10% discount on EUR 59.90 equals 599 minor units. If Marketing receives the event again, the receipt recognizes the original event ID and the app keeps the same applied discount rows.
- [ ] Use a transaction for reserving, committing, releasing, and expiring stock. Ensure constraints reject nonpositive quantities and balances with `held > onHand`. Test two checkouts competing for the last unit and the same cart being submitted twice.
- [ ] Record a sandbox payment using a stable operation key. Preserve immutable order totals and explicit tax and discount allocations. Revalidate older cart items before purchase and reject a reference across products or customers.

**Acceptance** — A retried checkout has one order, one successful stock effect, and one set of applied discounts. A duplicate payment confirmation does not charge or fulfill twice.

## 5. Integrate invoice, fulfillment, and derived reads

- [ ] Accounting builds one customer invoice from the canonical order lines and discounts. A seller sales view reads order lines linked to that seller. If there is already persisted seller-side handoff state, reconcile it against the invoice or preserve it in a specific linked acknowledgement record before retiring old tables.
- [ ] Accounting requests fulfillment through the existing Logistics contract after confirming payment. Connect Logistics persistence through its approved writer, using a unique order reference and idempotent event recording. Test an outage followed by a retry, a duplicate carrier report, and access to another customer's shipment.
- [ ] Add CRM features, reviews, and campaigns in reviewable increments. Tests must show that a review refers to an eligible purchased line, customer data is access-controlled, and promotion rules use canonical product/category IDs. Approve retention and consent policies before using those tables with real users.
- [ ] Build Search recommendations and Analytics reports from documented catalog and purchase projections. Define refunds and recognized revenue with Accounting so reporting uses the same semantics.

**Acceptance** — One approved listing can be bought, invoiced, and shipped in the sandbox. Storefront, Marketing, Accounting, Logistics, Search, and reporting all refer to the same product and order.

## 6. Verify, then adopt in shared development

- [ ] Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`, plus the Search contract check and affected Python and browser tests. Validate schema and SQL constraints in disposable PostgreSQL. Compare fresh and upgraded databases before declaring the migration safe.
- [ ] Once the affected teams and maintainers approve the changes, apply reviewed migrations to the authorized Neon development database and rerun auth and order-to-shipment smoke checks. Keep secrets outside the repo and document the migration version.

**Acceptance** — The application uses the canonical Prisma models, the shared environment passes smoke tests, and historical orders and invoices retain their original totals.
