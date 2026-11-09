# Search & Recommendations Implementation Plan

> For agentic workers: execute the approved plan in sequence. Preserve experiment isolation and never fabricate external review. The user authorised proceeding; no additional implementation-choice approval is needed.

**Goal:** Complete the module context exercise and then build an API-only mock-backed search/similarity prototype.

**Architecture:** Existing Next.js app, feature-owned services, thin HTTP handlers and a replaceable catalog adapter. HTTP contracts separate teams. No UI, database writes, direct cross-feature imports or production deployment.

**Tech Stack:** Existing strict TypeScript, Zod and Vitest; no new application dependencies.

**Spec:** The feature README, MODULE.md and docs/search-recommendations documents encode the approved conversational plan.

## Global constraints

Contracts are proposed until reviewed. Catalog provider is tentatively Admin & Identity; consumer is Storefront. Canonical purchase/inventory ownership is unassigned. EUR integer cents. Similarity is not co-purchase recommendation. No fabricated review, experiment or test results. No git metadata exists in this local folder; do not create history or claim commits.

## Review focus

Publication filtering must prevent hidden products leaking through either endpoint. Failure must not look like an empty catalog. Zero price and inclusive limits must work. Results must be deterministic. A/B sessions must not inherit a finished solution or project documentation.

## Task 1: Context and contracts

- [x] Draft feature MODULE.md and README, review packet and extended dependency register.
- [x] Prepare identical experiment prompt, fixture specification and evaluation rubric.
- [x] Prepare report/presentation templates and Part 4 table.
- [ ] Measure context tokens and verify rendered one-page length.
- [ ] Record the actual partner exchange and update both teams' files (external dependency).

## Task 2: Fresh-session experiment

- [ ] After review, freeze MODULE.md and hash it.
- [ ] Create identical isolated TypeScript/Vitest starters with the specified fixture JSON; no completed algorithm or inherited repository context.
- [ ] Run fresh sessions A and B using the protocol; preserve untouched outputs.
- [ ] Run common acceptance checks and record actual observations; draft the two-page conclusion.

## Task 3: API prototype (after experimental evidence)

- [ ] Define validated SearchProduct and request schemas in feature schemas/ and types/; write failing tests for invalid bounds, zero price, publication and ordering.
- [ ] Implement catalog adapter interface and mock catalog in server/repositories/; feature services accept adapter input rather than another team's code.
- [ ] Implement search service returning { items, total, page, pageSize }; test matching, AND filters, inclusive limits, pagination and no mutation.
- [ ] Implement similar service returning { items }; test category eligibility, distinct-tag ranking, tie-breaking, exclusions and missing source.
- [ ] Export server APIs through server/index.ts; add thin GET route handlers at /api/v1/search and /api/v1/recommendations/similar.
- [ ] Verify 400 INVALID_INPUT, 404 PRODUCT_NOT_FOUND and 503 CATALOG_UNAVAILABLE envelopes. Unknown/unpublished sources both return 404. Catalog failure never becomes success with empty results.
- [ ] Run pnpm lint, pnpm typecheck, pnpm test and pnpm build; HTTP smoke test both routes. Record actual commands and limitations.

## Task 4: Submission

- [ ] Finalise revised one-page MODULE.md and measured tokens.
- [ ] Render report to at most two pages using actual results.
- [ ] Check Part 4 terminology against lecture material when available.
- [ ] Prepare five-minute slides and speaker notes from actual observation.

## Execution status

Preparation may proceed now. Final experiment and prototype intentionally await the real interface review, following the approved sequence. No request to contact teams or submit work externally has been given.
