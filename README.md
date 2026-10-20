# Shop Solution

A shared university shop project built by ten teams in the Agent-Based Software Development course. We work in one repository and one application, with feature ownership and pull-request reviews across groups.

**Repository:** [rohit4242/shop-solution](https://github.com/rohit4242/shop-solution)

## New to the project? Start here

1. Send the repository owner your GitHub username and class group; accept the collaborator invitation.
2. Read this README and your team's README under `src/features/`.
3. Fork the repository, clone your fork, and follow the local setup below.
4. Read the [feature guide](docs/feature-guide.md) before writing code.
5. Choose a small task, create a feature branch, and open a draft pull request early.

## Current status

The starter includes Next.js, shared UI components, PostgreSQL configuration, Prisma auth models and an initial migration, Better Auth wiring, validation examples, tests, and GitHub workflows. The initial GitHub CI run passed.

The shop's business features are still scaffolds. Login/signup screens, roles and permissions, SSO, 2FA, email delivery, and complete shopping flows are not implemented. Database-backed authentication still needs verification with PostgreSQL running. See [verification notes](docs/verification.md).

The proposed merge policy requires **two reviewers from two different groups other than the PR author's group**. Workflow code is included; enforcement requires a populated class roster and GitHub branch protection. These settings are not established just by cloning this repository.

## Tech stack

| Technology                | What we use it for                                                                     |
| ------------------------- | -------------------------------------------------------------------------------------- |
| Next.js App Router        | Pages, layouts, server rendering, Server Actions, and API route handlers               |
| React + strict TypeScript | UI components and checked application interfaces                                       |
| Tailwind CSS              | Styling and shared theme tokens                                                        |
| shadcn/ui + Radix UI      | Accessible UI primitives with editable source in our repository                        |
| PostgreSQL                | Relational database; each developer runs a local instance                              |
| Prisma                    | Typed database access, schema, and versioned SQL migrations                            |
| Better Auth               | Authentication, accounts, and sessions                                                 |
| Zod                       | Runtime validation of untrusted inputs; TypeScript does not validate incoming requests |
| Vitest                    | Unit tests and business-rule tests                                                     |
| ESLint + Prettier         | Static checks and consistent formatting                                                |
| pnpm                      | Dependency installation and the shared lockfile                                        |
| GitHub Actions            | Automated quality checks and cross-group review checks                                 |

Exact versions are pinned in [package.json](package.json) and [pnpm-lock.yaml](pnpm-lock.yaml). See the [technology and API guide](docs/tech-stack.md) for details.

## Repository structure

```text
shop-solution/
├── .agents/skills/              # Codex workflows
├── .claude/skills/              # Matching Claude Code workflows
├── .github/                     # CI, review policy, CODEOWNERS, PR template
├── docs/                        # Architecture, conventions, and team guides
├── prisma/
│   ├── schema.prisma            # Database models
│   └── migrations/              # Committed SQL migration history
├── public/                      # Public static assets
├── src/
│   ├── app/                     # Routes, layouts, and thin page composition
│   │   ├── (storefront)/        # Customer-facing routes; group name is not in URLs
│   │   ├── (auth)/              # Future authentication screens
│   │   ├── admin/               # Future admin back office
│   │   ├── seller/              # Future Marketplace seller dashboard
│   │   └── api/                 # HTTP handlers, including Better Auth and health
│   ├── features/                # Team-owned business functionality
│   │   ├── accounting/
│   │   ├── admin-identity/
│   │   ├── crm/
│   │   ├── logistics/
│   │   ├── marketing/
│   │   ├── marketplace/
│   │   ├── storefront/
│   │   ├── search-recommendations/
│   │   ├── reviews-ratings/
│   │   └── analytics-reporting/
│   ├── shared/                  # Reusable technical UI, schemas, hooks, utilities
│   ├── server/                  # Shared database and auth infrastructure
│   └── generated/prisma/        # Generated locally; not committed
├── tests/                       # Cross-cutting tests; e2e placeholder
├── AGENTS.md                    # AI assistant entry instructions
├── CLAUDE.md                    # Claude Code entry instructions
├── compose.yml                  # Local PostgreSQL
└── .env.example                 # Variable names and local-only examples
```

Some directories contain only `.gitkeep` placeholders. A folder does not mean its feature is implemented. Playwright is planned for the first integrated journey and is not installed yet.

### Inside a feature

Every team starts with the same convention. Logistics is shown as an example:

```text
features/logistics/
├── components/                  # Feature-specific UI
├── hooks/                       # Client React hooks, when needed
├── schemas/                     # Zod schemas for feature input
├── types/                       # Feature-specific TypeScript types
├── utils/                       # Pure feature helpers
├── server/
│   ├── actions/                 # Thin Server Actions
│   ├── services/                # Business rules and workflows
│   ├── queries/                 # Read use cases
│   ├── repositories/            # Persistence access
│   └── index.ts                 # Public server interface; server-only
├── tests/                       # Feature tests
├── index.ts                     # Public client-safe exports
└── README.md                    # Scope, owner, contracts, and owned data
```

Add files as needed; avoid empty service wrappers just to fill the structure. Follow the [worked feature example](docs/feature-guide.md) for naming, imports, Zod validation, and request flow.

## Teams and ownership

| Team feature                                                              | Responsibilities                                                      |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| [Accounting](src/features/accounting/README.md)                           | Invoices, VAT, refund bookkeeping, financial exports                  |
| [Admin & Identity](src/features/admin-identity/README.md)                 | Authentication, permissions, admin back office, catalog editing       |
| [CRM](src/features/crm/README.md)                                         | Customer profiles, contact history, segmentation                      |
| [Logistics](src/features/logistics/README.md)                             | Shipping methods, carriers, shipments, tracking                       |
| [Marketing](src/features/marketing/README.md)                             | Campaigns, newsletters, discounts, promotional pages                  |
| [Marketplace](src/features/marketplace/README.md)                         | Seller onboarding, commissions, seller dashboards including `/seller` |
| [Storefront](src/features/storefront/README.md)                           | Shop navigation, product presentation, cart UI                        |
| [Search & Recommendations](src/features/search-recommendations/README.md) | Search, filters, autocomplete, recommendations                        |
| [Reviews & Ratings](src/features/reviews-ratings/README.md)               | Reviews, ratings, moderation, verified purchases                      |
| [Analytics / Reporting](src/features/analytics-reporting/README.md)       | Revenue, conversion, product and stock reports                        |

**Ownership still needs agreement for orders, checkout, payment processing, and inventory.** Agree the canonical product model and its public contract with Admin & Identity before creating competing models. Shared infrastructure and migrations need designated maintainers. See [team ownership](docs/team-ownership.md).

## Local setup

### Prerequisites

- Git and a GitHub account.
- Node.js 24 LTS.
- pnpm **12.14.0**, matching `packageManager` in `package.json`.
- Docker with its daemon running, for local PostgreSQL.

If pnpm is not available, install the pinned version using your Node package manager:

```sh
npm install --global pnpm@12.14.0
```

Use pnpm for this project after that; commit `pnpm-lock.yaml`, not competing npm or Yarn lockfiles.

### Fork and clone

Click **Fork** on GitHub, then replace `YOUR_USERNAME` below with your account:

```sh
git clone https://github.com/YOUR_USERNAME/shop-solution.git
cd shop-solution
git remote add upstream https://github.com/rohit4242/shop-solution.git
```

`origin` is your fork; `upstream` is the shared class repository.

### Install and configure

```sh
pnpm install --frozen-lockfile
cp .env.example .env
openssl rand -base64 32
```

On PowerShell, use `Copy-Item .env.example .env` instead of `cp`. Generate a random secret using an available secure generator if OpenSSL is unavailable.

Paste the generated secret into your local `.env`:

```dotenv
DATABASE_URL="postgresql://shop:shop@localhost:5432/shop"
BETTER_AUTH_URL="http://localhost:3000"
BETTER_AUTH_SECRET="paste-your-generated-secret-here"
```

These database credentials are for local development only. Each student uses their own database and auth secret. `.env` is ignored by Git; `.env.example` documents configuration without real secrets.

### Start the application

```sh
docker compose up -d db
pnpm db:generate
pnpm db:deploy
pnpm dev
```

Open [localhost:3000](http://localhost:3000).

- `/` displays the project starter page.
- `/api/health` checks application liveness, not database readiness.
- `/api/auth/*` is handled by Better Auth; persisted auth needs PostgreSQL and the applied migration.
- Login, admin, and seller screens remain team implementation tasks.

If PostgreSQL is not ready, check `docker compose ps` and `docker compose logs db`. If port 5432 is occupied, change the host port in `compose.yml` and update `DATABASE_URL` to match. Use `docker compose stop db` to stop the database while retaining its data volume.

## Everyday development

Update your local main from the shared repository, then branch for one task:

```sh
git switch main
git fetch upstream
git merge --ff-only upstream/main
git switch -c feat/logistics/shipment-tracking
```

If the fast-forward fails, inspect the divergence before continuing; do not force-push over shared history.

After editing, run the checks and push the feature branch:

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build

git add src/features/logistics
# Also stage any intentional route, test, or documentation changes.
git commit -m "feat(logistics): add shipment tracking"
git push -u origin feat/logistics/shipment-tracking
```

Open a PR with **base `rohit4242/shop-solution:main`** and your fork's feature branch as the head. Keep PRs focused and describe behavior, affected teams, schema changes, and checks actually run. Do not push feature work directly to upstream main.

### Reviews and merging

The agreed proposal is two approvals from two different groups outside the author's group, plus passing CI. New commits require fresh approvals for the current revision. The roster check only identifies the PR author's group; maintainers must also account for other contributing groups on multi-author PRs.

Maintainers must populate [the class roster](.github/review-groups.json), assign [CODEOWNERS](.github/CODEOWNERS), configure required checks and branch protections, and validate the fork-review lifecycle. GitHub's approval count alone does not enforce distinct groups. Until these settings are active, the policy is not a guaranteed merge restriction.

Use `/check-reviews` as a PR comment to refresh the group check if needed. A maintainer may need to approve the first workflow run from a fork. See the [review policy](docs/review-policy.md) and [contribution guide](docs/contribution-guide.md).

## Architecture and coding rules

- Keep routes and actions thin; business rules belong to their owning feature.
- Use Server Components by default. Introduce client components for browser interactions and state.
- Use kebab-case filenames, PascalCase component/type names, and camelCase functions.
- Consume another feature through `@/features/<feature>` or `@/features/<feature>/server`; do not import its internals.
- Keep public client exports free of Prisma, secrets, and server code. Mark server modules with `server-only`.
- A feature owns its database writes. Coordinate cross-feature changes through documented public services.
- Reuse shared shadcn components from `@/shared/components/ui/`; keep feature-specific UI inside the feature.
- Validate untrusted inputs on the server with Zod. Authenticate and authorize every protected operation; hiding UI does not protect data.
- Agree public contracts and migration changes with affected teams. Never edit an already-applied migration.

Feature import restrictions are currently review conventions; ESLint does not yet enforce those boundaries automatically.

### API and authentication basics

```text
Browser → Route Handler / Server Action → Session + permission checks
        → Zod validation → Feature service → Repository → Prisma → PostgreSQL
```

Server-rendered pages call feature server queries directly, rather than HTTP-fetching their own API. Business JSON endpoints will use `/api/v1/<resource>` with `{ data: ... }` for success and `{ error: { code, message } }` for errors. Better Auth keeps its own `/api/auth/*` response format. See [API conventions](docs/tech-stack.md).

The auth foundation lives in `src/server/auth.ts`, with the browser client in `src/features/admin-identity/auth-client.ts`. Prisma currently defines `User`, `Session`, `Account`, and `Verification`. Admin & Identity owns the next steps: forms, session-aware screens, authorization, and agreed SSO/2FA/email flows. A signed-in account is not automatically an administrator.

## Useful commands

| Command                                  | Purpose                                        |
| ---------------------------------------- | ---------------------------------------------- |
| `pnpm dev`                               | Start the development server                   |
| `pnpm lint`                              | Run ESLint                                     |
| `pnpm typecheck`                         | Generate Prisma client and check TypeScript    |
| `pnpm test`                              | Run unit and policy tests                      |
| `pnpm format` / `pnpm format:check`      | Format / check formatting                      |
| `pnpm build` / `pnpm start`              | Build / serve production output                |
| `pnpm db:generate`                       | Generate the Prisma client                     |
| `pnpm db:migrate --name describe-change` | Create and apply a local development migration |
| `pnpm db:deploy`                         | Apply committed migrations                     |

Commit both intentional schema changes and their new migration. Generated Prisma client files remain untracked. CI checks lint, types, tests, formatting, Prisma schema validity, and production build; it does not currently exercise PostgreSQL-backed auth or full shop journeys.

## Working with Claude Code and Codex

[CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) point assistants to the same architecture and coding rules. Matching `create-feature` and `review-feature` workflows live in `.claude/skills/` and `.agents/skills/`; keep the copies synchronized when editing them.

Tell the assistant your feature, task, and agreed contract. Review its diff and test evidence before opening a PR. AI-written changes follow the same checks and human review policy as other changes.

## Documentation map

| Guide                                            | Read it for                                                  |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [Architecture](docs/architecture.md)             | Feature boundaries and integration model                     |
| [Feature guide](docs/feature-guide.md)           | Annotated folders, imports, validation, and worked examples  |
| [Coding conventions](docs/coding-conventions.md) | Naming, components, validation, money, and errors            |
| [Technology and APIs](docs/tech-stack.md)        | Tool responsibilities, request conventions, and auth handoff |
| [Team ownership](docs/team-ownership.md)         | Team scope and unassigned responsibilities                   |
| [Contribution guide](docs/contribution-guide.md) | Branches, PRs, and checks                                    |
| [Review policy](docs/review-policy.md)           | Cross-group approvals and required GitHub settings           |
| [Class discussion](docs/class-review.md)         | Decisions still requiring class agreement                    |
| [Verification notes](docs/verification.md)       | Tested behavior and remaining limitations                    |

Record accepted architecture decisions in `docs/decisions/` with context, the decision, and its consequences.
