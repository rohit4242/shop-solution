# Marketing: session 8 (the finished, tested ERP)

Marketing leads story steps **j** (create a 10 % promotion for the M1) and **k** (buy a second M1 with the promotion; the discount appears on the invoice), and takes part in step **o** (Accounting shows the invoices).

This folder is the course record as of 28 Nov 2026. For the current contract and setup, start at [docs/marketing](../../README.md).

| #   | Deliverable                                                   | Where                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Updated OpenAPI contract with its new version and a changelog | [marketing.yaml](../../marketing.yaml) (0.4.0), [CHANGELOG.md](../../CHANGELOG.md)                                                                                                                                         |
| 2   | Module tests (level 1) for our steps, with how to run them    | [src/features/marketing/tests](../../../../src/features/marketing/tests), commands under [Verification](../../../../src/features/marketing/README.md#verification), output in [evidence/](evidence/module-test-output.txt) |
| 3   | Status report: which steps work, which don't, and why         | [status-report.md](status-report.md)                                                                                                                                                                                       |
| 4   | Data ownership (Marketing's rows)                             | [ownership.md](ownership.md)                                                                                                                                                                                               |
| 5   | System tests per step (level 2) and agent scenarios           | [tests/system/steps-j-k.mjs](../../../../src/features/marketing/tests/system/steps-j-k.mjs), [scenarios-marketing.yaml](scenarios-marketing.yaml), [tests/agent](../../../../src/features/marketing/tests/agent)           |
| 6   | Test report: every step test, agent pass rates                | [test-report.md](test-report.md), raw runs in [evidence/agent-runs](evidence/agent-runs/README.md)                                                                                                                         |

**Headline (28 Nov):** step j works in PR #23 (system test 5 of 5 runs, UI test 10/10, agents 20 of 20). Step k's checkout discount works in PR #23. Storing it with the order and reading it for the invoice (k → o) runs on the follow-up branch `feat/marketing/order-discounts` with stand-ins, and waits for Storefront's checkout, Accounting's invoice and an agreement on the hand-over.

Deliverables 4 to 6 belong to all teams together; this folder holds Marketing's part. The whole story test (level 3) was not possible yet, because most modules were not in shop-solution on 28 Nov.
