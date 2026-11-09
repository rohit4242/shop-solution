# A/B experiment protocol

Status: provisional runs completed on 25 October 2026 with user authorisation to proceed before partner replies. The real interface review remains incomplete. Frozen context, transcripts and results are in submission/evidence; see submission/EXPERIMENT-REPORT.md. The original review-first protocol below is retained for reference.

## Isolation and controls

Use two fresh Codex sessions with identical model, reasoning effort, tools and stopping criteria. Create two separate projectless folders outside this repository containing identical minimal TypeScript/Vitest scaffolding and fictional catalog fixtures. Do not copy repository AGENTS.md, feature documentation, this protocol, acceptance answers or completed solutions. Disable project-wide context discovery for both runs where the tool permits; record any unavoidable global instructions as a limitation. Do not use forks of this chat. Neither agent may see the other run's output.

Only B receives the frozen MODULE.md, with the first message: "Read the attached MODULE.md as module context, then perform the task below." Both receive the exact task below. Attach context directly; do not require B to browse other documentation. Keep a SHA-256 of the context and starting files. Both runs may inspect their identical starter fixtures.

## Identical task prompt

Implement a small product search function in this TypeScript project, with Vitest tests. Use the supplied catalog fixtures as the input data shape. Support an optional text query, category filter and minimum/maximum price filters. Trim the query and match product names case-insensitively by substring; an empty query matches all eligible records. Combine filters with AND and include both price boundaries. Return only published products. Reject negative or fractional price bounds and minimum greater than maximum. Keep the input unmodified. Make result ordering deterministic by product name and then product ID using lexical comparison. Return matching product summaries and their total count. No HTTP server, UI, external calls, pagination or recommendations are needed for this small task. Run tests and report the files changed, commands, results and limitations.

## Shared fixture specification

Create JSON records with exactly productId, name, categoryId, priceMinor, currency, tags, isPublished. Use these fictional entries in both runs:

| productId | name         | categoryId | priceMinor | currency | tags          | isPublished |
| --------- | ------------ | ---------- | ---------- | -------- | ------------- | ----------- |
| p-01      | Alpine Mug   | home       | 1000       | EUR      | ceramic, blue | true        |
| p-02      | Alpine Mug   | home       | 1500       | EUR      | ceramic       | true        |
| p-03      | Trail Bottle | outdoors   | 1500       | EUR      | steel         | true        |
| p-04      | Hidden Mug   | home       | 1200       | EUR      | ceramic       | false       |
| p-05      | Desk Lamp    | home       | 3000       | EUR      | light         | true        |
| p-06      | Free Sample  | home       | 0          | EUR      | sample        | true        |

The shared records are provided in [experiment-fixtures.json](experiment-fixtures.json). Fixture arrays must use deliberately non-sorted order p-03, p-02, p-04, p-01, p-06, p-05. Freeze scaffolding and fixtures before either run. Install the same pinned dependencies; setup costs are excluded from both runs.

## Evaluation held outside both sessions

Check empty and whitespace queries, mixed case, no matches, exact category, AND combinations, inclusive 1000/1500 boundaries, zero price, invalid/reversed bounds, unpublished exclusion, lexical tie-breaking and input immutability. Example: query " MUG ", category "home", bounds 1000..1500 returns p-01 then p-02; hidden p-04 never appears. Evaluate outputs without renaming/refactoring them first; a minimal evaluator import adapter is allowed and must be recorded. Test business behaviour independently of each agent's own tests.

Score common functional requirements equally. Separately record alignment with the frozen module's field names, summary shape, error/naming conventions and feature structure. Report context-only alignment separately: A was not explicitly given those conventions. The task's explicit exclusion of HTTP/pagination overrides broader module scope in B.

## Measurement and evidence

Count assistant messages and tool calls separately; capture elapsed time and every user correction verbatim. Stop after the first final answer unless intervention is needed; every follow-up counts. Record model/settings, starting hashes, context hash, prompts, transcript, outputs, actual test logs and outcome. Tokens are tool-reported only, or "unavailable"; MODULE.md token count is a different measurement. Do not silently repair failed runs. Preserve raw outputs before subsequent prototype work.

One A/B pair is descriptive, not statistically conclusive. Discuss shared system context, stochastic variation and unequal knowledge of module conventions. Report B being worse or equal if that is what happens.
