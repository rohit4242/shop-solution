# Exercise submission working draft

Status: preparation only. Interface review, A/B observations and conclusion remain pending. This is not a finished report.

## Experiment report template (final maximum two pages)

Task: simple product search with category and price filters. Context: one-page MODULE.md, version/hash and measured token count to be recorded after review. Record tool/model/settings and isolation method.

| Observation                      | Run A: task only | Run B: task + context |
| -------------------------------- | ---------------- | --------------------- |
| Assistant messages / tool calls  | Not run          | Not run               |
| Tokens, if available             | Not run          | Not run               |
| Human interventions              | Not run          | Not run               |
| Conventions followed             | Not assessed     | Not assessed          |
| Interfaces used correctly        | Not assessed     | Not assessed          |
| Agent tests / independent checks | Not run          | Not run               |
| Usable as delivered              | Not assessed     | Not assessed          |

Conclusion: fill only from preserved observations. Explain what changed, what did not, and whether intervention was needed. Discuss one-pair limitations and convention knowledge differences. Keep evidence transcripts outside the two-page report. Render and check the final page count after actual results are available.

## Part 4: recurring tasks

Provisional terminology: check against the lecture before submission.

| Recurring task                                 | Approach                | Reason                                                                       |
| ---------------------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Validate and refresh catalog data              | Workflow                | A fixed validation and refresh sequence is predictable.                      |
| Dispatch search versus recommendation requests | Routing                 | The request type selects a specialised operation.                            |
| Draft and validate search synonyms             | Prompt chaining         | Extraction, generation and checking form sequential stages.                  |
| Improve ranking using labelled examples        | Evaluator and optimizer | Measured relevance guides bounded revisions.                                 |
| Investigate unexpected poor search results     | Agent                   | Diagnosis requires choosing among data inspection, reproduction and testing. |

A deterministic API router is sufficient for request dispatch; this row does not require adding an LLM. If the lecture defines routing specifically as model-based classification, replace it with classifying ambiguous discovery requests by intent. No LLM is needed in the initial search API.

## Five-minute presentation outline

- 0:00-0:45: API-only module, provider/consumer map, first prototype versus full scope.
- 0:45-1:30: actual interface mismatch and resolution (or confirmed agreement); no invented example presented as evidence.
- 1:30-2:30: task, fresh sessions, common inputs and context difference.
- 2:30-4:00: strongest actual observation, supported by a code/output excerpt and measured results.
- 4:00-5:00: conclusion, limitations and recurring-task classification.

Prepare final slides/speaker notes only after results exist. Exact submission date and lecture definitions have not been supplied.
