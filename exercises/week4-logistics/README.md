# Logistics – Week 4 exercise (Skills and spec-driven development)

Feature: delivery retry (what happens after a failed delivery).

| Part                        | Where                                                                          |
| --------------------------- | ------------------------------------------------------------------------------ |
| 1. Revised MODULE.md + note | `MODULE.md`, `MODULE.before.md`, `deliverables/1-MODULE-cleanup-note.md`       |
| 2. Skill + trigger test     | `.claude/skills/add-shipment-status/`, `deliverables/2-skill-trigger-test.md`  |
| 3. Grill-me decisions       | `deliverables/3-grill-me-decisions.md`, `specs/delivery-retry/grill-me-log.md` |
| 4. Spec, plan, tasks        | `specs/delivery-retry/`, `deliverables/4-review-and-partner-feedback.md`       |
| 5. Implemented task T1      | `src/`, `test/`, `deliverables/5-implemented-task-record.md`                   |

**Baseline note:** the baseline shipment-status code in `src/` was rebuilt from MODULE.md (same statuses, fields and rules), because the team's original code from last week was not in the repository yet. Task T1 was implemented on top of it. It will be merged with the team's original code once that is pushed.

Run the tests from the repository root: `pnpm test` (Vitest picks up `exercises/week4-logistics/test/*.test.mjs`).
