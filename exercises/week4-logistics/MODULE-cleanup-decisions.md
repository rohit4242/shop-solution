# MODULE.md cleanup: decisions (rule of thumb from Session 4)

Every task → MODULE.md · Sometimes → skill · Changes with a feature → spec · Not needed → delete

| Section     | Decision                                                               | Reason                                                                                               |
| ----------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Purpose     | Keep                                                                   | Every task needs to know what the module is for                                                      |
| Structure   | Keep + add `specs/`                                                    | Agent always needs to know where files are; specs are new                                            |
| Interfaces  | Shorten → point to `contracts.ts`                                      | Full field lists duplicated `contracts.ts` and will change after partner review; one source of truth |
| Conventions | Keep all + "do not change test files"                                  | Short rules that apply to every coding task                                                          |
| Pitfalls    | Keep                                                                   | Exactly the mix-ups the agent made in last week's Run A                                              |
| (new) Skill | "Add/change a shipment status" → `.claude/skills/add-shipment-status/` | Recurring procedure, only needed for status tasks                                                    |
| (new) Spec  | Delivery retry → `specs/delivery-retry/`                               | Feature-specific requirements and decisions                                                          |
