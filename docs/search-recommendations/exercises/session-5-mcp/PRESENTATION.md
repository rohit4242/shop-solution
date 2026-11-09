# Five-minute presentation

## 0:00–0:40 Purpose

Our search API now has an MCP server, so other teams' agents can find products and recommendations in the shop. The products are mock data, and the purchase data is a small synthetic sample.

## 0:40–1:30 Architecture

Show the chain: model → `agent.py` (MCP host and client) → `server.py` (MCP server, translates only) → Next.js API (all rules, request log).

- **Five tools:** `search`, `facets`, `autocomplete`, `similar`, `also_bought`.
- **Server design:** `Literal` enums for availability and sort, docstrings written for the model, the OpenAPI contract as a resource, and errors returned as text.
- **API choice:** we kept our Next.js API instead of FastAPI because it already existed in the shared shop app.
- **For other teams:** they connect at `/docs/search-recommendations/use-with-ai`.

## 1:30–2:45 Live demo: several steps

Run `python agent.py "Search for Wireless Mouse, then show similar and also-bought products for it."` with the API terminal next to it.

- The model calls `search` → `similar(prd_1)` → `also_bought(prd_1)`. It took the ID from the first result by itself.
- Each tool call appears in the API log with a `requestId`.
- The answer matches the API data.

## 2:45–4:15 The interesting finding

- **`prd_missing`:** the model **never calls a tool**. It reads "missing" in the ID and answers "does not exist". The answer is right, but it's a guess.
- **What we tried:**
  - better tool descriptions: no change
  - a stricter system prompt: no change
- **`prd_999`:** with this neutral ID the model calls `similar` every time and reports the real `404 PRODUCT_NOT_FOUND`.
- **Lesson:** descriptions guide the model, but they can't force a tool call. Forcing one is the host's job (`tool_choice="required"`).

Also show the empty also-bought result for Desk Speaker. The model says "no purchase data" and doesn't replace it with similar products.

## 4:15–5:00 Limits

- **Model:** we tested one model (`gpt-4.1-mini`) with few runs per prompt.
- **Filters:** the model sometimes adds filters nobody asked for (`in_stock`).
- **Data:** mock data, not a real shop.

All evidence is in [OBSERVATIONS.md](OBSERVATIONS.md) and [evidence/agent-run/](evidence/agent-run/).
