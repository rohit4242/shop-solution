# Logistics | Agent Context Package

## Purpose

The Logistics module turns authorized orders into trackable shipments, coordinates shipping methods and carrier updates, and exposes delivery status to other ERP modules. This exercise implements shipment-status validation, not a complete carrier integration.

## Structure

- `src/contracts.ts` — proposed cross-module types and **exact field names**.
- `src/shipment-status.ts` — transition policy, validation and outbound event generation.
- `test/shipment-status.test.cjs` — Node.js tests (positive, negative and edge cases).
- `INTERFACE_REVIEW.md` — contract questions requiring partner-team approval.

## Interfaces (proposed; partner confirmation pending)

- **Inbound from order/accounting boundary:** `OrderReadyForShipping` with `orderId`, `customerId`, `paymentStatus` (`PAID`), `shippingAddress` (`fullName`, `street`, `postalCode`, `city`, `countryCode`), and `shippingMethod` (`STANDARD` / `EXPRESS`).
- **Outbound to Accounting / Storefront:** `ShipmentStatusChanged` with `shipmentId`, `orderId`, `carrierCode`, `trackingNumber`, `previousStatus`, `status`, `updatedAt`.
- `status`: `CREATED`, `LABEL_CREATED`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_FAILED`, `RETURNED`, `CANCELLED`.
- All contract fields/types above are **proposals**, not verified neighboring-module schemas.

## Conventions

- TypeScript, `camelCase` fields, `PascalCase` types, `UPPER_SNAKE_CASE` status values.
- Only **direct** edges in `ALLOWED_TRANSITIONS` are valid; raise typed errors on invalid changes.
- Repeated status webhooks are idempotent; stale events are rejected. Timestamps use canonical UTC ISO-8601.
- Pure functions; Node `node:test` with one behavior per test and both allowed/forbidden cases.

## Pitfalls (context rot)

- `orderId` identifies an order; `shipmentId` identifies a shipment. Never substitute them.
- `paymentStatus` belongs to the incoming order; `status` is shipment status.
- `trackingNumber` is a carrier reference, not an ERP shipment ID.
- `DELIVERY_FAILED` is retryable, unlike terminal `CANCELLED` and `RETURNED`.
- Do not infer any interface has been signed off; confirm naming, ownership and event timing with the neighbor team.
