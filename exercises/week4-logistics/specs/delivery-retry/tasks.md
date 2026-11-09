# Tasks: Delivery retry

Each task is small, reviewable, and test-first. Rule for the agent: **do not change existing test files.**

- [x] **T1 – Retry path and counter**
      Add `failedAttempts`, `MAX_DELIVERY_ATTEMPTS`, allow `DELIVERY_FAILED → IN_TRANSIT`, count each new failure, ignore duplicates.
      Criteria: 1, 2, 3, 4, 7

- [ ] **T2 – Auto-return after the last attempt**
      `applyStatusUpdate` returns `events[]`; on the 3rd failure add `DELIVERY_FAILED → RETURNED`; reject retries after that.
      Criteria: 5, 6

- [ ] **T3 – attemptCount on the event (proposal)**
      Add optional `attemptCount` to `ShipmentStatusChanged`; add question to `INTERFACE_REVIEW.md`.
      Criteria: 8

- [ ] **T4 – Update docs**
      Mention the retry rule in MODULE.md Pitfalls ("DELIVERY_FAILED is retryable up to 3 times").
