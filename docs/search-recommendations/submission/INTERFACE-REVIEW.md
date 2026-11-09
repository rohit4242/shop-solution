# Part 2 — Interface review

## What we reviewed

We discussed the data Search & Recommendations needs with Marketplace and Admin & Identity. Their replies revealed different assumptions about ownership and field names. A joint group chat was created to resolve them. This is an ongoing real review, not a completed agreement.

## What each team said

Marketplace says sellers create their products/offers there, Marketplace generates productId, and Admin moderation decisions are stored with Marketplace. Its proposed offer includes product details, seller ID, price, availability, status and updatedAt. It proposes GET /offers?updatedSince=<timestamp> and will share a draft specification.

Admin proposes an articles table with article_id, name, optional description, category_id, tags and is_published. Admin also said category ownership had not yet been discussed. It then acknowledged uncertainty and created the joint chat. Its later message suggests article and product describe the same item, while an offer adds selling terms. That interpretation has not yet resolved ownership or shared IDs.

## Mismatches found

| Topic                          | Different expectations                                           | Our current handling                                                                                        |
| ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Ownership and identity         | Admin: articles/article_id; Marketplace: products/productId      | Keep both proposals documented; require a shared ID or explicit mapping and a named owner.                  |
| Categories                     | Admin: category_id; Marketplace: category label                  | Do not rename a label into an ID. Agree keys, labels and category ownership.                                |
| Search attributes              | Admin: tags; Marketplace: attributes                             | Preserve the distinction; do not assume a lossless mapping.                                                 |
| Visibility                     | Admin: is_published; Marketplace: status                         | Marketplace says only active is public. Agree how moderation and publication relate before joining sources. |
| Price                          | Teammate proposed float price; Marketplace uses priceMinor       | Use integer cents for our proposal; Marketplace says VAT included, before Marketing discounts.              |
| Changes and removal            | Marketplace proposes incremental GET; teammate proposes webhooks | Both are proposals; do not claim either is a joint requirement. Agree one integration contract.             |
| Authentication/internal search | Teammate proposed JWT/JWKS, permissions and admin search         | No provider agreement is evidenced; keep outside the initial public-search experiment.                      |

Marketplace also states one seller per product, availability in_stock/out_of_stock, and statuses active/pending/rejected/blocked/removed. Changed blocked/removed offers remain in its proposed feed so we can remove them from an index. This is their stated design, not proof of a jointly finalised API.

## What we changed

We revised MODULE.md to show both proposals and their unresolved differences. New mock contracts follow the Marketplace proposal as a temporary choice, not as ownership authority. We retained the original experiment fixtures/context unchanged. Storefront remains our intended consumer and owns UI/UX; its acceptance of our result fields has not been received.

## What still needs agreement

Agree the product/article owner and shared IDs, the offer relationship, category keys, visibility rules, response envelope, access and update semantics. Confirm whether both teams have updated their interface sections. The assignment requires mismatches to be fixed in both files; we have updated ours, but cannot claim the partner-file step is complete.
