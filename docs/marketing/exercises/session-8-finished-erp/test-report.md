# 6. Test report (Marketing)

As of **Sat 28 Nov 2026**, on the shared shop schema that `main` adopted on 28 Nov, disposable local Postgres 17:

- **PR #23** (`feat/marketing/promotions`, commit `160e895`): promotion management + discount validation (steps j, k-checkout);
- **follow-up branch** (`feat/marketing/order-discounts`, commit `61c7a10`): adds the order hand-over for k → o.
  Results from 27 Nov (own `marketing_*` tables) are kept below where they explain the agent findings.

| Test                                                              | Level | Result                                              | Notes                                                                                                                                                                                                                                |
| ----------------------------------------------------------------- | ----- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Marketing module tests (`vitest run src/features/marketing`)      | 1     | **145 / 145 pass** (PR #23) · 152 / 152 (follow-up) | [evidence/module-test-output.txt](evidence/module-test-output.txt) (160 on 27 Nov, own tables)                                                                                                                                       |
| All repository tests (`pnpm test`, every team)                    | 1     | **240 / 240 pass** (PR #23) · 247 / 247 (follow-up) | plus docs check, lint, typecheck; build compiles, then Next.js stops on its 16.4.2 security advisory, the same on plain `main`                                                                                                       |
| UI test, promotions screen (Playwright, `--repeat-each=5`)        | 1     | **10 / 10 pass**                                    | create + error state + deactivate; [evidence/ui-test-output.txt](evidence/ui-test-output.txt)                                                                                                                                        |
| Step j + k checkout (system test, PR #23)                         | 2     | **5 / 5 runs pass**                                 | 70 / 70 checks (14 per run), incl. "unknown product → 400", M1+M2 cart; [evidence/system-test-output.txt](evidence/system-test-output.txt)                                                                                           |
| Step k → o (system test, follow-up branch)                        | 2     | **5 / 5 runs pass, with a checkout stand-in**       | 85 / 85 checks; the test writes the order and validate's discount (599 cents) into the shared tables, as checkout will; [evidence/system-test-output-j-k-o-handover-draft.txt](evidence/system-test-output-j-k-o-handover-draft.txt) |
| Step o (follow-up branch)                                         | 2     | **Marketing's half passes**                         | `/orders/{id}/discounts`: 5.99 for the k order, 404 for the f order; Accounting's invoices missing                                                                                                                                   |
| Whole story a to o                                                | 3     | **not run**                                         | most modules not in shop-solution yet                                                                                                                                                                                                |
| Agent scenario `m1-promotion-created` (step j)                    | agent | **10 / 10 pass** (5 per model)                      | round 5 on PR #23 (6 tools); 10/10 in every round                                                                                                                                                                                    |
| Agent scenario `m1-promotion-raised` (j → k)                      | agent | **10 / 10 pass** after the fix · was **3 / 10**     | round 5 on PR #23 10/10; see "Agent runs" below                                                                                                                                                                                      |
| Agent scenario `promotion-applied-at-checkout` (k across modules) | agent | **not run**                                         | needs Storefront + Accounting in shop-solution                                                                                                                                                                                       |

**Did the tests catch real faults?** Yes. Breaking the rounding (half up → down) or the login mapping made 12 module
tests fail. And a mistake I made while undoing that check (it turned "forbidden" into "allowed") was caught by
`session.test.ts`.

**Failures found and fixed during the port:**

- Step k would have shown no discount on the invoice: promotions were never stored per order. Fixed with
  `marketing_order_discount` (system test check "k/o: invoice data …").
- The UI tests reset each other's data when Playwright ran them in parallel (4 of 10 failed). Fixed by giving every test
  its own promotion instead of a shared reset.
- **28 Nov, design check of the promotions screen at 390 px:** the whole page scrolled sideways (710 px wide). Two causes:
  the page grid grew to the table's width, and the hidden "Actions" table header (absolutely positioned) escaped the
  table's scroll region. Fixed; the page is now exactly 390 px and only the table scrolls. Field errors were raw Zod text
  ("Too small: expected string to have >=1 characters"); now plain ("Enter a name."), and the UI test checks it.
- **28 Nov, moving onto the shared schema:** a promotion's products are now foreign keys to the catalog, so an unknown
  product id would have been a database error (500). It is now a 400 with `fieldErrors.productIds` (new system-test check).
  Checkout, not Marketing, writes the order's discount now, so the step-k test plays checkout instead of Marketing
  computing the discount from `order.placed`.

## Agent runs (27 and 28 Nov 2026, Groq)

Marketing's MCP server (`/api/mcp/marketing`, marketing-manager login, no reset/delete tool) + runner
`run-scenarios.mjs`. Every run starts from a reset; the result is checked **in code through the HTTP API**.
Raw data: [evidence/agent-runs](evidence/agent-runs/README.md).

| Scenario               | Model        | Round 1: first checks | Round 2: stricter check | Round 3: system fixed | Round 4: shared schema (28 Nov) | Round 5: PR #23 scope | Avg tokens / run (round 4) |
| ---------------------- | ------------ | --------------------- | ----------------------- | --------------------- | ------------------------------- | --------------------- | -------------------------- |
| `m1-promotion-created` | gpt-oss-120b | 5/5                   | –                       | **5/5**               | **5/5**                         | **5/5**               | ≈ 3,800                    |
| `m1-promotion-created` | gpt-oss-20b  | 5/5                   | –                       | **5/5**               | **5/5**                         | **5/5**               | ≈ 4,500                    |
| `m1-promotion-raised`  | gpt-oss-120b | 5/5                   | **3/5** (2 said "done") | **5/5**               | **5/5**                         | **5/5**               | ≈ 6,400                    |
| `m1-promotion-raised`  | gpt-oss-20b  | 5/5                   | **0/5** (5 said "done") | **5/5**               | **5/5**                         | **5/5**               | ≈ 6,300                    |

Round 4 repeats round 3 after the storage moved to the shared tables (same tools, same checks): 20/20, no run
said "done" while failing, no harness errors. Round 5 repeats it on the scoped PR #23 (6 tools, without
`get_order_discount`): again 20/20 (avg tokens ≈ 4,300 / 4,000 created, ≈ 6,100 / 6,000 raised).

**What happened in scenario 2** ("M1 has a 5 % promotion. Raise it to 10 %."):

- Round 1 looked perfect (10/10). Reading the stored data showed that in 6 of 10 runs the new 10 % promotion had
  **no end date**, although the old one ended on 31 Dec 2026. The shop would give 10 % off forever.
- The cause was our tool set, not the model: the MCP server had no update tool, so "raise it" meant _deactivate +
  create new_, and the period got lost on the way. Every one of the 7 failed runs in round 2 ended with the agent
  reporting success, e.g. _"The customer receives a discount of €5.99"_. That is true for today, but the end date was gone.
- **Fix the system, not the test:** added `update_promotion` (only sent fields change). Then every agent used it, and
  10/10 runs kept the period.
- A second lesson: our first round-2 check required "the old promotion is inactive", which checks _how_, not _what_.
  It would have failed a correct in-place update. The final checks only look at the outcome.

**Limits:** 5 runs per model and scenario. A scenario that fails 20 % of the time still passes 5/5 in 33 % of
cases (0.8⁵), so 5/5 is evidence, not proof. Only Marketing is involved: the checkout → invoice scenario needs
Storefront and Accounting.
