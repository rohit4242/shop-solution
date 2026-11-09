# Search & Recommendations MCP server (Python)

A thin MCP server in front of our Search API, written with the official MCP Python SDK. Each tool sends one GET request to the API and returns the answer as text. All rules live in the API.

| File             | What it is                                                             |
| ---------------- | ---------------------------------------------------------------------- |
| `server.py`      | The MCP server: 5 tools and the OpenAPI contract as a resource (stdio) |
| `agent.py`       | Our stage 4 agent: a model that gets its tools from `server.py`        |
| `smoke.py`       | Scripted call of every tool against a running API, no model involved   |
| `test_server.py` | Unit tests with a mocked API; checks the tools match `openapi.yaml`    |

## Tools

| Tool           | API request                               | Use it to…                                 |
| -------------- | ----------------------------------------- | ------------------------------------------ |
| `search`       | `GET /api/v1/search`                      | find products by words, filters and price  |
| `facets`       | `GET /api/v1/search/facets`               | count products per category, seller, stock |
| `autocomplete` | `GET /api/v1/search/autocomplete`         | complete a product name, get its ID        |
| `similar`      | `GET /api/v1/recommendations/similar`     | find alternatives to a product             |
| `also_bought`  | `GET /api/v1/recommendations/also-bought` | find products bought together (synthetic)  |

Resource: `erp://search-recommendations/openapi`, the contract in [docs/search-recommendations/openapi.yaml](../../docs/search-recommendations/openapi.yaml).

## Run it

Start the API in one terminal from the repository root:

```sh
pnpm dev
```

In a second terminal (Python 3.11+):

```sh
cd tools/search-recommendations-mcp
python -m venv .venv
# Windows: .venv\Scripts\activate    macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt

pytest                 # unit tests, no API needed
python smoke.py        # every tool against the running API
mcp dev server.py      # MCP Inspector in the browser
```

Run the agent with your Academic Cloud Chat AI key:

```sh
# macOS/Linux: export VAR=value    Windows PowerShell: $env:VAR="value"
export CHAT_AI_API_KEY="your-key"          # never commit it
export CHAT_AI_MODEL="a-model-with-tool-calling"
python agent.py "Find in-stock wireless products under €25."
```

Output looks like the lecture's stage 4: one `[n] tool(arguments)` line per call, the start of each result, then the final answer.

## Point it at another API

The server calls `http://127.0.0.1:3000` by default. Set `SEARCH_API_BASE_URL` to use a deployed API instead, for example `https://your-app.vercel.app`.
