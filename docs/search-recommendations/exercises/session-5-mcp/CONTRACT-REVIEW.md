# Contract review with Admin & Identity

Exercise Part 1: review [openapi.yaml](../../openapi.yaml) with our neighbouring team, note every agreed change, and give the agreed version a number in `info.version`.

Current version: **1.0.0**, agreed with Admin & Identity on 2026-11-09 without changes.

## Questions we brought

- **What they need from us:** do they need search or recommendations for a signed-in user? Our API is anonymous today and returns the same results for everyone. The lecture names "user profile, permissions → personalised results" as the typical interface between our teams.
- **What we need from them:** a user ID format and a way to read a user's profile or permissions, if personalisation is agreed.
- **Catalog source:** who publishes the product records we index (Marketplace offers, Admin catalog editing, or both)?
- **ID formats:** we use `prd_`, `off_` and `sel_` prefixes. Do they match what the other teams use?
- **Errors:** `400 INVALID_INPUT`, `404 PRODUCT_NOT_FOUND`, `503 …_UNAVAILABLE`. Is that enough for their callers?

## Review record

Fill in one row per agreed change.

| Date       | Reviewer / team                  | Requested change                                                                                                                  | Agreed resolution       | New version |
| ---------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------- | ----------- |
| 2026-11-09 | Admin & Identity team (WhatsApp) | None. Our API is anonymous and needs nothing from their side; they confirmed there is no interaction between our features for now | Contract accepted as is | 1.0.0       |

Outcome of the questions: no personalisation for now, so we need no user ID, profile or permissions from Admin & Identity. The catalog source and ID formats are Marketplace topics; we asked them separately.

## Other open items

| Item                                         | Status                                            |
| -------------------------------------------- | ------------------------------------------------- |
| Instructor OK for Next.js instead of FastAPI | Not asked yet                                     |
| Marketplace catalog feed                     | Provisional; final paging and auth not agreed     |
| Real purchase data for also-bought           | No owner assigned; we use synthetic data          |
| Cross-group PR approvals                     | Two approvals from two other groups needed per PR |
