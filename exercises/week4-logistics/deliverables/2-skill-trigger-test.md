# Part 2 – Skill trigger test: `add-shipment-status`

Skill folder: `.claude/skills/add-shipment-status/SKILL.md`
Tool: Claude (same tool as all other parts). Each prompt ran in a fresh agent session in the project folder, with read-only access; the session reported which skill it invoked, if any.

| #   | Prompt                                                                                                                                                     | Expected | Loaded?                        | What the agent did                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | "Add a new shipment status ON_HOLD that a shipment can enter from IN_TRANSIT and leave back to IN_TRANSIT."                                                | Load     | ✅ Yes – `add-shipment-status` | Followed the skill's steps: union in contracts.ts, direct edges only, not terminal, new test file (allowed, forbidden in/out, duplicate), open question in INTERFACE_REVIEW.md |
| 2   | "A shipment that is OUT_FOR_DELIVERY should also be allowed to go directly to RETURNED when the customer refuses the parcel. Update the transition rules." | Load     | ✅ Yes – `add-shipment-status` | Changed only one edge, new tests instead of editing old ones, flagged the change for Accounting/Storefront                                                                     |
| 3   | "Explain the folder structure of the Logistics module."                                                                                                    | Not load | ✅ Not loaded (correct)        | Answered from MODULE.md and the files; said the skill is "for changing statuses, not for explaining the structure"                                                             |

Additional evidence: in Part 5, task T1 (retry rules) also loaded the skill.

## Result

3 of 3 behaved as expected, so the description was not changed:
_"Add, remove or change a shipment status or an allowed status transition in the Logistics module. Use when a task mentions a new status (e.g. RETURN_IN_TRANSIT), a new or forbidden transition, or retry rules between statuses."_

Side observation: with the skill loaded, both agents also added an open question to INTERFACE_REVIEW.md (skill step 8) instead of assuming the partner teams agree.
