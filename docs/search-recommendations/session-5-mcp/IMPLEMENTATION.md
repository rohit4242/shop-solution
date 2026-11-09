# Implementation ledger

Plan: Search & Recommendations: Live MCP, Team Playground and Exercise Submission (approved in chat).

## Decisions

- Preserve the untracked initial project; work on codex/search-mcp-playground without staging or making an initial commit.
- Existing schema and registry generate the contract; both transports consume equivalent tool definitions.
- HTTP from MCP to the discovery API is a scoped integration exception awaiting maintainer review.
- Next.js instead of FastAPI remains an instructor acceptance gate.
- Execution skill commit/worktree scripts require an existing commit; this unborn repository uses an explicit ledger and focused tests instead.

## Progress

- Repository/feature documentation and Next route-handler guide inspected.
- No local model settings, hosted database, or linked Vercel project available at preflight. Configuration requested; implement independent work meanwhile.
- External team reviews and instructor acceptance cannot be fabricated; tracked as pending.

## Implemented and checked

- Contract exporter and parity checker; TypeScript HTTP MCP and Python stdio adapters.
- Correlated API logging; protected config/run routes; AI SDK loop with actual MCP client.
- User-ID allowlist, sign-in UI, editable bounded settings, local IndexedDB history, presets, import/export and comparison.
- Browser tests with simulated responses, Python protocol smoke against actual APIs, Inspector CLI discovery.
- Tests: 56 Vitest tests passed; three Python tests passed; initial two browser checks passed, responsive suite underway.
- Typecheck and lint passed after fixing the SDK context signal property and UI lint findings.
- Default pnpm build: Turbopack worker-port EPERM, including escalated retry. Supported pnpm build --webpack passed. Keep the default build unchanged; document the environment-specific fallback.
- Ruling: no deployment or real-model claims with placeholder configuration. These operations require valid account/configuration and release-gate evidence.
- Python dependencies locked from the tested Python 3.14 environment; CI targets 3.12 and must verify the lock there.

## Final review and fixes

- Independent reviewer requested three P2 fixes; all reproduced before fixing.
- Fixed Python raw-input validation before SDK coercion and advertised exact generated schemas. Python test failed then passed; actual stdio/HTTP malformed-input parity passed.
- Fixed account-switch draft/preset/comparison isolation and invalidated pending access loads. Browser regression failed then passed.
- Fixed multi-turn repeat/fork context, including settings changes. Browser regression failed then passed.
- Reviewer declined to judge live-provider behavior, deployment and external review gates without credentials/evidence. Ruling: retain these as explicit pending release gates; no successful claim without real evidence. Cost: deployment and course model evidence remain incomplete until configured.
- No minor findings were reported.

## Handoff

- All local implementation work is in the workspace on codex/search-mcp-playground; no commits, pushes or releases made.
- Final tests: 57 Vitest tests, 4 Python tests, 5 browser checks. Lint, types, formatting and contract parity pass.
- Added explicit comparison highlighting for configuration, messages, tool sequence/arguments, final answer, outcome, measured duration and reported usage; regression test passes.
- Ruling: previous submission/evidence is frozen; exclude it from Prettier instead of changing historical experiment files. Cost: those historical files retain their original formatting.
- Local Docker daemon is available, but no real database credentials, approved accounts or model configuration were supplied. Database auth verification remains a documented setup task.
