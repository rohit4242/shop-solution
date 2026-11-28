# Shop Solution

Shop Solution is the shared shop for the Agent-Based Software Development course. Ten teams develop it in one Next.js application. The shared catalog and order model let teams demonstrate a purchase from discovery through fulfillment.

## Audience and tasks

- **Customers** browse and compare offers, check stock and price, place orders, and track delivery.
- **Sellers** manage their listings and understand which offers need review.
- **Staff** moderate listings, prepare invoices and shipments, manage customer records, and report on shop activity.
- **Student contributors** find team contracts, run the shared app, and try the working modules and integration demos.

## Product boundaries

- Use one visual system across the customer storefront, role-based workspaces, and project docs. The [design system](DESIGN.md) describes the theme, components, and interaction rules.
- Keep product, seller offer, customer, order, payment, and shipment terminology aligned with the [shared shop data model](docs/commerce/README.md).
- Give public discovery a straightforward entry point. Protect staff and customer-specific actions through the feature's server permissions.
- Identify fixture-backed or sandbox experiences wherever a user might otherwise expect a real purchase or shipment. Link each workflow to its actual entry point.

## First reference workflows

1. Find a product, narrow the results, and compare available seller offers.
2. Review the total, supply delivery details, and confirm a sandbox order.
3. Find a seller listing or shipment, understand its current status, and take the next allowed action.

See [the repository README](README.md) for the implementation and the [frontend conventions](docs/constitution.md) for cross-team decisions.
