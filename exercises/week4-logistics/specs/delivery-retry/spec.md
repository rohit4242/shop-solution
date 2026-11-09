# Feature: Delivery retry

## Why

Carriers often fail a delivery (customer not home). Today `DELIVERY_FAILED` is "retryable", but nothing limits retries or says what happens at the end. Packages could loop forever.

## User stories

- As Logistics, I want a failed delivery to be retried so that the customer still gets the package.
- As Logistics, I want the package returned to the sender after 3 failed attempts so that it does not loop forever.
- As Storefront (proposed), I want the attempt number so that the customer sees "Attempt 2 of 3".

## Acceptance criteria

1. `DELIVERY_FAILED → OUT_FOR_DELIVERY` is allowed while fewer than 3 attempts have failed.
2. `DELIVERY_FAILED → IN_TRANSIT` is allowed while fewer than 3 attempts have failed.
3. Each new `DELIVERY_FAILED` increases `failedAttempts` by 1.
4. A duplicate `DELIVERY_FAILED` webhook (same shipment, same status, `occurredAt` equal to the shipment's `updatedAt`) does not increase `failedAttempts` and emits no event.
5. On the 3rd failure the shipment ends in `RETURNED`; two events are emitted (`→ DELIVERY_FAILED`, then `DELIVERY_FAILED → RETURNED`).
6. After `RETURNED`, any retry raises `InvalidTransitionError`.
7. `DELIVERY_FAILED → CANCELLED` raises `InvalidTransitionError`.
8. Every `ShipmentStatusChanged` event carries `attemptCount` (= `failedAttempts` at that moment).

## Out of scope

- Customer notifications (Storefront)
- Return shipping costs (Accounting)
- Rescheduling a delivery date / parcel-shop pickup
- Customer-initiated returns (separate feature)

## Constraints

- `attemptCount` is a **proposal**; listed in `INTERFACE_REVIEW.md` until Storefront and Accounting agree.
- `failedAttempts` starts at 0; shipments created before this feature (no value) count as 0.
- Max attempts = 3 is a constant (`MAX_DELIVERY_ATTEMPTS`), not hard-coded in several places.
