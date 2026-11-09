# Grill-me log: Delivery retry

Started with: `/grill-me After a failed delivery, the carrier should be able to try again.`
Product owner: Logistics team. Questions asked one at a time; each only after its prerequisite was answered.

| #   | Question                                          | Decision                                                                            |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Which feature?                                    | Delivery retry after `DELIVERY_FAILED`                                              |
| 2   | How many attempts before return to sender?        | 3 failed attempts                                                                   |
| 3   | Where does a retry go from `DELIVERY_FAILED`?     | `OUT_FOR_DELIVERY` **or** `IN_TRANSIT`                                              |
| 4   | What happens when the last attempt fails?         | System moves the shipment to `RETURNED` automatically; further retries are rejected |
| 5   | What counts as one attempt?                       | Each `DELIVERY_FAILED` event                                                        |
| 6   | Duplicate `DELIVERY_FAILED` webhook?              | Counted once; idempotent, no extra event                                            |
| 7   | Can a shipment be cancelled in `DELIVERY_FAILED`? | No                                                                                  |
| 8   | Show attempt number to other modules?             | Propose optional `attemptCount` on `ShipmentStatusChanged`; needs partner approval  |

## Decision tree

```
Delivery retry
├── How many attempts? ── 3 (counted per DELIVERY_FAILED, duplicates once)
├── Retry path? ───────── OUT_FOR_DELIVERY or IN_TRANSIT
├── Last attempt fails? ─ auto RETURNED, no more retries
├── Cancel allowed? ───── no
└── Tell other modules? ─ attemptCount (proposal → INTERFACE_REVIEW)
```

## Open (not decided, needs partner teams)

- Does Storefront want to notify the customer on each failure? (Storefront)
- Who pays return shipping after 3 failures? (Accounting)
