# Vercel deployment runbook

Status: no Vercel project/account or real production credentials were supplied. No deployment has been created and no stable production URL is claimed.

## Prerequisites

Resolve the gates in REVIEW.md. Confirm the intended account, project and reviewed source revision. The current checkout began with no commits; do not stage the entire unrelated baseline as part of this feature without reviewing it.

Provision hosted PostgreSQL for Better Auth. Apply existing migrations with `pnpm db:deploy` to the intended database, then verify sign-up/sign-in/session/sign-out and approve actual team user IDs. Never enable the playground against placeholder credentials.

Configure the server-only variables listed in `.env.example`. Preview and production need their own explicit API origin and MCP URL. Production URLs use HTTPS. Set `SEARCH_PUBLIC_MCP_URL` only after the deployment has passed checks. Configure model capabilities from actual provider behavior.

The run route declares maxDuration=150; the application cancels at 120 seconds. Verify the selected Vercel plan/configuration honors this duration. The MCP route allows 30 seconds with a 10-second upstream API timeout. No durable process state is required.

For protected previews, configure the server-only Vercel automation bypass secret so the playground can call MCP. The MCP-to-API request also needs preview bypass when both endpoints are protected. Never expose that secret in browser configuration, docs, exports or logs.

## Release checks

```sh
pnpm contract:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm release:check
```

`release:check` validates configuration shape; it cannot certify provider capabilities, external approvals or platform duration limits.

Create and test a preview using the intended Vercel account/project. Verify public docs, YAML/JSON parity, MCP tools/resource, a missing-product error, empty purchase evidence, allowed/denied playground accounts, a real provider run, cancellation and an independent external client's connection. Keep public production MCP accessible without deployment-login interception; protect the playground in application code.

Publish/promote only after checks and review gates. Record the tested source revision, deployment ID, stable URL, timestamp and actual test commands in VERIFICATION.md.

## Disable and rollback

Set PLAYGROUND_ENABLED=false and redeploy to disable new model runs. Existing runs are bounded to 120 seconds. Preserve public docs and read-only MCP where healthy. For a broader regression, use Vercel's rollback to a previously verified deployment, then repeat public MCP and auth smoke checks. Do not roll back database migrations by deleting migration files.
