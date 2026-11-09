# Review and release gates

| Gate                                                       | Status                                  | Evidence required                                       |
| ---------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------- |
| Instructor accepts Next.js instead of FastAPI              | Pending                                 | Actual instructor response and date                     |
| Admin & Identity reviews public contract                   | Pending                                 | Reviewer, feedback, agreed changes and contract version |
| Admin & Identity reviews minimal login + user-ID allowlist | Pending                                 | Owner approval on current revision                      |
| Maintainer accepts MCP-to-API HTTP exception               | Pending                                 | Architecture approval                                   |
| Marketplace source contract                                | Provisional                             | Final wire/auth/pagination agreement                    |
| Purchase source ownership                                  | Unassigned                              | Real owner's agreed semantics; do not invent ownership  |
| Two independent external-group approvals                   | Pending                                 | Current-revision approvals under repository policy      |
| Real model evidence                                        | Pending credentials                     | Actual course/playground runs, not mocks                |
| Production deployment                                      | Pending account/configuration and gates | Verified stable URL and smoke evidence                  |

No messages have been sent to other teams. This file does not imply approval.

## Contract review checklist

Confirm five GET operations, opaque ID strings (fixture examples prd_1/off_1/sel_2), active-offer visibility, anonymous public reads, EUR minor units, default stock behavior, empty results versus errors, and no user personalization. Preserve the existing version 1.0.0 until a reviewed contract change requires versioning.

Record each review as: date; reviewer/team; requested change; agreed resolution; resulting contract version; evidence reference.
