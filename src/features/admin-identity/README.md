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

The server entry point exposes `readIdentitySession(request)` for the shared sign-in display and `checkIdentityPermission(request, permission)` for a live permission check. Both forward only the external Identity session cookie to `ADMIN_IDENTITY_API_URL`. The permission adapter follows the proposed `GET /auth/check` contract. Verify it against Admin's running service before the joint demo. Consumers import `index.ts` or `server/index.ts`.

## Ownership

The matching class team owns this area. GitHub handles and reviewers will be assigned after class agreement.
