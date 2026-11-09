# Search & Recommendations: start here

Our team owns product search, filters, autocomplete and recommendations for the shop. Other teams use us through a small read-only HTTP API, and AI agents use the same API through an MCP server. All data is mock data in memory, so no database is needed.

## What's where

| You want to…                         | Go to                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| Call the API                         | [API-CONTRACT.md](API-CONTRACT.md) or the website at `/docs/search-recommendations`        |
| Read the machine-readable contract   | [openapi.yaml](openapi.yaml), served at `/docs/search-recommendations/openapi.yaml` too    |
| Connect an AI agent over MCP         | [tools/search-recommendations-mcp](../../tools/search-recommendations-mcp/README.md)       |
| Read or change the code              | [src/features/search-recommendations](../../src/features/search-recommendations/README.md) |
| See our session 5 exercise (MCP)     | [exercises/session-5-mcp](exercises/session-5-mcp/README.md)                               |
| See our session 4 exercise (context) | [exercises/session-4-context-package](exercises/session-4-context-package/README.md)       |

## The five operations

All are `GET`, need no login, and answer `{ "data": … }` on success or `{ "error": { "code", "message" } }` on failure.

| Operation        | Path                                  | Example                          |
| ---------------- | ------------------------------------- | -------------------------------- |
| Search           | `/api/v1/search`                      | `?q=wireless&maxPriceMinor=2500` |
| Facets           | `/api/v1/search/facets`               | `?q=wireless`                    |
| Autocomplete     | `/api/v1/search/autocomplete`         | `?q=wire`                        |
| Similar products | `/api/v1/recommendations/similar`     | `?productId=prd_1`               |
| Also bought      | `/api/v1/recommendations/also-bought` | `?productId=prd_1`               |

Prices are euro cents (`2500` = €25). IDs use the prefixes `prd_` (product), `off_` (offer) and `sel_` (seller).

## Run it locally

```sh
pnpm install --frozen-lockfile
pnpm dev
curl "http://localhost:3000/api/v1/search?q=wireless"
```

Open http://localhost:3000/docs/search-recommendations for the full reference, examples and a request explorer.

## Keep the contract in sync

`openapi.yaml` is generated from our Zod schemas. After changing a schema or an endpoint description, run `pnpm contract:export` and commit the result. CI runs `pnpm contract:check` and fails if the file is out of date.
