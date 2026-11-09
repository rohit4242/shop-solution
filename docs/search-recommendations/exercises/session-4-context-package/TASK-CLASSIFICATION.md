# Part 4 — Workflow or agent?

These are recurring tasks in Search & Recommendations. The choice depends on how predictable the steps are. It does not mean the basic search API needs an AI model at runtime.

| Recurring task                                                                        | Best fit                | One-sentence reason                                                                                                 |
| ------------------------------------------------------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Validate incoming catalog data and refresh the index                                  | Workflow                | Fetching, validating and updating follow a known sequence that should run deterministically.                        |
| Classify a natural-language request as a product lookup, comparison or recommendation | Routing                 | Classifying the intent selects the specialised handler for that request.                                            |
| Generate and check candidate search synonyms                                          | Prompt chaining         | Extracting terms, proposing synonyms and checking relevance are dependent stages with inspectable outputs.          |
| Improve a ranking configuration against labelled examples                             | Evaluator and optimizer | Explicit relevance checks guide bounded revisions to the candidate configuration.                                   |
| Investigate why an expected product is missing from search                            | Agent                   | The investigation must choose its next action based on findings about source data, visibility, filters or indexing. |

We selected the pattern that fits each task; the exercise does not require using every lecture pattern. Lecture-specific terminology should be checked against the course material when available.
