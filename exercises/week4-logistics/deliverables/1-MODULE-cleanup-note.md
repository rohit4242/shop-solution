# Part 1 – MODULE.md cleanup (Logistics)

Rule of thumb: every task → MODULE.md · some tasks → skill · one feature → spec · not needed → delete.

| Section                         | Decision                          | Moved to                                    | Why                                                                           |
| ------------------------------- | --------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------- |
| Purpose                         | Keep                              | MODULE.md                                   | Every task needs to know what the module does                                 |
| Structure                       | Keep + add `specs/`               | MODULE.md                                   | Agent must know where files and specs are                                     |
| Interfaces                      | Shortened to a pointer            | `src/contracts.ts` (single source of truth) | Full field lists duplicated contracts.ts and will change after partner review |
| Conventions                     | Keep + "do not change test files" | MODULE.md                                   | Short rules for every coding task                                             |
| Pitfalls                        | Keep                              | MODULE.md                                   | Exactly the mix-ups Run A made last week                                      |
| Procedure "add/change a status" | New                               | Skill `add-shipment-status`                 | Needed only for some tasks                                                    |
| Delivery retry requirements     | New                               | Spec `specs/delivery-retry/`                | Belongs to one feature                                                        |
| —                               | Nothing deleted                   | —                                           | No section was unrelated to the work                                          |

## Size before and after

Method: character count of both files; tokens estimated at about 4 characters per token (an online tokenizer was not reachable from our environment).

|                                              | Before | After         |
| -------------------------------------------- | ------ | ------------- |
| Characters                                   | 2,234  | 1,983 (−11 %) |
| Tokens (estimated, ≈ 4 characters per token) | ≈ 560  | ≈ 500 (−11 %) |

Observation: our MODULE.md was already lean, so the saving is small. The main gain is one source of truth for interfaces, not size.
