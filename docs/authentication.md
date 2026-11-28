# Shared authentication guide

This guide describes the proposed authentication setup for Shop Solution. The [implementation plan](superpowers/plans/2026-11-28-better-auth.md) records what still needs to be built and verified. Admin & Identity owns the app's sign-in and permission interfaces. The owners of checkout, orders, payment processing, and inventory still need class confirmation.

## What works today

| Area                      | Current behavior                                                                                                                                                                                                                                                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared application        | [Better Auth](../src/server/auth.ts) uses email and password with the Prisma adapter. [Its App Router handler](../src/app/api/auth/%5B...all%5D/route.ts) serves `/api/auth/*`. The [React client](../src/features/admin-identity/auth-client.ts) is available. The shared login page is a placeholder.              |
| PostgreSQL                | Better Auth uses `User`, `Session`, `Account`, and `Verification`. The [application schema](../prisma/schema.prisma) has `Role`, `Permission`, `UserRole`, `RolePermission`, `Customer`, and `SellerMember` for the shop. Those models need application authorization code and role provisioning.                    |
| External Admin & Identity | The [external adapter](../src/features/admin-identity/server/identity-client.ts) reads an external `erp_access_token` cookie for the discovery sign-in display and checks live moderation permissions. Its subjects use a different ID format.                                                                       |
| Logistics                 | The live gateway checks a local Better Auth session and a configured staff email allowlist. Its local demo uses a separate demo cookie.                                                                                                                                                                              |
| Pending team PRs          | Marketplace has interim sign-in and moderation access in [its draft stack](https://github.com/rohit4242/shop-solution/pull/24). Marketing uses the external Identity permission adapter in [its draft](https://github.com/rohit4242/shop-solution/pull/23). Verify each against its current head before changing it. |

## Target design

Use Better Auth as the session and account authority for the shared Next.js app. Keep its PostgreSQL-backed session and its native API under `/api/auth/*`. Use the existing shop tables for global permission grants and resource relationships. A feature may read the session through Admin & Identity's public server interface, then query its own record to verify ownership or seller membership. [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next) · [Prisma adapter](https://better-auth.com/docs/adapters/prisma)

```text
Browser -> shared login, signup, or account screen
        -> same-origin Better Auth client -> /api/auth/* -> PostgreSQL

Browser -> feature page, Server Action, or /api/v1/* handler
        -> read the current Better Auth session on the server
        -> check the required shop permission and resource relationship
        -> run the feature's validated operation
```

Use a verified local `User.id` from the server session as the actor's ID. For customer routes, resolve `Customer.userId` and check the order or address against that customer record. For seller routes, verify the current `SellerMember` relationship for the requested seller. A staff grant permits only the operations scoped by the relevant feature. Browser session hooks can update the UI; a server check decides access.

### Proposed public server interface

The following names are targets for implementation under `src/features/admin-identity/server/`. Re-export them from its server-only entry point when they exist.

| Interface                                                           | Contract                                                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `readShopActor(headers: Headers)`                                   | Returns `authenticated` with a minimal actor containing `userId` and `emailVerified`, `anonymous` for a missing/expired/revoked session, or `unavailable` for an identity or data-store failure. Consumers should not receive the session token.                                                                    |
| `checkShopPermission(headers: Headers, permission: ShopPermission)` | Re-reads the live session and current grants. Returns `allowed` with the actor, `unauthenticated`, `forbidden`, or `unavailable`. The affected feature separately verifies the actor's relationship to specific resources. Avoid duplicate session reads in a single request when this function is the entry point. |
| `getOrCreateCustomer(userId: string)`                               | Server-only trusted call after verified sign-in, used on first customer use if Admin & Identity and CRM agree. Upsert on `Customer.userId` so retries create at most one profile. The caller passes the actor ID from the session. Existing CRM identity links need explicit reconciliation.                        |

For protected UI, send anonymous users to `/login` with a validated internal return path. Check authorization again when the action runs. For custom JSON APIs, return the standard error envelope with `401` for no session, `403` for denied permission, and `503` when the authority is unavailable. A feature contract can use `404` for an out-of-scope resource when existence must stay private. Preserve Better Auth's native response shape. For a custom cookie-authenticated write, use the framework's approved origin protection or validate trusted origins in the handler. Direct `auth.api` calls do not pass through Better Auth's HTTP-handler protection. [Origin and callback guidance](https://better-auth.com/docs/reference/security)

### Proposed access rules

| Actor or caller        | Allowed scope                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Anonymous visitor      | Public catalog, public reviews, and docs.                                                                                                                                                                                     |
| Verified customer      | Own customer profile, cart, orders, shipment view, and qualifying review.                                                                                                                                                     |
| Seller member          | Own seller organization's listing and sales operations, within the assigned membership role.                                                                                                                                  |
| Moderator              | Explicit permission such as the published `offers:approve`; moderation never grants seller ownership or identity administration.                                                                                              |
| Staff                  | Explicit feature permissions. Propose `logistics:shipments:read` and `logistics:shipments:write` for the first protected workflow. Confirm Marketing and Accounting permission names with those teams before enabling routes. |
| Identity administrator | A verified identity provisioned through a separately authorized operator flow. Role changes record the actor, subject, grant/revoke action and outcome.                                                                       |
| Service caller         | An agreed service credential and an explicit operation scope. The Accounting-to-Logistics handoff keeps its documented service identity.                                                                                      |

Public signup creates an ordinary account. Grant staff permissions and seller access through authorized operations. Revoke a grant at the source and ensure the user's next protected action observes the change. If the class later adopts account suspension, define an account-state policy, session revocation, and a re-login rule in that PR.

## v1 account lifecycle

- **Registration and verification.** Build `/signup`, and send a Better Auth verification email through a server mail adapter. Use a local mail sink or in-process test adapter for disposable environments. Require verified email when rolling out to the shared app, after exercising delivery and the recovery path for existing users. Keep signup feedback generic where needed to avoid disclosing existing accounts.
- **Sign-in and sign-out.** Build `/login` with the existing client and shared UI. Return to a validated internal destination or the home page. Sign out through Better Auth and recheck server session state. Keep password masking and appropriate browser autocomplete attributes.
- **Password recovery.** Build `/forgot-password` and `/reset-password` using Better Auth's password-reset operations. Show equivalent request feedback for known and unknown addresses. Verify invalid, expired, and already-used links. Revoke existing sessions after a successful reset.
- **Account settings.** Add an authenticated account view with session status and logout. Add device/session management and change-password as a follow-up. Review email changes as a separate verified flow before exposing them.
- **SSO and staff MFA.** Decide after the core paths work. Confirm the university provider and enrollment policy, decide how accounts are linked, and compare plugin schema changes against the installed Better Auth version. Document recovery before enabling staff MFA.

Use Better Auth for password hashing, token handling, and cookie issuance. Proposed session settings for v1 are a seven-day expiry with a one-day refresh threshold and no cookie cache for authorization-sensitive checks. That is a rolling policy; decide whether privileged flows need a shorter absolute lifetime or recent re-authentication before enabling delegated admin operations. [Email and password](https://better-auth.com/docs/authentication/email-password) · [Session management](https://better-auth.com/docs/concepts/session-management)

## Environments and cutover

| Setting              | Expectation                                                                                                                                                                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`       | Local Compose PostgreSQL for developers and a disposable service for CI. Use the approved database and migrations for each deployed environment.                                                                                                                                              |
| `BETTER_AUTH_URL`    | Use the exact app origin, including local port. Production uses its HTTPS origin.                                                                                                                                                                                                             |
| `BETTER_AUTH_SECRET` | Generate a separate server secret per environment. Store deployed values in the environment's secret store. Keep real values out of logs and PRs.                                                                                                                                             |
| Trusted origins      | Allow exact required origins with the smallest deployment-specific list. Verify secure cookies on HTTPS and host-specific sessions in previews. Leave local origins restricted to the local environment.                                                                                      |
| Mail delivery        | Test-only sink for local and CI. A configured sender and a server-side provider credential for shared staging or production. Add variable names once the provider is chosen.                                                                                                                  |
| Rate limiting        | Verify the installed library's rules on sign-in, signup, resend, and reset. Choose shared rate-limit storage before deploying to multiple instances and test the deployed proxy configuration. Browser-facing custom endpoints need their own protection when they call server APIs directly. |

Keep the existing external Identity flow working until each dependent route has an agreed replacement. Map external subjects through an explicit, verified binding if the same users need migration. Email equality alone never establishes identity. Use test accounts to rehearse Search's public and moderation paths, change providers by route, and leave the former adapter available until users can sign in and the new permission checks behave correctly. An unavailable provider should fail closed on protected actions. [Better Auth security guidance](https://better-auth.com/docs/reference/security) · [Rate limiting](https://better-auth.com/docs/concepts/rate-limit)

## Instructions for Claude and Codex

1. Read this guide, the [Admin & Identity README](../src/features/admin-identity/README.md), and the target feature contract. Read the installed Next.js docs for the relevant APIs and verify Better Auth examples against the pinned package.
2. Reuse the library handler, the client export, and the Admin & Identity public server entry point. Add a missing operation there with the owning team instead of reading cookies or implementing session logic inside each feature.
3. Treat `userId`, roles, permissions, seller IDs, and return URLs from the browser as untrusted. Validate custom input with Zod and check actor and resource access on the server.
4. Before enabling a plugin, compare its required schema with [the existing one](../prisma/schema.prisma). Include the approved forward migration and affected consumers in the PR. Treat the existing auth migration as immutable.
5. Keep login, recovery, and permission changes scoped. Use disposable PostgreSQL, fixed test fixtures, and a test mail transport. Include positive and negative authorization coverage, list commands actually run, and report remaining external verification.
