# Interface review — open questions for partner teams

| #   | Interface             | Question                                                            | Partner                  | Status |
| --- | --------------------- | ------------------------------------------------------------------- | ------------------------ | ------ |
| 1   | OrderReadyForShipping | Who emits it (order owner vs Accounting) and when?                  | Accounting / order owner | Open   |
| 2   | ShipmentStatusChanged | Are the status enum names acceptable as `UPPER_SNAKE_CASE`?         | Accounting, Storefront   | Open   |
| 3   | ShipmentStatusChanged | Is `updatedAt` the carrier observation time or our processing time? | Accounting, Storefront   | Open   |
| 4   | Split shipments       | Can one order produce several shipments?                            | Accounting               | Open   |
