# Technology guide

Exact installed versions are recorded in package.json and pnpm-lock.yaml.

| Tool                 | Purpose                                                                                 | Location                       |
| -------------------- | --------------------------------------------------------------------------------------- | ------------------------------ |
| Next.js App Router   | Routes, server rendering, route handlers                                                | src/app                        |
| React and TypeScript | Components and checked interfaces                                                       | src                            |
| Tailwind CSS         | Utility styling and theme tokens                                                        | globals.css                    |
| shadcn/ui            | Owned, editable UI component source                                                     | shared/components/ui           |
| Zod                  | Runtime validation of untrusted inputs; TypeScript types alone do not validate requests | feature schemas                |
| PostgreSQL           | Relational persistence                                                                  | local Compose service          |
| Prisma               | Typed database access and versioned SQL migrations                                      | prisma and server/db.ts        |
| Better Auth          | Email/password sessions and auth endpoints                                              | server/auth.ts, admin-identity |
| Vitest               | Focused unit and business tests                                                         | feature tests                  |
| ESLint / Prettier    | Static checks / formatting                                                              | root configs                   |
| pnpm                 | Reproducible dependency installation                                                    | lockfile                       |

## API convention

Server Components call feature server queries directly. Do not HTTP-fetch your own API from server code. Browser mutations can use thin Server Actions; external/browser JSON integrations use route handlers under /api/v1/<resource>. Both call the same feature service layer.

Validate unknown request data with schema.safeParse; return 400 for invalid input, 401 for no session, 403 for denied permission, 404 for missing resources and 409 for business conflicts. Successful JSON APIs use { data: ... }; failures use { error: { code, message, fieldErrors? } }. Never return stack traces. Use request identifiers for diagnostics when logging is implemented. Document pagination and contracts in the owning README before exposing endpoints.

Better Auth owns /api/auth/* and its own response format; do not wrap those responses. /api/health is a public liveness endpoint, not a database readiness check.

## Authentication team handoff

The starter mounts Better Auth with the Prisma adapter and email/password enabled. User, Session, Account and Verification are its base schema. It provides a client module and server instance, not a finished login UI. Add login/signup forms using shared UI. Before protected features, implement session checks and resource-level authorization. Roles, SSO, 2FA, email delivery, verification/reset flows and admin management are team work, not implemented features. Do not assume every signed-in user is an admin.

Set a strong BETTER_AUTH_SECRET and the correct BETTER_AUTH_URL. Use HTTPS and appropriate deployment configuration outside localhost. Never share development databases or credentials with production.

## Sources

- https://nextjs.org/docs/app
- https://ui.shadcn.com/docs/installation/next
- https://better-auth.com/docs/integrations/next
- https://better-auth.com/docs/adapters/prisma
- https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference
- https://zod.dev/
