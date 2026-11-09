# Logistics | Agent Context Package

## Purpose

The Logistics module turns authorized orders into trackable shipments, coordinates shipping methods and carrier updates, and exposes delivery status to other ERP modules. This exercise implements shipment-status validation, not a complete carrier integration.

## Structure

- `src/contracts.ts` — proposed cross-module types and **exact field names**.
- `src/shipment-status.ts` — transition policy, validation and outbound event generation.
- `test/shipment-status.test.mjs` — Node.js tests (positive, negative and edge cases).
- `specs/<feature>/` — spec, plan and tasks per feature. Read the matching spec before working on a feature.
- `INTERFACE_REVIEW.md` — contract questions requiring partner-team approval.

## Interfaces

- Inbound `OrderReadyForShipping`, outbound `ShipmentStatusChanged` (to Accounting / Storefront).
- Exact fields and status values live in `src/contracts.ts` — use those, never re-type them from memory.
- All interfaces are **proposals**; partner confirmation pending.

## Conventions

- TypeScript, `camelCase` fields, `PascalCase` types, `UPPER_SNAKE_CASE` status values.
- Only **direct** edges in `ALLOWED_TRANSITIONS` are valid; raise typed errors on invalid changes.
- Repeated status webhooks are idempotent; stale events are rejected. Timestamps use canonical UTC ISO-8601.
- Pure functions; Node `node:test` with one behavior per test and both allowed/forbidden cases.
- Do not change existing test files to make tests pass.

## Pitfalls (context rot)

- `orderId` identifies an order; `shipmentId` identifies a shipment. Never substitute them.
- `paymentStatus` belongs to the incoming order; `status` is shipment status.
- `trackingNumber` is a carrier reference, not an ERP shipment ID.
- `DELIVERY_FAILED` is retryable, unlike terminal `CANCELLED` and `RETURNED`.
- Do not infer any interface has been signed off; confirm naming, ownership and event timing with the neighbor team.
