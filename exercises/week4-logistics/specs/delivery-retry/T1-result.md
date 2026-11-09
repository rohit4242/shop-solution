# T1 result – retry path + counter

**Baseline:** last week's shipment-status code was not available (teammate could not push), so the baseline was rebuilt from MODULE.md (same files, fields and rules) and committed first: 12/12 tests green.

**Setup:** agent got MODULE.md, spec.md, tasks.md (T1) and the rule "do not change existing test files". The `add-shipment-status` skill was loaded for the task (description matched: "transition … retry rules").

**Test-first:** 11 new tests written from criteria 1, 2, 3, 4, 7 → 6 failed before the change.

**After implementation:** 23 / 23 passing (12 old + 11 new); TypeScript compiles; `git diff` on the old test file is empty.

**Code change:** `DELIVERY_FAILED → IN_TRANSIT` edge, `MAX_DELIVERY_ATTEMPTS = 3`, `failedAttempts` counted on each new `DELIVERY_FAILED`. About 10 lines in `src/`.

## The three questions from the lecture

| Question                           | Answer                                                                                                                                        |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Did it stick to the spec?          | Yes. No `attemptCount` (that's T3), no auto-return (T2). One deviation from the plan: `failedAttempts` is optional, not required (see below). |
| Did the tests follow the criteria? | Yes. Every new test names its criterion; 3 extra tests cover forbidden edges and the unchanged event (skill step 6).                          |
| Where was the spec unclear?        | 3 places, below.                                                                                                                              |

## Where the spec was unclear

1. **Starting value:** spec doesn't say what `failedAttempts` is for shipments created before this feature. Chosen: missing = 0, so the field is optional. → add to spec.
2. **"Duplicate" definition:** criterion 4 says "same `updatedAt`", but carrier updates carry `occurredAt`. Mapped to the existing idempotency check (same status + `occurredAt` equal to the shipment's `updatedAt`).
3. **Limit inside T1?** Criteria 1–2 say "while fewer than 3 failures", but enforcing the limit is in T2. T1 only tests below the limit; nothing was invented.
