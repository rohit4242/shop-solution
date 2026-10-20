# Forks and cross-group review

Students fork the shared repository, create a short-lived feature branch, and open a PR targeting upstream main. Keep the fork synchronized with upstream. A PR does not change main until it is merged.

## Proposed requirement

Two people from two distinct groups other than the author's group must approve the current revision. Each person belongs to exactly one group in .github/review-groups.json. Comments are not approvals. A new push requires renewed approvals. Latest changes-requested or dismissed decisions invalidate that person's approval.

The roster is deliberately empty until real GitHub usernames are supplied. An unregistered author cannot pass. For multi-author PRs, maintainers must also ensure reviewers are independent of every contributing group; the automated baseline only knows the PR author's roster group.

## Required repository settings

After creating GitHub upstream, configure main rules to require PRs, at least two approving reviews, dismissal of stale approvals, resolved conversations, and successful `quality` and `cross-group-review` statuses. Prevent force pushes and direct pushes, including administrator bypass where supported. Use CODEOWNERS for affected-feature and roster/workflow ownership; it does not guarantee multiple different groups by itself.

The supplied workflow evaluates the trusted roster at the PR base revision and posts a status on the PR head. It never checks out or executes fork code. A read-only Review event workflow triggers the trusted workflow through workflow_run; it re-evaluates open PRs after approvals or dismissals. Students can also post `/check-reviews` on a PR, or maintainers can use the manual pull_number input. These workflows must first exist on the default branch. Validate the full lifecycle with actual fork PRs before requiring the status.

Native GitHub required-review counts generally need reviewers with write access. Give class reviewers an appropriate upstream role while protecting main; they may still use forks. Restrict policy/roster ownership to maintainers. GitHub plan, repository visibility and organization settings must support the required protections.

Changing roster or workflows requires maintainer review. Repository protections are not configured locally. Test approvals, changed heads, dismissals and unknown members with sample fork PRs before class rollout.
