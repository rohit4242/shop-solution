# Session 5: an MCP-capable API for our module

The exercise: write an agreed OpenAPI contract, run an API behind it, put a thin MCP server in front, and let an agent operate it. Our neighbouring team for the contract review is **Admin & Identity**.

## Deliverables

| #   | Deliverable                                   | Where                                                                                           | Status                     |
| --- | --------------------------------------------- | ----------------------------------------------------------------------------------------------- | -------------------------- |
| 1   | `openapi.yaml` + note on changes after review | [../../openapi.yaml](../../openapi.yaml), [CONTRACT-REVIEW.md](CONTRACT-REVIEW.md)              | Contract done, review open |
| 2   | API and MCP server, with start instructions   | Next.js API in `src/features/search-recommendations`, MCP in `tools/search-recommendations-mcp` | Done                       |
| 3   | Evidence of an agent run + Part 4 table       | [OBSERVATIONS.md](OBSERVATIONS.md), [evidence/](evidence/)                                      | Agent run still to do      |
| 4   | Five-minute presentation                      | [PRESENTATION.md](PRESENTATION.md)                                                              | Outline                    |

## How the pieces fit

```text
Model (Academic Cloud)
   ⇅ tool calls
agent.py (stage 4: MCP host + client)
   ⇅ tools/call over stdio
server.py (MCP server: translates only)
   ⇅ HTTP GET
Next.js API /api/v1/... (all rules, request log)
```

We built the API in Next.js inside the shared shop app instead of FastAPI. It serves its contract at `/docs/search-recommendations/openapi.yaml` and as a documentation website at `/docs/search-recommendations`.

## Start it

Terminal 1, the API:

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Terminal 2, the MCP server and agent (Python 3.11+):

```sh
cd tools/search-recommendations-mcp
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

mcp dev server.py                      # MCP Inspector: list tools, call them, read the resource
python agent.py "Find in-stock wireless products under €25."
```

The agent needs `CHAT_AI_API_KEY` and `CHAT_AI_MODEL` in your environment. Never commit the key.

## Deploy and share

[DEPLOYMENT.md](DEPLOYMENT.md) explains the Vercel setup. Once deployed, other teams connect their agents from `/docs/search-recommendations/use-with-ai`.

## What has been checked

- `pnpm test`, `pnpm contract:check` and the Python tests pass in CI.
- [evidence/protocol-smoke.jsonl](evidence/protocol-smoke.jsonl): a scripted run of all five tools over stdio and HTTP, including a 404 for `prd_missing` and an empty also-bought result for `prd_5`. This proves the transport works, not that a model picks the right tools.
- [evidence/inspector.json](evidence/inspector.json): MCP Inspector CLI output listing the tools and reading the resource.

Still to do: the three real agent prompts (Part 4), the contract review with Admin & Identity, and Inspector screenshots.
