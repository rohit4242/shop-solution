# Shop Solution

Shared university shop project: one Next.js application and ten team-owned features.

## Local setup

Use Node.js 24 LTS and Docker. Enable Corepack or install the pnpm version named in package.json.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set BETTER_AUTH_SECRET in .env using: openssl rand -base64 32
docker compose up -d db
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Open http://localhost:3000. The homepage and /api/health work without a database; authentication needs the configured database, migrations and secret.

## Commands

- pnpm dev: development server.
- pnpm lint / pnpm typecheck / pnpm test: quality checks.
- pnpm build / pnpm start: production build and server.
- pnpm db:generate: regenerate Prisma client after schema changes.
- pnpm db:migrate: create and apply development migrations.
- pnpm db:deploy: apply committed migrations.
- pnpm format / pnpm format:check: formatting.

## Team guide

Read docs/architecture.md, docs/coding-conventions.md, docs/tech-stack.md and your feature README. Review docs/review-policy.md for forks and two independent group approvals. docs/class-review.md lists remaining class decisions.

src/app composes routes, src/features owns business behavior, src/shared contains UI/utilities and src/server supplies infrastructure. Claude Code and Codex read CLAUDE.md / AGENTS.md; matching workflows live in .claude/skills and .agents/skills.

## Scope

Includes Next.js, Tailwind, shadcn/ui, Zod, Prisma/PostgreSQL and Better Auth foundations. Business teams' folders remain scaffolded. Login UI, roles, SSO, 2FA, commerce models and completed shop flows are not implemented. Upstream repository: https://github.com/rohit4242/shop-solution. Repository protection rules still need to be configured.
