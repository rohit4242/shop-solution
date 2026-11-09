# Agent observations (Part 4)

Run on 2026-11-09 with `agent.py` (stage-4 loop) against the local API (`pnpm dev`).

- **Model:** OpenAI `gpt-4.1-mini`, default settings (no temperature set, `tool_choice` auto), at most 10 steps.
- **Evidence:** every run has two files in [evidence/agent-run/](evidence/agent-run/):
  - `*-agent.txt` is the agent terminal: tool calls, results and the final answer.
  - `*-api.log` is the API terminal: one JSON log line per request, with its `requestId` and status.

## Part 4 table

| Observation                             | Happy path                                                          | Error case                                                                                | Several steps                                                                 |
| --------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Prompt                                  | Find in-stock wireless products under €25.                          | Find alternatives to product prd_missing.                                                 | Search for Wireless Mouse, then show similar and also-bought products for it. |
| Tools called and order                  | `search(q="wireless", availability="in_stock", maxPriceMinor=2500)` | **None.** The model answered without calling a tool (11 of 11 runs).                      | `search` → `similar(productId="prd_1")` → `also_bought(productId="prd_1")`    |
| Expected API requests in logs?          | Yes: one `GET /api/v1/search`, 200                                  | No: the API log is empty, so the claim was never checked                                  | Yes: three GETs (search, similar, also-bought), all 200, in that order        |
| Final answer correct?                   | Yes: Wireless Mouse, €19.99. € and cents converted correctly        | Correct by luck: "prd_missing does not exist" is true, but it was guessed                 | Yes: matches the API results (3 similar products, 1 bought together)          |
| Error reported or invented information? | Nothing invented                                                    | Nothing invented, but the claim is not grounded in a tool result                          | Nothing invented. It added `availability="in_stock"` without being asked      |
| Description changed afterwards?         | No                                                                  | Yes: `productId` and `similar`/`also_bought` docstrings. No effect (4 of 4 still skipped) | No                                                                            |

## What we learned

1. **The happy path and multi-step chaining work from the descriptions alone.**
   - The model mapped "under €25" to `maxPriceMinor=2500` and "in-stock" to the `Literal` value `in_stock`.
   - In the multi-step run it took `prd_1` from the search result and passed it to the next two tools.

2. **A telling ID name beats our instructions.** With `prd_missing`, the model never called `similar`; it read "missing" in the ID and answered from that.
   - **Description change:** the `productId` description said "from a search or autocomplete result". We changed it to "given by the user or taken from a search result" and told `similar` and `also_bought` to call the API directly with a user's ID. Still 4 of 4 runs without a tool call (3 repeats plus the evidence run).
   - **System prompt test:** adding "check every ID the user gives with a tool, even if it looks invalid" also left 3 of 3 runs without a tool call, so we reverted it.
   - **Neutral ID:** with `prd_999` (same prompt, nothing changed) the model called `similar` in 4 of 4 runs and reported `ERROR 404 PRODUCT_NOT_FOUND` correctly. See `2b-error-neutral-id-*`.
   - **Conclusion:** the error path (API 404 → MCP text `ERROR 404 …` → honest answer) works. Better wording does not reliably stop the model from skipping a tool. That needs the host to enforce it, for example `tool_choice="required"` on the first step.

3. **Unrequested filters.** In the several-steps prompt the model added `availability="in_stock"` to all three calls although the user didn't ask for it. This doesn't change the result in our fixture data, but it can hide products. The docstrings could say "only filter when the user asks".

4. **Empty is a real answer.** Extra scenario `4-empty-also-bought`: "What do customers also buy with the Desk Speaker?"
   - The model ran `search` → `also_bought(prd_5)` and got `{"items": []}`.
   - It said there is no purchase data and only _offered_ similar products instead of substituting them, as the `also_bought` docstring asks.
