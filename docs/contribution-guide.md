# Contribution guide

Use short-lived branches from main, for example feat/logistics/shipment-tracking or fix/reviews-rating-calculation. Open a draft PR early, keep it focused, and update from main regularly. Avoid permanent team branches.

Before requesting review, explain the behavior change, issue, affected teams, verification and migration impact. Get the owning team's review; cross-team contracts and shared infrastructure also need affected-owner or maintainer review. Squash merge and delete the branch after approval.

Open the draft from your fork against the shared repository's `main`. Fill in the PR template and call out dependencies for stacked PRs. For database changes, follow the [shared database rules](../prisma/README.md) and link the migration and affected contracts. Run the local checks, resolve the quality checks, then request two reviewers from two distinct groups outside your own. The cross-group status is evaluated after reviews on the current revision. If fork CI is awaiting maintainer approval, ask for the workflow to be approved and record the pending check in the PR.

## GitHub setup after class agreement

Create one organization team per feature. Populate .github/CODEOWNERS with real handles. Protect main against direct pushes and force pushes; require PR review, resolved conversations and CI. Confirm protection availability for the selected GitHub plan and repository visibility. CODEOWNERS alone does not enforce approval.

## Local checks and CI

Run pnpm install --frozen-lockfile, pnpm lint, pnpm typecheck, pnpm test and pnpm build. Run `pnpm contract:check`, `pnpm format:check`, and `pnpm test:e2e` for Search changes. Install Chromium first with `pnpm exec playwright install chromium`. The E2E runner starts the default dev server or uses `PLAYWRIGHT_BASE_URL` when you provide a running local app. See review-policy.md for the two-group requirement.
