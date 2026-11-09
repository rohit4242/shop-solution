# Historical proposal — superseded on 26 October 2026

Do not use this version for integration. See API-CONTRACT.md.

# Search & Recommendations — Team API Guide

**Status: proposal for team review, not a deployed API.** No endpoint below is implemented yet. Examples use fictional data. Field names, ownership and provider endpoints need confirmation with the relevant teams.

**Our responsibility:** search and recommendation APIs. **Storefront's responsibility:** all customer UI/UX. Teams exchange JSON over HTTP; nobody needs to use our TypeScript, Zod, database or internal code.

## 1. Who gives us data, and who uses our results?

| Team                            | They give us                                                                                             | We give them                                                                             | Status                                                                          |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Admin & Identity                | Product identity, name, category, description/tags and publication status; confirm catalog API ownership | Search APIs if their admin tools need them                                               | Proposed catalog provider: they own product editing                             |
| Marketplace                     | Seller offers: offer ID, product ID, seller ID, price, currency, availability and offer status           | Seller-filtered results if requested                                                     | Rayyan has asked which fields we need; ownership and contract not yet confirmed |
| Storefront                      | Search text, filters, pagination, source product ID                                                      | Search results, similar products; later facets, autocomplete and co-purchase suggestions | Primary consumer; owns all display and interaction                              |
| Reviews & Ratings               | Product rating aggregates if required                                                                    | No mandatory return feed                                                                 | Optional rating filters/ranking                                                 |
| CRM                             | Permitted preferences/segments if required                                                               | No mandatory return feed                                                                 | Future personalisation only                                                     |
| Marketing                       | Promotion eligibility if required                                                                        | Campaign recommendations if requested                                                    | Future, jointly agreed integration                                              |
| Analytics / Reporting           | Popularity aggregates if required                                                                        | Search counts, zero-result and recommendation-serving events                             | Future event contract; Storefront records actual impressions/clicks             |
| Accounting                      | Purchase/refund facts only if confirmed as the right source                                              | No mandatory return feed                                                                 | Do not assume ownership of canonical orders                                     |
| Logistics                       | Delivery eligibility/estimates if required                                                               | No mandatory return feed                                                                 | Does not imply ownership of inventory                                           |
| Purchase-data owner: unassigned | Products purchased together in qualifying orders                                                         | No mandatory return feed                                                                 | Required for “customers also bought”                                            |

We do not require a connection to every team. The first mock prototype needs a catalog-shaped input and Storefront-shaped requests. Real Marketplace integration introduces the separate offer model below. Inventory ownership remains unresolved.

## 2. Product versus offer: keep these separate

A **product** describes an item. An **offer** describes one seller's terms for that item. If two sellers sell the same mug, there may be one `productId` and two `offerId` values. This relationship still needs Marketplace confirmation.

### Proposed catalog input — Admin & Identity

| Field       | Type             | Meaning                                                                          |
| ----------- | ---------------- | -------------------------------------------------------------------------------- |
| productId   | string           | Stable shared product ID, not a seller or offer ID                               |
| name        | string           | Product name                                                                     |
| categoryId  | string           | Shared category identifier, not its display label                                |
| tags        | string[]         | Attributes used by the first similarity algorithm                                |
| isPublished | boolean          | Product is eligible for public discovery; confirm whether more permissions apply |
| description | string, optional | Product text for later full-text search; unused in the first name-only search    |

```json
{
  "productId": "p-01",
  "name": "Alpine Mug",
  "categoryId": "home",
  "tags": ["ceramic", "blue"],
  "isPublished": true,
  "description": "A blue ceramic mug."
}
```

### Proposed offer input — Marketplace

| Field        | Type                         | Meaning                                                         |
| ------------ | ---------------------------- | --------------------------------------------------------------- |
| offerId      | string                       | Unique seller-offer ID                                          |
| productId    | string                       | Links to the same canonical catalog ID                          |
| sellerId     | string                       | Seller identifier                                               |
| priceMinor   | integer >= 0                 | Price in euro cents: 1999 = EUR 19.99                           |
| currency     | "EUR"                        | Single-currency proposal for our first version                  |
| availability | "in_stock" or "out_of_stock" | Proposed values, not yet agreed; no exact stock count requested |
| status       | "active" or "inactive"       | Offer publication/eligibility, independent of stock             |

```json
{
  "offerId": "offer-101",
  "productId": "p-01",
  "sellerId": "seller-7",
  "priceMinor": 1999,
  "currency": "EUR",
  "availability": "in_stock",
  "status": "active"
}
```

Marketplace must confirm these enum values, whether it owns or relays availability, whether multiple offers per product exist, and whether prices include VAT/discounts/shipping. Do not infer inventory ownership from an availability field.

### Temporary first-prototype input

The already-planned mock search uses `SearchProduct`: the five required catalog fields plus `priceMinor` and `currency`. It has no seller/offer selection. This is a temporary module input, **not a decision that canonical prices belong to the catalog**.

```json
{
  "productId": "p-01",
  "name": "Alpine Mug",
  "categoryId": "home",
  "tags": ["ceramic", "blue"],
  "isPublished": true,
  "priceMinor": 1999,
  "currency": "EUR"
}
```

Before real multi-seller integration, agree with Marketplace and Storefront whether results represent products with a selected offer or individual offers. Also agree how price filters select offers and prevent duplicate products. The APIs below describe the first product-level prototype; they do **not** silently choose the cheapest seller or merge multiple offers.

### How we fetch real data

Provider URLs, request parameters, authentication and response envelopes are **not supplied yet**. We will not invent `/products` or `/offers` endpoints on another team's behalf. Providers must confirm pagination, refresh/update and deletion behaviour, error handling and access credentials. Our adapter validates their responses and maps them into our module's agreed input. Initially that adapter reads fictional fixtures. We never read their tables directly.

## 3. Our endpoint list

| Method and path                         | Purpose                                         | Consumer   | Delivery stage                             |
| --------------------------------------- | ----------------------------------------------- | ---------- | ------------------------------------------ |
| GET /api/v1/search                      | Name search, category/price filters, pagination | Storefront | First prototype, proposed                  |
| GET /api/v1/recommendations/similar     | Products with similar catalog attributes        | Storefront | First prototype, proposed                  |
| GET /api/v1/search/facets               | Available category choices and matching counts  | Storefront | Future draft, not first prototype          |
| GET /api/v1/search/autocomplete         | Product-name suggestions                        | Storefront | Future draft, not first prototype          |
| GET /api/v1/recommendations/also-bought | Products bought together                        | Storefront | Future draft; purchase provider unassigned |

Paths are relative to our application's host; a deployed base URL has not been assigned. All are proposed public read-only APIs for public products. No personalisation, user IDs or customer PII are accepted. CORS/hosting rules will be agreed for actual integration.

## 4. Search

`GET /api/v1/search`

| Query parameter | Type    | Default | Rules                                          |
| --------------- | ------- | ------- | ---------------------------------------------- |
| q               | string  | empty   | Trim; case-insensitive substring match on name |
| categoryId      | string  | omitted | Exact ID match; if present, nonempty           |
| minPriceMinor   | integer | omitted | Nonnegative, inclusive                         |
| maxPriceMinor   | integer | omitted | Nonnegative, inclusive; >= minimum             |
| page            | integer | 1       | >= 1                                           |
| pageSize        | integer | 20      | 1–100                                          |

```http
GET /api/v1/search?q=mug&categoryId=home&minPriceMinor=1000&maxPriceMinor=2500&page=1&pageSize=20
```

```json
{
  "data": {
    "items": [
      {
        "productId": "p-01",
        "name": "Alpine Mug",
        "categoryId": "home",
        "priceMinor": 1999,
        "currency": "EUR"
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 20
  }
}
```

Combine filters with AND. Empty q matches all published products. Sort by original name then productId using deterministic lexical comparison, not locale-dependent collation. Filter/sort before pagination. `total` counts matching products before pagination. No match or an out-of-range page gives `items: []`, not 404; total remains the number of matches.

This is basic name matching, not a claim of complete full-text search. Descriptions, stemming and relevance ranking are future work. Seller, rating and availability filters are not accepted in this prototype.

## 5. Similar products

`GET /api/v1/recommendations/similar`

| Query parameter | Type    | Default  | Rules                             |
| --------------- | ------- | -------- | --------------------------------- |
| productId       | string  | required | Nonempty public source product ID |
| limit           | integer | 5        | 1–20                              |

```http
GET /api/v1/recommendations/similar?productId=p-01&limit=5
```

```json
{
  "data": {
    "items": [
      {
        "productId": "p-02",
        "name": "Travel Mug",
        "categoryId": "home",
        "priceMinor": 2499,
        "currency": "EUR"
      }
    ]
  }
}
```

Choose other published products in the same category. Rank by shared distinct tag count descending, then productId ascending; zero shared tags is allowed. Exclude the source. Missing/unpublished source: 404. No eligible candidates: 200 with empty items. These results are **similar products**, never labelled “customers also bought.”

## 6. Future draft APIs (review separately)

These shapes make discussion concrete, not an implementation commitment. First-prototype routes must not advertise them as working.

### Category facets

```http
GET /api/v1/search/facets?q=mug&minPriceMinor=1000&maxPriceMinor=2500
```

```json
{
  "data": {
    "categories": [{ "categoryId": "home", "count": 2 }]
  }
}
```

Proposal: accept q and price bounds, but no category filter or pagination. Count distinct published matching products per category using the same search matching; omit zero counts and order by categoryId. Counts ignore the selected category so Storefront can show alternatives. Labels come from a separately agreed catalog source. Other facets require their own agreed attributes and semantics.

### Autocomplete

```http
GET /api/v1/search/autocomplete?q=al&limit=5
```

```json
{
  "data": {
    "suggestions": [{ "productId": "p-01", "text": "Alpine Mug" }]
  }
}
```

Proposal: q is required, trimmed and at least two characters; limit defaults to 5, range 1–10. Case-insensitive product-name prefix matching, published products only, ordered by name then ID. One suggestion per product ID; different products may share a name. Too-short q: 400. No matches: empty suggestions. No user search-history suggestions.

### Customers also bought

```http
GET /api/v1/recommendations/also-bought?productId=p-01&limit=5
```

```json
{
  "data": {
    "items": [
      {
        "productId": "p-03",
        "name": "Coaster Set",
        "categoryId": "home",
        "priceMinor": 899,
        "currency": "EUR"
      }
    ]
  }
}
```

Proposed public parameters and summary shape match similar products. Needs purchase relationships, not catalog tags. Provider, qualifying purchases, time window, cancellation/refund handling and ranking are **unresolved**. Do not substitute similarity under this endpoint or invent purchase counts. Do not implement until these decisions are agreed. A successfully computed empty result differs from a failed/unavailable source.

## 7. Errors and shared rules

```json
{
  "error": {
    "code": "INVALID_INPUT",
    "message": "minPriceMinor must not exceed maxPriceMinor."
  }
}
```

| HTTP | code                            | When                                                                   |
| ---- | ------------------------------- | ---------------------------------------------------------------------- |
| 400  | INVALID_INPUT                   | Invalid/missing parameter, repeated/unknown query key or invalid range |
| 404  | PRODUCT_NOT_FOUND               | Recommendation source absent or unpublished                            |
| 503  | CATALOG_UNAVAILABLE             | First-prototype catalog unavailable or invalid                         |
| 503  | RECOMMENDATION_DATA_UNAVAILABLE | Future purchase-based source unavailable; proposed only                |

Success uses `{ data: ... }`; errors use `{ error: { code, message } }`. Never expose stack traces, secrets or upstream response bodies. Reject malformed numeric query values, blanks, negatives where prohibited, unsafe integers and duplicate keys. Prices are cents, not floats. Missing results are not dependency errors.

Checkout must revalidate price and availability with its authoritative provider. Our summaries are discovery data, not purchase guarantees. Do not send email addresses, customer names, private seller details or auth tokens to Storefront in these responses.

## 8. Proposed Zod schemas and inferred TypeScript types

Reference code for discussion and later implementation; not currently wired to routes. Other teams need only follow the JSON contract. The catalog and offer types are separate from the temporary flattened mock type.

```ts
import { z } from "zod";

const idSchema = z.string().min(1);
const minorPriceSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const currencySchema = z.literal("EUR");

export const catalogProductSchema = z.object({
  productId: idSchema,
  name: z.string().min(1),
  categoryId: idSchema,
  tags: z.array(z.string().min(1)),
  isPublished: z.boolean(),
  description: z.string().optional(),
});

export const marketplaceOfferSchema = z.object({
  offerId: idSchema,
  productId: idSchema,
  sellerId: idSchema,
  priceMinor: minorPriceSchema,
  currency: currencySchema,
  availability: z.enum(["in_stock", "out_of_stock"]),
  status: z.enum(["active", "inactive"]),
});

export const searchProductSchema = catalogProductSchema.extend({
  priceMinor: minorPriceSchema,
  currency: currencySchema,
});

export const productSummarySchema = z.object({
  productId: idSchema,
  name: z.string().min(1),
  categoryId: idSchema,
  priceMinor: minorPriceSchema,
  currency: currencySchema,
});

// HTTP query values arrive as strings. Reject blanks, decimals and exponent notation.
const queryInteger = (min: number, max = Number.MAX_SAFE_INTEGER) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const priceFilters = {
  minPriceMinor: queryInteger(0).optional(),
  maxPriceMinor: queryInteger(0).optional(),
};
const validPriceRange = (v: {
  minPriceMinor?: number;
  maxPriceMinor?: number;
}) =>
  v.minPriceMinor === undefined ||
  v.maxPriceMinor === undefined ||
  v.minPriceMinor <= v.maxPriceMinor;
const rangeError = {
  message: "minPriceMinor must not exceed maxPriceMinor.",
  path: ["minPriceMinor"],
};

export const searchQuerySchema = z
  .strictObject({
    q: z.string().trim().default(""),
    categoryId: idSchema.optional(),
    ...priceFilters,
    page: queryInteger(1)
      .optional()
      .transform((v) => v ?? 1),
    pageSize: queryInteger(1, 100)
      .optional()
      .transform((v) => v ?? 20),
  })
  .refine(validPriceRange, rangeError);

export const recommendationQuerySchema = z.strictObject({
  productId: idSchema,
  limit: queryInteger(1, 20)
    .optional()
    .transform((v) => v ?? 5),
});

export const searchResponseSchema = z.object({
  data: z.object({
    items: z.array(productSummarySchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
  }),
});
export const recommendationResponseSchema = z.object({
  data: z.object({ items: z.array(productSummarySchema) }),
});

// Future draft schemas, not implemented endpoints.
export const facetsQuerySchema = z
  .strictObject({
    q: z.string().trim().default(""),
    ...priceFilters,
  })
  .refine(validPriceRange, rangeError);
export const facetsResponseSchema = z.object({
  data: z.object({
    categories: z.array(
      z.object({ categoryId: idSchema, count: z.number().int().positive() }),
    ),
  }),
});
export const autocompleteQuerySchema = z.strictObject({
  q: z.string().trim().min(2),
  limit: queryInteger(1, 10)
    .optional()
    .transform((v) => v ?? 5),
});
export const autocompleteResponseSchema = z.object({
  data: z.object({
    suggestions: z.array(
      z.object({ productId: idSchema, text: z.string().min(1) }),
    ),
  }),
});
export const errorResponseSchema = z.object({
  error: z.object({
    code: z.enum([
      "INVALID_INPUT",
      "PRODUCT_NOT_FOUND",
      "CATALOG_UNAVAILABLE",
      "RECOMMENDATION_DATA_UNAVAILABLE",
    ]),
    message: z.string().min(1),
  }),
});

export type CatalogProduct = z.infer<typeof catalogProductSchema>;
export type MarketplaceOffer = z.infer<typeof marketplaceOfferSchema>;
export type SearchProduct = z.infer<typeof searchProductSchema>;
export type ProductSummary = z.infer<typeof productSummarySchema>;
export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type SearchResponse = z.infer<typeof searchResponseSchema>;
export type RecommendationQuery = z.infer<typeof recommendationQuerySchema>;
export type RecommendationResponse = z.infer<
  typeof recommendationResponseSchema
>;
export type FacetsQuery = z.infer<typeof facetsQuerySchema>;
export type FacetsResponse = z.infer<typeof facetsResponseSchema>;
export type AutocompleteQuery = z.infer<typeof autocompleteQuerySchema>;
export type AutocompleteResponse = z.infer<typeof autocompleteResponseSchema>;
export type ApiError = z.infer<typeof errorResponseSchema>;

// Use before schema parsing: Object.fromEntries alone would hide duplicate query keys.
export function readQuery(params: URLSearchParams): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const [key, value] of params) {
    if (Object.hasOwn(result, key)) throw new Error("INVALID_INPUT");
    result[key] = value;
  }
  return result;
}

// Inside a future handler: catch duplicate-key errors and map safeParse failures to 400.
const parsed = searchQuerySchema.safeParse(
  readQuery(new URLSearchParams("q=mug&minPriceMinor=1000&page=1")),
);
// parsed.data, when successful, has numeric price/page values and applied defaults.
```

Zod validates shape, not catalog ownership or authorisation. Services must filter publication, enforce source eligibility, join IDs correctly and implement ranking. Response schemas do not replace those tests. Unknown provider fields are stripped by these object schemas; never forward raw provider objects.

## 9. Team review checklist

| Who                           | Decision needed                                                                                                         |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Admin & Identity              | Do you own catalog storage/API? Are IDs, categories, tags and publication fields available? Any extra visibility rules? |
| Marketplace                   | Do you own offers? One product/multiple offers? Confirm price semantics, enums and availability source.                 |
| Storefront + Marketplace + us | Product-level or offer-level results? If product-level, how is an offer selected and price filtering applied?           |
| Each provider                 | Endpoint, access, pagination, updates/deletions and failure handling.                                                   |
| Storefront                    | Are summary fields enough? Who supplies images, category labels and product URLs?                                       |
| Class maintainers             | Who owns qualifying purchase data and inventory?                                                                        |
| Analytics + Storefront + us   | Which service emits each event, with which fields and privacy rules?                                                    |

**Acceptance rule:** record actual reviewer/date, mismatches and agreed changes before marking any contract confirmed. Marketplace's question is evidence of an open discussion, not an approved contract. This document introduces proposals; it does not retroactively freeze or revise the experiment context. Update MODULE.md and related contracts after the decisions are settled.
