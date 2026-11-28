# Shop Solution

A shared university shop project built by ten teams in the Agent-Based Software Development course. We work in one repository and one application, with feature ownership and pull-request reviews across groups.

**Repository:** [rohit4242/shop-solution](https://github.com/rohit4242/shop-solution)

## New to the project? Start here

1. Send the repository owner your GitHub username and class group; accept the collaborator invitation.
2. Find your team in the [team directory](docs/team-ownership.md) and read its feature README.
3. Fork the repository, clone your fork, and follow the local setup below.
4. Read the [contribution guide](docs/contribution-guide.md) and follow the [docs checklist](docs/README.md#where-teams-put-their-docs).
5. Choose a small task, create a feature branch, and open a draft pull request early.

## Current status

The application includes Next.js, shared UI components, Better Auth wiring, and a canonical PostgreSQL schema managed by Prisma. The [shared shop data model](docs/commerce/README.md) maps the schema to team workflows. Apply the committed migrations to start with the auth and commerce tables. Feature integrations are delivered through their own PRs.

Two team workflows are available to try. The [Search discovery workbench](docs/search-recommendations/README.md) uses a demo catalog, and the [Logistics workspace](src/features/logistics/README.md) has a local shipment demo. The separate Admin & Identity app provides the session and permission checks used by the Search demo. The shared Better Auth handler is wired up, and the common account flows and other shop integrations are still being developed. See the [verification notes](docs/verification.md) for what has been tested.

The proposed merge policy requires **two reviewers from two different groups other than the PR author's group**. Workflow code is included; enforcement requires a populated class roster and GitHub branch protection. These settings are not established just by cloning this repository.

## Repository structure

| Location                        | Purpose                                           |
| ------------------------------- | ------------------------------------------------- |
| `src/app/`                      | Next.js pages, layouts, and route handlers        |
| `src/features/<team>/`          | Team-owned behavior, contracts, and feature tests |
| `src/shared/` and `src/server/` | Shared UI, utilities, and server infrastructure   |
| `prisma/`                       | Canonical PostgreSQL schema and migration history |
| `docs/` and `tests/`            | Shared project guides and cross-feature checks    |

See [feature structure and imports](docs/feature-guide.md), [technology and API conventions](docs/tech-stack.md), and the [team directory](docs/team-ownership.md).

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

`pnpm dev` starts this shared Next.js application and the Discovery
workbench at
[localhost:3000/docs/search-recommendations/discover](http://localhost:3000/docs/search-recommendations/discover).
The separate Admin & Identity project must be started independently; its local
UI and API are expected at `http://localhost:5500/` and
`http://localhost:8000/`. Its startup command is not part of this repository.
When both projects use `localhost`, Discovery can read the shared Identity
cookie through its same-origin session proxy.

Open [localhost:3000](http://localhost:3000).

- `/` displays the project starter page.
- `/api/health` checks application liveness, not database readiness.
- `/api/auth/*` is handled by Better Auth; persisted auth needs PostgreSQL and the applied migration.
- In-repository login, admin, and seller screens remain team implementation
  tasks. The separate Admin & Identity UI/API must be started by its own
  project.

If PostgreSQL is not ready, check `docker compose ps` and `docker compose logs db`. If port 5432 is occupied, change the host port in `compose.yml` and update `DATABASE_URL` to match. Use `docker compose stop db` to stop the database while retaining its data volume.

## Contributing

Use your fork and a short-lived feature branch. Open a draft against upstream `main`, update the affected contracts, and include the verification results. The [contribution guide](docs/contribution-guide.md) has the branch commands, review steps, and documentation expectations.

## Useful commands

| Command                                  | Purpose                                             |
| ---------------------------------------- | --------------------------------------------------- |
| `pnpm dev`                               | Start the development server                        |
| `pnpm docs:check`                        | Check feature READMEs and local documentation links |
| `pnpm lint`                              | Run ESLint                                          |
| `pnpm typecheck`                         | Generate Prisma client and check TypeScript         |
| `pnpm test`                              | Run unit and policy tests                           |
| `pnpm format` / `pnpm format:check`      | Format / check formatting                           |
| `pnpm build` / `pnpm start`              | Build / serve production output                     |
| `pnpm db:generate`                       | Generate the Prisma client                          |
| `pnpm db:migrate --name describe-change` | Create and apply a local development migration      |
| `pnpm db:deploy`                         | Apply committed migrations                          |

Commit both intentional schema changes and their new migration. Generated Prisma client files remain untracked. CI checks lint, types, tests, formatting, Prisma schema validity, and production build; it does not currently exercise PostgreSQL-backed auth or full shop journeys.

## Working with Claude Code and Codex

[CLAUDE.md](CLAUDE.md) and [AGENTS.md](AGENTS.md) point assistants to the same architecture and coding rules. Matching `create-feature` and `review-feature` workflows live in `.claude/skills/` and `.agents/skills/`; keep the copies synchronized when editing them.

Tell the assistant your feature, task, and agreed contract. Review its diff and test evidence before opening a PR. AI-written changes follow the same checks and human review policy as other changes.

## More documentation

The [documentation index](docs/README.md) links the shared guides, team README files, contributor rules, and the feature README template.
