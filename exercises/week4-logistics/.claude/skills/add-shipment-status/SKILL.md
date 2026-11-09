---
name: add-shipment-status
description: Add, remove or change a shipment status or an allowed status transition in the Logistics module. Use when a task mentions a new status (e.g. RETURN_IN_TRANSIT), a new or forbidden transition, or retry rules between statuses.
---

# Add or change a shipment status / transition

1. Read `src/contracts.ts` and `src/shipment-status.ts` first. Do not rename existing statuses or fields.
2. Add the status to the `ShipmentStatus` union in `src/contracts.ts` (`UPPER_SNAKE_CASE`).
3. Update `ALLOWED_TRANSITIONS` in `src/shipment-status.ts`:
   - Add only **direct** edges. Never make `CANCELLED` or `RETURNED` a source (they are terminal).
   - Every status must appear as a key, even with an empty list.
4. If the status is terminal, add it to `TERMINAL_STATUSES`.
5. Check that `ShipmentStatusChanged` still uses the exact fields: `shipmentId`, `orderId`, `carrierCode`, `trackingNumber`, `previousStatus`, `status`, `updatedAt`.
6. Write **new** tests in `test/` (never edit existing ones):
   - one test per new allowed transition,
   - at least one forbidden transition into and out of the new status,
   - a duplicate-webhook (idempotent) case.
7. Run `pnpm test` and `pnpm typecheck`; report results.
8. If the change affects another module (Accounting, Storefront), add an open question to `INTERFACE_REVIEW.md` instead of assuming agreement.
