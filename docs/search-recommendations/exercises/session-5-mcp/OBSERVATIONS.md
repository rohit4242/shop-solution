# Agent observations — pending real model runs

Protocol smoke checks are recorded separately in evidence/protocol-smoke.jsonl. They prove transport and API behavior, not that a model selected tools correctly.

| Observation                             | Happy path                                           | Error case                        | Several steps                                                                              |
| --------------------------------------- | ---------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------ |
| Prompt                                  | Find in-stock wireless products costing at most €25. | Find alternatives to prd_missing. | Search Wireless Mouse, then compare similar and also-bought results using the returned ID. |
| Tools called and order                  | Pending real run                                     | Pending real run                  | Pending real run                                                                           |
| Expected API requests in logs?          | Pending correlation                                  | Pending correlation               | Pending correlation                                                                        |
| Final answer correct?                   | Not evaluated                                        | Not evaluated                     | Not evaluated                                                                              |
| Error reported or invented information? | Not evaluated                                        | Not evaluated                     | Not evaluated                                                                              |
| Description changed afterwards?         | No experiment yet                                    | No experiment yet                 | No experiment yet                                                                          |

Extra scenario: request also-bought results for Desk Speaker / prd_5. Expect a successful empty list, with no similarity substitution. Real model interpretation remains unevaluated.

For each run record provider/model, settings, prompt, timestamp, tool/contract hashes, transcript, request IDs and verdict. If descriptions fail, preserve the original run, change descriptions first, keep the prompt fixed, and compare. Never manufacture an initial failure.
