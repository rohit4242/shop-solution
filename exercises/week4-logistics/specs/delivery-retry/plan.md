# Plan: Delivery retry

## Approach

Extend the existing pure transition function. No new modules, no database.

## Changes

| File                           | Change                                                                                                                                                                                                                                                      |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/contracts.ts`             | `Shipment` gets optional `failedAttempts?: number` (missing = 0). `ShipmentStatusChanged` gets optional `attemptCount?: number` (proposal).                                                                                                                 |
| `src/shipment-status.ts`       | Add `MAX_DELIVERY_ATTEMPTS = 3`. Add `IN_TRANSIT` to the allowed targets of `DELIVERY_FAILED` (keep `OUT_FOR_DELIVERY`, `RETURNED`). `applyStatusUpdate` returns `{ shipment, events[] }` instead of a single event so the auto-return can emit two events. |
| `src/shipment-status.ts`       | New guard: a retry from `DELIVERY_FAILED` is rejected when `failedAttempts >= MAX`.                                                                                                                                                                         |
| `test/delivery-retry.test.mjs` | New test file, one test per acceptance criterion. Existing tests are not edited.                                                                                                                                                                            |
| `INTERFACE_REVIEW.md`          | New question: optional `attemptCount` on `ShipmentStatusChanged`.                                                                                                                                                                                           |

## Decisions

- Auto-return is done inside `applyStatusUpdate` (pure), not by a scheduler: simple and testable.
- Duplicate detection reuses the existing idempotency check (same status + `occurredAt` equal to the shipment's `updatedAt`).
- Returning `events[]` is a small API change; existing callers take `events[0]`.

## Risks

- Changing the return type may break existing tests → do it as the first task and keep old tests green.
