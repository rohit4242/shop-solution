# Part 4 – Review of spec, plan, tasks and partner feedback

Files: `specs/delivery-retry/spec.md`, `plan.md`, `tasks.md` (4 tasks).

## What we corrected

| File    | Correction                                                                                                  | Why                                                                |
| ------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| spec.md | Added: `failedAttempts` starts at 0; shipments without the field count as 0                                 | Gap found while implementing T1                                    |
| spec.md | Criterion 4: a duplicate = same shipment, same status, and `occurredAt` equal to the shipment's `updatedAt` | Spec said "same updatedAt", but carrier webhooks send `occurredAt` |
| plan.md | `failedAttempts` is optional, not required                                                                  | Keeps existing shipments valid                                     |
| plan.md | Duplicate definition aligned with spec criterion 4 (`occurredAt`)                                           | Same gap as above                                                  |

## Partner feedback (feature touches Storefront and Accounting)

Request to: Storefront, Accounting

Message:

> Hi, Logistics is adding delivery retry: after 3 failed deliveries a shipment goes back to the sender automatically. We propose an optional field `attemptCount` (number) on `ShipmentStatusChanged`, so you could show e.g. "Attempt 2 of 3". Questions: (1) Do you want this field? (2) Storefront: should the customer be notified after each failure? (3) Accounting: who pays return shipping after 3 failures? Spec: specs/delivery-retry/spec.md. Thanks!

**Status at submission:** no feedback received yet. Until both teams answer, `attemptCount` stays a proposal (task T3 is on hold) and is listed in INTERFACE_REVIEW.md.
