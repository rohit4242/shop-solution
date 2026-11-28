# Contribution guide

Use short-lived branches from main, for example feat/logistics/shipment-tracking or fix/reviews-rating-calculation. Open a draft PR early, keep it focused, and update from main regularly. Avoid permanent team branches.

Before requesting review, explain the behavior change, issue, affected teams, verification and migration impact. Get the owning team's review; cross-team contracts and shared infrastructure also need affected-owner or maintainer review. Squash merge and delete the branch after approval.

Open the draft from your fork against the shared repository's `main`. Fill in the PR template and call out dependencies for stacked PRs. For database changes, follow the [shared database rules](../prisma/README.md) and link the migration and affected contracts. Run the local checks, resolve the quality checks, then request two reviewers from two distinct groups outside your own. The cross-group status is evaluated after reviews on the current revision. If fork CI is awaiting maintainer approval, ask for the workflow to be approved and record the pending check in the PR.

## Keep feature docs current

Keep your [feature README](README.md#where-teams-put-their-docs) as the starting point for setup and integration. Update it and its linked contracts in the same PR as user-visible or cross-team changes. Link the exact docs in the PR and call out compatibility changes. When work is internal, note why existing docs still apply. Add the published documentation or workspace link to the in-app `/docs` hub when it's ready for other teams.

Run `pnpm docs:check` before requesting review. A PR warning about a changed public interface means the author or reviewer should check the relevant documentation.

## Branch commands

```sh
git switch main
git fetch upstream
git merge --ff-only upstream/main
git switch -c feat/logistics/shipment-tracking
```

If the fast-forward fails, inspect both branches before updating. Push your feature branch to your fork and open a PR against upstream `main`.

## GitHub setup after class agreement

Create one organization team per feature. Populate .github/CODEOWNERS with real handles. Protect main against direct pushes and force pushes; require PR review, resolved conversations and CI. Confirm protection availability for the selected GitHub plan and repository visibility. CODEOWNERS alone does not enforce approval.

## Local checks and CI

Run `pnpm install --frozen-lockfile`, `pnpm docs:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm format:check`, and `pnpm build`. For Search changes, also run `pnpm contract:check` and `pnpm test:e2e`. Install Chromium first with `pnpm exec playwright install chromium`. The E2E runner starts the default dev server or uses `PLAYWRIGHT_BASE_URL` when you provide a running local app. See the [review policy](review-policy.md) for the two-group requirement.
