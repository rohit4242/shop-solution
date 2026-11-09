# Marketplace interface review — 26 October 2026

**Later clarification:** Admin supplied a conflicting article proposal and a joint review is now open. The statements below remain Marketplace's position, not a final shared ownership decision. See [the consolidated review](submission/INTERFACE-REVIEW.md).

Evidence: Marketplace reply pasted by Rohit in this chat on 26 October. This is a real partner response, not a simulated review. Their draft API spec is still forthcoming. No evidence yet that both teams have revised their MODULE.md files.

## Partner statements

- Marketplace registers sellers and stores their products and offers, including product names, descriptions, categories, images and attributes.
- Admin & Identity moderates; those decisions are saved with Marketplace.
- Each product currently belongs to one seller; Marketplace generates productId. This does not establish exactly one offer per product.
- priceMinor includes VAT and excludes discounts. Marketing owns discounts and would supply final discounted prices.
- availability values: in_stock, out_of_stock.
- Only active offers are approved and publicly visible. pending, rejected, blocked and removed must not appear in search/recommendations.
- Proposed change feed: GET /offers?updatedSince=<timestamp>. Changed blocked/removed offers remain in the feed with their new status so consumers can remove them from the index.
- Proposed fields: offerId, productId, sellerId, name, description, category, attributes, imageUrls, priceMinor, currency, availability, status, updatedAt.
- Mocking this structure is welcome; final endpoint and response envelope are still to be agreed.

## Mismatches and revisions on our side

| Previous assumption               | Partner clarification                     | Our revision                                                                         |
| --------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Admin supplies catalog            | Marketplace stores product and offer data | Marketplace is the incoming source; Admin moderation arrives through status          |
| categoryId                        | category, e.g. Electronics                | Use category as supplied; do not pretend it is a stable category ID                  |
| tags                              | attributes object                         | Preserve attributes; proposed similarity uses exact shared attribute pairs           |
| isPublished boolean               | status enum                               | Public eligibility is exactly status === active                                      |
| Multi-seller selection unresolved | One seller per product for now            | No multi-seller cheapest-offer algorithm; offer cardinality still needs confirmation |
| Price meaning unknown             | VAT included, before discounts            | Label search prices as pre-discount; do not claim checkout/final price               |
| Deletion behaviour unknown        | Non-active changes remain in feed         | Evict indexed offers when their status becomes non-active                            |

Our MODULE.md and API guide are revised. Storefront has not accepted the revised response fields. Marketplace's final spec and confirmation that its own context file reflects the agreement remain pending. This is substantive review evidence but does not prove the exercise's both-files-updated step is complete.

## Questions to close before live integration

1. Final base URL, response envelope, initial full-sync method, authentication and pagination/cursor.
2. Is updatedSince inclusive? What are timestamp precision, timezone, ordering and same-timestamp tie rules? How are consistent pages/watermarks provided?
3. How long are blocked/removed records retained, and how does a consumer recover after missing that window? Do such records keep all fields or use a minimal tombstone?
4. Are productId and offerId stable, and can a product have multiple offers from its one seller?
5. Is category a display label or stable key? What value types are permitted in attributes? Are empty description/image lists allowed?
6. Should active out_of_stock offers remain discoverable? Proposed default: yes, with availability returned, because stock and moderation are distinct.

No new messages were sent to teams by the assistant.
