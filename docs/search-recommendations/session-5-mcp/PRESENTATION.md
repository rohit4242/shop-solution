# Five-minute presentation

## 0:00–0:40 — Purpose

We expose our existing search module to other agents through a standard MCP interface. Public results are mock products; purchase evidence is synthetic.

## 0:40–1:20 — Architecture and connection

Show client → MCP → HTTP API → existing services. Show the five tools, OpenAPI resource, and the connection guide. Explain the Next.js framework deviation and its approval status.

## 1:20–3:00 — Multi-step demonstration

Search for Wireless Mouse, then compare similar and also-bought results using the returned ID. Show the playground trace, HTTP request IDs, actual responses and model settings. If real credentials are not configured, label the protocol demo as deterministic and do not describe it as an agent run.

## 3:00–4:15 — Honest failures and missing evidence

Show the missing-product 404 and the empty co-purchase result for prd_5. Explain why an empty result must not silently become similarity recommendations. Include an actual description experiment only if performed.

## 4:15–5:00 — Findings and limits

Present the most interesting observation from the real run table when available. State what was tested, what remains unverified, and that a deployed mock demo is not a production commerce integration.
