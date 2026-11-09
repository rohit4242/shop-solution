# admin-identity

Scope: Accounts, authentication, permissions, admin back office and catalog editing.

Status: Better Auth foundation is wired through src/server/auth.ts, src/server/db.ts and /api/auth/[...all]. Read docs/tech-stack.md for the handoff. Login UI, authorization roles, SSO and 2FA remain team responsibilities.

Read ../../../docs/architecture.md and ../../../docs/coding-conventions.md.

## Folder responsibilities

- components: feature UI.
- hooks: client React hooks, only when needed.
- server/actions: thin server entry points; authenticate, authorize and validate input.
- server/services: business rules and workflows.
- server/queries: read use cases; use repositories where useful.
- server/repositories: feature-owned persistence access.
- schemas: Zod input validation.
- types: feature-specific types.
- utils: pure helpers.
- tests: meaningful feature tests.

## Integration contract

No public operations or owned tables have been agreed yet. Before implementation, document exported operations, inputs, outputs, authorization, errors and owned data here. Consumers import index.ts or server/index.ts, never internals.

## Ownership

The matching class team owns this area. GitHub handles and reviewers will be assigned after class agreement.

## Proposed Search playground integration

The Search playground consumes the existing public `auth` and `authClient` exports for email/password sign-in and session validation. It adds no global roles, auth tables or private cross-feature imports. Search owns a server-configured allowlist of approved Better Auth user IDs for its own experiment endpoint. Registration and sign-in alone do not grant access. Identity ownership and review remain with Admin & Identity; full login lifecycle against hosted PostgreSQL must be verified before release.
