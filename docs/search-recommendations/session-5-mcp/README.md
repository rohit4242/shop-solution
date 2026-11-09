# Session 5: Search & Recommendations over MCP

This package adds public Streamable HTTP MCP, a Python stdio adapter, and a restricted AI SDK playground to the existing Next.js module. Both MCP adapters call the same HTTP API; business logic remains in the feature services.

## Current scope

Five read-only tools: search, facets, autocomplete, similar and also_bought. The shared resource is `erp://search-recommendations/openapi`. Data is mocked; purchases are synthetic. The generated OpenAPI 3.1 contract is `openapi.yaml`; regenerate with `pnpm contract:export` and verify with `pnpm contract:check`.

The public documentation starts at `/docs/search-recommendations/mcp`. The remote endpoint is `/api/mcp/search-recommendations`. The private playground is `/docs/search-recommendations/playground`.

## Start locally

1. Install the pinned Node/pnpm toolchain and run `pnpm install --frozen-lockfile`.
2. Copy `.env.example` to `.env` and configure only your local secrets. The playground is disabled by default.
3. Run `pnpm dev`. Public mock API and MCP do not need a database.
4. For the playground, start PostgreSQL, run `pnpm db:deploy`, and configure Better Auth's URL and secret.
5. Create team accounts through Better Auth's existing sign-up API. A maintainer verifies each person's identity out of band and records their actual user ID in `PLAYGROUND_USER_IDS`; registration alone grants no playground access. Do not approve by unverified email address.
6. Configure Academic Cloud's real URL/key and available model IDs in `PLAYGROUND_MODELS_JSON`. Set capabilities only after testing that model. `CHAT_AI_MODEL` is used by the Python runner; the playground uses model profiles.
7. Set `SEARCH_API_BASE_URL`, `SEARCH_MCP_URL`, and then `PLAYGROUND_ENABLED=true`. Sign in from the playground.

Python setup:

```sh
python3 -m venv tools/search-recommendations-mcp/.venv
tools/search-recommendations-mcp/.venv/bin/pip install -r tools/search-recommendations-mcp/requirements.lock
tools/search-recommendations-mcp/.venv/bin/python -m pytest tools/search-recommendations-mcp/test_adapter.py
tools/search-recommendations-mcp/.venv/bin/python tools/search-recommendations-mcp/smoke.py
```

`smoke.py` is a deterministic protocol test, NOT an autonomous agent run. `agent.py` is a clearly labelled equivalent runner, NOT the original lecture stage-4 file. Its environment requires `CHAT_AI_API_KEY`, `CHAT_AI_BASE_URL`, and `CHAT_AI_MODEL`.

```sh
tools/search-recommendations-mcp/.venv/bin/python tools/search-recommendations-mcp/agent.py 'Find in-stock wireless products under €25.'
```

For Inspector, run `.venv/bin/mcp dev server.py` from `tools/search-recommendations-mcp`. Inspect all five tools and read the OpenAPI resource.

## Verification and submission

See `VERIFICATION.md`, `OBSERVATIONS.md`, `REVIEW.md`, `DEPLOYMENT.md` and `PRESENTATION.md`. Raw protocol evidence is under `evidence/`. Playground runs can be exported as validated JSON.

The required full model runs, team agreement, instructor framework acceptance and live deployment must be recorded honestly. Placeholder configuration cannot replace credentials or evidence. Previous exercise evidence under `submission/` remains unchanged.
