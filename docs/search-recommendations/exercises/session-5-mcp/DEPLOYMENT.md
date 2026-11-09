# Deploy the shop to Vercel

The whole Next.js app (all teams) deploys as one Vercel project. Every merge to `main` then updates the live site, so classmates always see the current API, docs and MCP endpoint.

Our feature needs no database. The search API, docs and MCP server work with only the required variables below. The playground also needs a Chat AI key and an access code.

## One-time setup (repository owner)

1. In Vercel, choose **Add New → Project** and import `rohit4242/shop-solution` from GitHub.
2. Keep the detected defaults: framework Next.js, root directory `/`. Vercel installs with pnpm because of `packageManager` in `package.json`.
3. In **Settings → General → Node.js Version**, choose **24.x** to match the README.
4. Add the environment variables below for **Production** (and Preview, if you use preview links).
5. Deploy. Production deploys from `main`; each pull request gets a preview link.

## Environment variables

| Variable                 | Needed for            | Value                                                                    |
| ------------------------ | --------------------- | ------------------------------------------------------------------------ |
| `BETTER_AUTH_SECRET`     | the whole app         | `openssl rand -base64 32`. Without it the shared `/api/auth` route fails |
| `BETTER_AUTH_URL`        | the whole app         | the production URL, e.g. `https://shop-solution.vercel.app`              |
| `DATABASE_URL`           | Admin & Identity only | a hosted PostgreSQL URL, once that team needs logins. Search ignores it  |
| `PLAYGROUND_ACCESS_CODE` | playground            | a long random team code; share it with the team privately                |
| `PLAYGROUND_ENABLED`     | playground            | `true` once the model settings below work                                |
| `PLAYGROUND_MODELS_JSON` | playground            | as in `.env.example`, with a model ID that Chat AI offers                |
| `CHAT_AI_API_KEY`        | playground            | the team's Academic Cloud Chat AI key                                    |
| `CHAT_AI_BASE_URL`       | playground            | `https://chat-ai.academiccloud.de/v1`                                    |

You don't need `SEARCH_API_BASE_URL` on Vercel: the app reads its own address from Vercel's system variables. Never put secrets in the repository.

## Check a deployment

Replace `$SITE` with the production URL:

```sh
curl "$SITE/api/v1/search?q=wireless"                       # 200 with Wireless Mouse
curl "$SITE/api/v1/recommendations/similar?productId=prd_missing"   # 404 PRODUCT_NOT_FOUND
curl "$SITE/docs/search-recommendations/llms.txt"           # agent brief with $SITE in it
claude mcp add --transport http shop-search "$SITE/api/mcp/search-recommendations"
```

Then open `$SITE/docs/search-recommendations/use-with-ai` (the snippets should show `$SITE`), and unlock `$SITE/docs/search-recommendations/playground` with the team code.

The Python MCP server can use the deployed API too:

```sh
SEARCH_API_BASE_URL="$SITE" python tools/search-recommendations-mcp/smoke.py
```

## Good to know

- **Preview links are protected.** Vercel puts its login in front of preview deployments by default. Their playground can't reach their own MCP endpoint, so use production for playground runs.
- **Run time limit.** The playground run route sets `maxDuration = 150` seconds, and a run stops itself after 120 seconds. If Vercel rejects 150 on your plan, lower it in `src/app/api/search-playground/run/route.ts`, keeping it above 120.
- **Turn the playground off** by setting `PLAYGROUND_ENABLED=false` and redeploying. The API, docs and MCP server keep working.
- **Roll back** a bad release from the Vercel dashboard (**Deployments → … → Instant Rollback**).
