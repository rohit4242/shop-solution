# Agent runs, 27 and 28 Nov 2026 (Groq: `openai/gpt-oss-120b` and `openai/gpt-oss-20b`)

Each run: reset → setup → the model gets **only** the tools of Marketing's MCP server (`/api/mcp/marketing`) →
afterwards **code checks the state through the HTTP API**. The agent's answer is recorded, never trusted.
Runner: `src/features/marketing/tests/agent/run-scenarios.mjs`. Files: `.txt` = console output, `.json` = every run with tool calls,
inputs, tokens, answer and each check.

| Round | Files                            | What changed before this round                                                            |
| ----- | -------------------------------- | ----------------------------------------------------------------------------------------- |
| 1     | `agent-runs-<model>.json`        | first checks; 6 MCP tools (no update tool)                                                |
| 2     | `agent-runs-<model>-strict.json` | scenario 2 also checks that the 10 % promotion keeps the original end date                |
| 3     | `agent-runs-<model>-fixed.json`  | **system fixed:** new `update_promotion` tool; checks look at the outcome, not the method |
| 4     | `agent-runs-<model>-shared.json` | 28 Nov: storage moved to the shared shop schema (same tools and checks); 20/20            |
| 5     | `agent-runs-<model>-pr23.json`   | 28 Nov: PR #23 scope, 6 tools (no `get_order_discount`); 20/20                            |
