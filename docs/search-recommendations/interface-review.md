# Current review update — 26 October 2026

Marketplace has replied. See [the review record](marketplace-review-2026-10-26.md) for confirmed responsibilities, mismatches and remaining questions. The packet below is the historical pre-review proposal; its Admin/catalog and field assumptions are superseded by that record and API-CONTRACT.md. Both-file revision confirmation remains pending.

# Partner interface review packet

Status: prepared for exchange; no review has occurred. All wire contracts are proposals.

## Request to Admin & Identity

Your listed responsibility includes editing webshop articles. Please confirm whether you also own canonical catalog storage/API, and which source owns prices. We propose the SearchProduct record in the feature README. Please mark each field accepted, renamed, unavailable, or owned elsewhere.

Resolve: unique/stable product and category IDs; description/searchable attributes for later full-text search; integer-cent price meaning (including VAT and promotions); currency; publication/deletion behaviour; tag vocabulary; catalog endpoint and pagination; authentication; refresh cadence; complete versus incremental snapshots; timeout/retry expectations. Our initial public search supports only publicly published products. Do any records require additional visibility restrictions?

No real catalog integration is ready until endpoint, access, refresh and deletion semantics are agreed. Catalog editing ownership alone does not confirm ownership of every field.

## Request to Storefront

Please review the two proposed HTTP APIs in the feature README. Confirm request names, response fields, price units, pagination, ordering, no-result behaviour and errors. Storefront owns the search box, filters, product cards and recommendation UI. This prototype does not supply images, URLs, rating summaries or category labels; confirm whether you will obtain those from catalog APIs or request a contract extension. Keep product IDs stable across services.

Later: agree facet counts, autocomplete, and impression/click capture with Analytics. Serving a result does not prove it was displayed or clicked.

## Dependency register

| Team                          | Potential input to us                                         | Potential output from us                                                | Trigger/status                                                      |
| ----------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Admin & Identity              | Catalog; later identity/permissions                           | Optional admin search                                                   | Catalog proposed now; confirm provider                              |
| Storefront                    | Queries, filters, source product ID; later interaction events | Search, similar products; later facets/autocomplete/co-purchase results | Primary consumer                                                    |
| Marketplace                   | Seller identity/listing status if owned there                 | Seller-filtered discovery                                               | Only if seller discovery required                                   |
| Reviews & Ratings             | Aggregate rating/review count                                 | None required                                                           | Rating filter/ranking requested                                     |
| CRM                           | Permitted preferences/segments                                | None required                                                           | Personalisation requested                                           |
| Marketing                     | Promotion eligibility/product IDs                             | Campaign recommendations                                                | Joint requirement and price semantics agreed                        |
| Analytics / Reporting         | Popularity aggregates if calculated there                     | Search counts, zero-result and serving events                           | Event contract agreed; avoid double counting                        |
| Accounting                    | Purchase/refund facts if appropriate source                   | None required                                                           | Do not infer canonical order ownership                              |
| Logistics                     | Delivery eligibility/estimates if available                   | None required                                                           | Delivery-based discovery requested                                  |
| Unassigned purchase provider  | Product IDs grouped by qualifying purchases                   | None required                                                           | Required for customers-also-bought; agree cancellation/refund rules |
| Unassigned inventory provider | Product availability                                          | None required                                                           | Availability filtering requested                                    |

## Review log

| Date / partner / reviewer | Our expectation | Their expectation | Mismatch     | Agreed resolution | Both files revised / evidence |
| ------------------------- | --------------- | ----------------- | ------------ | ----------------- | ----------------------------- |
| Pending                   | Not reviewed    | Not reviewed      | Not assessed | None              | None                          |

Record actual confirmations and disagreements, including a confirmed no-mismatch outcome if applicable. Never substitute an AI role-play for the partner exchange. Each team updates its own file. Freeze the revised MODULE.md only after the required review.
