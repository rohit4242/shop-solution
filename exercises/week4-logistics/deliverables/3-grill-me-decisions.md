# Part 3 – Grill-me decisions: delivery retry

Feature: retry after a failed delivery (touches Storefront and Accounting via the attempt number).
Started with: `/grill-me After a failed delivery, the carrier should try again.` Answered as product owner, one question at a time.

"New to me?": ✓ = a question we had not thought of before the interview.

| #   | Question                                   | Decision                                                                           | New to me?   |
| --- | ------------------------------------------ | ---------------------------------------------------------------------------------- | ------------ |
| 1   | Which feature?                             | Delivery retry after `DELIVERY_FAILED`                                             | – (expected) |
| 2   | How many attempts before return to sender? | 3 failed attempts                                                                  | – (expected) |
| 3   | Where does a retry go?                     | `OUT_FOR_DELIVERY` or `IN_TRANSIT`                                                 | – (expected) |
| 4   | What happens when the last attempt fails?  | Automatic `RETURNED`; no more retries                                              | – (expected) |
| 5   | What counts as one attempt?                | Each `DELIVERY_FAILED` event                                                       | – (expected) |
| 6   | Duplicate `DELIVERY_FAILED` webhook?       | Counted once; no extra event                                                       | ✓ new        |
| 7   | Cancel while in `DELIVERY_FAILED`?         | Not allowed                                                                        | ✓ new        |
| 8   | Show attempt number to other modules?      | Propose optional `attemptCount` on `ShipmentStatusChanged`; needs partner approval | – (expected) |

Open, for partner teams: notify the customer after each failure (Storefront)? Who pays return shipping after 3 failures (Accounting)?

Not thought of before: the duplicate carrier message (6) and cancelling after a failed delivery (7) – both edge cases that would otherwise have shown up later as bugs.
