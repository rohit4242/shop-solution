# Verification — 9 November 2026

## Executed

- `pnpm lint`: passed.
- `pnpm format:check`: passed. Frozen previous-exercise evidence is excluded rather than rewritten.
- `pnpm typecheck`: passed, including Prisma client generation.
- `pnpm test`: 57 tests passed across 10 files.
- `pnpm contract:check`: generated YAML and Python tool contract match the maintained schemas.
- Python `pytest tools/search-recommendations-mcp/test_adapter.py`: 4 tests passed.
- `pnpm exec playwright test`: 5 browser checks passed (stream/inspection/history, sign-in gate, desktop/mobile layout, account-switch isolation, multi-turn fork preservation). Model and access responses are mocked in these browser tests; they do not prove a real login or provider run.
- AI SDK runner tests use the actual SDK loop with a mock language model and MCP client, covering tool execution, provider failure, cancellation, cleanup and the 20-call ceiling.
- `python tools/search-recommendations-mcp/smoke.py`: live local Python stdio and HTTP protocol checks passed for all five tools, the OpenAPI resource, missing-product 404, empty co-purchase evidence and invalid-input parity. Evidence: `evidence/protocol-smoke.jsonl`.
- Official MCP Inspector CLI `tools/list` and `resources/read`: successfully discovered five tools and read the OpenAPI resource from the local Streamable HTTP endpoint. This is Inspector CLI evidence, not an Inspector GUI screenshot or autonomous model run.
- `pnpm build`: failed because Turbopack could not bind a worker port (`EPERM`), including an escalated retry.
- `pnpm build --webpack`: production build passed with Next.js's supported webpack backend. The default build script is unchanged.
- `pnpm release:check`: failed as expected, listing missing actual deployment/model/database configuration without printing secret values.

Local pnpm commands used `npm_config_store_dir` pointing at the pre-existing workspace store because the runtime's default store differed. Dependencies are exact-pinned in package.json and pnpm-lock.yaml. Python dependencies are frozen in requirements.lock.

## Not verified / not performed

- Real Academic Cloud model selection, tool calling, sampling capabilities or usage reporting.
- Database-backed signup/sign-in/sign-out and approved-user access against real PostgreSQL.
- The actual three-prompt agent observation table; protocol evidence is not substituted for it.
- Vercel preview/production deployment, account/project configuration, platform duration limits or stable public URL.
- A third-party desktop MCP client or Inspector GUI screenshots.
- Instructor, owner, maintainer and cross-group approvals.

All remain explicit gates. No credentials were invented, no secrets committed, no deployment made, and no messages sent to other teams.

## Independent review

A fresh read-only reviewer requested three fixes: strict Python/HTTP argument parity, clearing all editor state on account changes, and preserving multi-turn context when repeating/forking. Each was reproduced by a failing test and fixed; Python and full browser tests passed afterwards. External configuration and review gates were explicitly excluded from correctness judgments because no evidence was available.
