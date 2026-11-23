# Moderation search · Search & Recommendations and Admin & Identity

Draft for joint review. Search sign-off pending. Admin & Identity sign-off pending.

**Trigger.** A signed-in moderator searches for an offer in the Admin back office. Admin owns the screen and sign-in. Search owns the read-only HTTP and MCP search operations.

**Steps.** Admin calls Search `GET /api/v1/search?scope=moderation&q=…` with the test user's shared Identity session. Search forwards only `erp_access_token` to Identity `GET /auth/check?permission=offers:approve`. On approval, Search returns matching active, pending, rejected, and blocked offers with their status. Admin can use the returned `offerId` for an authorized sandbox operation once its owner and write contract are confirmed.

**Contracts.** Search OpenAPI goes from 1.0.0 to 1.1.0. It adds optional `scope`, a moderation response with `status`, and moderation error responses. Admin's draft uses its existing permission operation. Verify the running contract and record the confirmed Identity OpenAPI version at sign-off.

**Errors.** Search returns 401 for a missing or expired session, 403 for denied permission, 502 for an unexpected Identity client error, and 503 for an outage, timeout, or malformed success response. An unknown search term returns 200 with empty results. Public search does not contact Identity.

**Acceptance.** Given a moderator searching the sandbox or labelled fixture catalog, results include matching non-public offers and exclude removed offers. Given a signed-in user without the permission, including a moderator whose permission was revoked after sign-in, the same request returns 403. Given an Identity outage, moderation fails within ten seconds and public search remains available.

**Rehearsal.** Run Search at `http://localhost:3006` and Identity at `http://localhost:8000`. Run the read task using both MCP servers, then ask for confirmation before the agreed Admin-owned sandbox write. The live Identity and Marketplace URLs, the Admin write, and the joint run evidence are pending partner confirmation.
