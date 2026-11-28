# Better Auth implementation plan

**Goal** — Give the shared shop one account and session system, one server-side permission interface, and a verified path for every team to adopt it.

**Architecture** — Keep Better Auth's existing Next.js handler and PostgreSQL adapter. Admin & Identity provides a server-only actor and permission interface. Feature services apply ownership or membership checks against canonical shop IDs.

**Tech stack** — Next.js App Router, Better Auth 1.7.11, Prisma 7.10.1, PostgreSQL, Zod, Vitest, Playwright, and GitHub Actions. Use the lockfile versions when implementing.

**Spec** — [Shared authentication guide](../../authentication.md), [Admin & Identity contract](../../../src/features/admin-identity/README.md), and [shop data model](../../commerce/README.md).

## Global constraints

- Preserve the existing Better Auth HTTP handler and migration history. Review any new plugin and migration separately.
- Keep app-owned permission grants in the existing shop models. Name each route's authority and each grant's owner during implementation review.
- Match the repo's feature/server entry points, response envelopes for custom endpoints, review policy, and UI conventions.
- Exercise writes in disposable PostgreSQL. Publishing credentials, applying a migration to Neon, and retiring a shared adapter are rollout actions for authorized maintainers.

## Review focus

| Case                                                                                         | Required result                                                                                                               |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Valid session without the required role or resource membership                               | The request is denied and the resource is unchanged.                                                                          |
| Expired or revoked session, or a grant revoked during an active session                      | Session paths return `401`; removed permission returns `403` on the next protected request.                                   |
| Cross-origin writes, off-site return paths, or a spoofed actor in browser input              | The app rejects the request or uses a safe local destination. The authenticated actor comes from the server session.          |
| Unknown address, expired reset link, repeated reset link, or a verification email that fails | Public responses avoid disclosing account existence. Recovery stays available and no session is granted for an invalid token. |
| External Identity or database outage during cutover                                          | Protected access fails closed. Public discovery still works and the route's failure is observable.                            |

## 1. Confirm the authority and capture the baseline

**Files** — `docs/decisions/`, `src/features/admin-identity/README.md`, and the affected Search, Logistics, Marketplace, and Marketing contracts.

- [ ] Record the decision to use Better Auth for app sessions, named owners for role provisioning, the mail delivery choice by environment, and which external Identity routes will remain during the transition.
- [ ] List existing users, subject formats and legacy adapters from approved test environments. Decide whether each environment needs an explicit account binding, reinvitation, or disposable reseed. Document the method for legitimately linking an external subject to a local `User.id`.
- [ ] Rehearse `pnpm db:deploy` on disposable PostgreSQL with both committed migrations. Verify the current `/api/auth/get-session` behavior for a signed-out request and record any existing session or upgrade failures.
- [ ] Capture the first permission matrix with the feature owners. Use the existing moderation identifier `offers:approve` and review the proposed Logistics read/write permissions.

**Done when** everyone can identify what issues the session, where each permission comes from, and which integration must continue working while the shared auth UI is built.

## 2. Deliver shared login, signup, and recovery

**Files** — `src/server/auth.ts`, existing `src/app/api/auth/[...all]/route.ts`, `.env.example`, new route pages under `src/app/(auth)/`, Admin & Identity `components/` and `schemas/`, and a mail adapter under its server code. Use `src/features/admin-identity/auth-client.ts` for same-origin form calls.

- [ ] Add `/login` and `/signup` using the shared Button, Input, and Label. Cover pending and error states. Test that invalid credentials stay on the form and that a supplied external or protocol-relative return URL does not leave the app.
- [ ] Add a test mail sink and wire Better Auth verification and reset delivery callbacks. Enable verified signup for test accounts, confirm session cookies are issued by the library, and show generic confirmation for signup and recovery requests with unknown or pre-existing addresses as applicable.
- [ ] Add `/forgot-password`, `/reset-password`, and a signed-in account surface under the agreed route. Verify resend behavior, password reset through the client, rejection of expired or reused links, revocation of old sessions after reset, and sign-out on a second protected request.
- [ ] Verify HTTPS cookie settings and trusted origins on a test deployment. Confirm refresh and expiration behavior with the proposed session policy, and verify sign-in and recovery limits through the HTTP entry points.

**Done when** a user can register, verify, sign in, use an account page, reset a password, and sign out using PostgreSQL and test mail. Test keyboard access, session expiry, and safe recovery on mobile and desktop.

## 3. Deliver the shared authorization interface

**Files** — proposed `src/features/admin-identity/server/shop-access.ts` and `server/index.ts`, focused tests under `src/features/admin-identity/tests/`, and the feature README.

- [ ] Add tests for an anonymous session, expired session, actor with no grant, correctly scoped staff, removed grant, and database failure. Include a case where a caller sends a forged user ID or permission in request input.
- [ ] Implement the [actor and permission contracts](../../authentication.md#proposed-public-server-interface). Read current `RolePermission` grants with `UserRole`. Keep result unions and permission identifiers in feature exports. Use resource conditions in the owning feature's queries and services.
- [ ] Agree a controlled bootstrap for the first verified operator and required grants. Use an idempotent procedure by stable user ID, review the exact grant list, and record the actor, subject, action, and outcome. Test that signup and ordinary seller or staff roles cannot assign elevated permissions.
- [ ] Confirm customer provisioning with CRM and the customer-facing route owners. Test two concurrent first uses against the unique `Customer.userId` and verify existing customer references are retained.
- [ ] Add account and grant operational notes for support, including how to revoke access, how to re-verify an identity, and what to do when the session provider is unavailable.

**Done when** a protected route can authorize with one public server interface and a feature can scope access to the exact resource.

## 4. Move features in reviewable increments

| Increment                           | Change                                                                                                                                                                                  | Acceptance                                                                                                                                                                                                 |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logistics first                     | Update `src/features/logistics/server/session.ts` and its gateway from email allowlist to explicit read/write grants. Preserve the separate local demo and service-to-service contract. | Ordinary signed-in user gets denied, read-only staff cannot write, and revocation takes effect immediately on a new request. Accounting and demo requests continue under their own scopes.                 |
| Storefront and seller               | Once their feature branches are ready, use the shared auth routes and verify `Customer.userId` or `SellerMember` server-side. Coordinate removal of Marketplace's interim sign-in.      | A customer cannot access another customer's order. A seller cannot edit another seller's configured listing. The common login handles all browser entry points.                                            |
| Search moderation and Marketing     | Choose the authority for each route with Admin & Identity. Update consumers of `checkIdentityPermission` once their account binding and permission names are confirmed.                 | Public Search remains available without Identity. Moderators receive the expected results only with current permission. A retired or unavailable provider never becomes a route-level permissive fallback. |
| Accounting, CRM, Reviews, Analytics | Add agreed operation-level checks to each team PR. Verify resource ownership for customer-facing reads and use scoped service credentials for background calls.                         | Access matches the published feature contract and the negative cases cover other accounts, sellers and groups.                                                                                             |

For each increment, add or update contract tests, document the legacy and new behavior with clear service boundaries, and run the affected demo. Remove legacy configuration once all consumers of that path have switched and the rollback window is closed.

## 5. Add repeatable CI, then rehearse rollout

**Files** — `.github/workflows/ci.yml`, proposed `tests/e2e/auth.spec.ts`, database integration test configuration, and `docs/verification.md`.

- [ ] Start an isolated PostgreSQL service in a database integration job. Apply committed migrations with `pnpm db:deploy` using CI-only credentials, then run a persisted account/session test and schema-upgrade check. Start from a previous auth-only database in the upgrade case and preserve existing users.
- [ ] Run Playwright against a test app origin with an isolated mail sink and independent browser contexts for customer, seller, staff, and anonymous scenarios. Cover signup, verification, login, logout, recovery, expired sessions, role revocation, and foreign-resource denial. Verify test mail and fixtures are isolated from real users.
- [ ] Keep the normal quality checks in place. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the affected Playwright and Python suites. Attach sanitized summaries and state which checks ran against real PostgreSQL.
- [ ] Rehearse on an approved staging URL with the intended mail sender and proxy. Verify cookie flags, exact origins, and rate limits. Confirm log entries omit credentials and tokens. Check the cross-group review policy before merging.
- [ ] Stage each consumer switch separately. If registration, session lookup, or authorization fails, stop that switch and roll back the app/adapter configuration to its previously verified state. Preserve PostgreSQL migration history. Test rollback while the former adapter is still available.

**Done when** a fresh checkout and CI can exercise the same auth flow, and each switched consumer has a verified recovery procedure.

## 6. Scope the follow-up authentication work

- [ ] Decide the university SSO provider and protocol. Confirm identity identifiers and linking policies, then test conflicts with existing accounts before allowing sign-in with a new provider.
- [ ] Define staff MFA enrollment and recovery, device/session management, and account suspension and retention. Review provider and plugin schema changes as independent PRs.
- [ ] Review ongoing operational controls for outbound mail, secret rotation, and support for lost access. Document rehearsal results and approved owners.

## Delivery order

Start with the authority decision and the shared login flow. Ship the permission interface and Logistics as the first authorization adoption. Treat external Identity cutover, the remaining team integrations, and SSO/MFA as subsequent PRs with their own acceptance checks.
