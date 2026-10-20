# Architecture proposal

Use a modular monolith: one Next.js application and PostgreSQL database with explicit feature boundaries. Keep deployment simple while teams work independently.

## Boundaries

- app contains routes, layouts and thin composition; business logic belongs to features.
- features own business behavior and their database writes.
- Cross-feature imports use the target feature's index.ts or server/index.ts. Do not import its internal paths.
- index.ts is client-safe. Server entry points and secret-bearing files must import server-only at runtime.
- shared contains reusable UI and technical utilities. Business domains do not become shared simply because several teams use them.
- server contains application infrastructure, not a second location for feature business logic.
- Keep dependencies acyclic. Use explicit orchestration for workflows spanning features.
- Public operations document authorization, validation, return values and error behavior.
- Enforce authorization on every server operation; hiding UI is insufficient.

## Data and integration

One migration history, reviewed by a maintainer and affected owners. Each table has one writing owner. Cross-feature reads use documented queries; analytics may use agreed read models. Do not independently redefine product, customer or order identities.

Orders, checkout, payment processing and inventory ownership remain class decisions. Catalog editing belongs provisionally to Admin & Identity; agree its public read contract before Storefront/Search integration. External integrations start with explicit sandbox adapters and no real transactions.

## Initial integration milestone

Admin creates product → storefront displays product → customer places an order → accounting records it → logistics receives fulfillment information. Assign the missing core owners before implementing this journey.

## Enforcement plan

Server-only boundaries, strict TypeScript and CI are configured. Feature import restrictions still require automated enforcement; reviewers must check them.
