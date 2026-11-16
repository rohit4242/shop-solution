# Search & Recommendations UI specification

## Purpose and users

This interface helps Storefront developers and other API integrators understand and test the Search & Recommendations API. It is a developer-facing documentation site and request explorer, not the customer-facing shop search experience; Storefront owns that UI.

## Scope and integration assumptions

- The interface lives in the shared Next.js application at `/docs/search-recommendations`.
- The request explorer calls the same-origin Search & Recommendations API, which currently serves mock catalog and synthetic purchase data.
- The five anonymous `GET` operations in the Session 5 contract are the only product-data source for request results. Do not add product fields or filters outside that contract.
- The OpenAPI document describes those five operations and is available at `/docs/search-recommendations/openapi.json`.
- No login is required for these public API operations. The separate team/model playground is not part of this spec because its configuration, unlock, and run endpoints are not in the Session 5 API contract.

## User journeys

### 1. Find and test a product search

1. An integrator opens the Search & Recommendations documentation and chooses **Search**.
2. They review the supported query parameters and example request.
3. They edit the request using only the parameters documented for `GET /api/v1/search` and choose **Run request**.
4. They inspect the HTTP status and JSON response, including the returned item fields and pagination values.
5. If they need available filter values, they open **Facets** and run `GET /api/v1/search/facets` with supported filters. If they need name suggestions, they open **Autocomplete** and run `GET /api/v1/search/autocomplete`.

### 2. Check product recommendations

1. An integrator obtains a `productId` from a search result or the documented example.
2. They open **Similar products**, enter the source `productId`, optionally choose `availability` and `limit`, and run `GET /api/v1/recommendations/similar`.
3. They open **Also bought**, reuse the `productId`, and run `GET /api/v1/recommendations/also-bought`.
4. They distinguish a successful empty `items` list from an API error; the UI must not replace missing purchase evidence with similar-product results.

## Screens and content

### Documentation overview — `/docs/search-recommendations`

- Global breadcrumb links to **Shop Solution** and **Docs**.
- Search & Recommendations navigation with links to the API reference pages.
- Overview text stating that the API is mock-backed and that no token is required.
- API cards for Search, Facets, Autocomplete, Similar products, and Also bought.
- OpenAPI link to `/docs/search-recommendations/openapi.json`.
- Each API card is a link to its reference page; it does not issue a data request itself.

### API reference and request explorer

The reference page documents the operation, allowed query parameters, defaults and limits, an example request, success and empty response shapes, error codes, and behavior. The request explorer contains:

- A **Query parameters** editor prefilled with that endpoint's example query. Only that endpoint's contract parameters may be submitted.
- A **Run request** button, disabled while a request is in progress.
- A visible HTTP status and formatted JSON response.
- A status/error announcement for loading and request failures.

The query parameter editor maps to the following operations. Optional parameters may be omitted; omitted values use the API defaults and behavior in the contract.

| Reference page   | Operation and editor fields                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Search           | `GET /api/v1/search`: `q`, `category`, `sellerId`, `availability`, `minPriceMinor`, `maxPriceMinor`, `sort`, `page`, `pageSize` |
| Facets           | `GET /api/v1/search/facets`: `q`, `category`, `sellerId`, `availability`, `minPriceMinor`, `maxPriceMinor`                      |
| Autocomplete     | `GET /api/v1/search/autocomplete`: `q`, `category`, `availability`, `limit`                                                     |
| Similar products | `GET /api/v1/recommendations/similar`: required `productId`, optional `availability`, `limit`                                   |
| Also bought      | `GET /api/v1/recommendations/also-bought`: required `productId`, optional `availability`, `limit`                               |

The response view displays the complete JSON envelope from the selected operation. Search results contain `items`, `total`, `page`, and `pageSize`; facets contain categories, sellers, availability counts, and `priceRange`; autocomplete contains `suggestions`; recommendations contain `items`. Product items show only fields returned by the contract: `offerId`, `productId`, `sellerId`, `name`, `category`, `imageUrls`, `priceMinor`, `currency`, and `availability`.

## API mapping and validation

| Element                               | Contract mapping and constraints                                                                                                                                     |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search query `q`                      | Search, Facets, or Autocomplete `q`; trimmed, at most 200 characters and 20 terms. Autocomplete additionally requires at least 2 characters.                         |
| Search filters `category`, `sellerId` | Search and Facets; exact string values, 1–128 characters. `category` is also supported by Autocomplete.                                                              |
| Availability                          | `availability` on all five operations; `in_stock` or `out_of_stock`. Omit to include both.                                                                           |
| Price bounds                          | Search and Facets `minPriceMinor` / `maxPriceMinor`; nonnegative safe integer decimal digits in EUR cents; bounds are inclusive and minimum must not exceed maximum. |
| Search sort and pagination            | Search `sort`: `relevance`, `price_asc`, `price_desc`, or `name_asc`; `page` defaults to 1; `pageSize` defaults to 20 and is 1–100.                                  |
| Autocomplete limit                    | Autocomplete `limit` defaults to 5 and is 1–10.                                                                                                                      |
| Recommendation source and limit       | Similar / Also bought `productId` is required and must be 1–128 characters; `limit` defaults to 5 and is 1–20.                                                       |
| Run request and response              | Submits exactly one of the five `GET` operations above. Success is `{ "data": ... }`; failure is `{ "error": { "code": "...", "message": "..." } }`.                 |
| Authentication                        | None of the five operations has an authentication field or requires a token. Do not add a login form to these pages.                                                 |

Unknown and repeated query parameters are rejected. Integer query parameters must contain decimal digits only. No UI control may submit parameters not listed for its endpoint.

## States

| Screen / state                               | Expected behavior                                                                                                                                                                    |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentation overview loading               | Keep the global navigation and provide a perceivable loading status until the page content is available.                                                                             |
| Documentation overview success               | Show all five API links, mock-data notice, and OpenAPI link.                                                                                                                         |
| Documentation overview error                 | If documentation cannot load, show a clear retry instruction; do not imply the API itself is unavailable.                                                                            |
| Reference page loading                       | Keep navigation usable and announce that the selected reference is loading.                                                                                                          |
| Reference page success                       | Show the operation, supported parameters, examples, response shapes, error table, and request explorer.                                                                              |
| Request idle                                 | Show the example query and **Run request**. Do not send a request until explicitly submitted.                                                                                        |
| Request loading                              | Disable repeat submission and announce **Loading…**.                                                                                                                                 |
| Search / Facets / Autocomplete empty success | Show the 200 response as an empty result: `items: []`, empty facet arrays (and nullable `priceRange` where applicable), or `suggestions: []`. State that no matches is not an error. |
| Recommendations empty success                | Show `{ "data": { "items": [] } }` as a successful response; do not fabricate fallback recommendations.                                                                              |
| Request success with results                 | Show the HTTP status and the formatted response returned by the selected operation.                                                                                                  |
| Invalid input (400)                          | Show the API's exact `message`; identify the relevant parameter using the endpoint documentation where possible.                                                                     |
| Missing or non-public source product (404)   | For recommendation operations, show the API's exact `message`: `Product not found.`                                                                                                  |
| Catalog unavailable (503)                    | Show the API's exact `message`: `Catalog data is temporarily unavailable.` Provide a retry action.                                                                                   |
| Purchase data unavailable (503)              | For Also bought, show the API's exact `message`: `Purchase data is temporarily unavailable.` Provide a retry action; do not display this as an empty result.                         |
| Unexpected API failure (500)                 | Show the API's exact `message`: `An unexpected error occurred.` Do not expose internal details.                                                                                      |
| Network failure or timeout                   | Show `Request failed or timed out. Check that the application is running and try again.` Allow the user to retry.                                                                    |
| Permission state                             | Not applicable: these five operations are public and require no login.                                                                                                               |
| Service down                                 | Keep documentation content available when possible; show the network failure state when a request cannot reach the API.                                                              |

For `INVALID_INPUT`, the standard schema-validation message is `Invalid query parameters. See the endpoint documentation.` Repeated parameters have the specific message `Repeated query parameters are not allowed.` The response's exact API message is authoritative and should not be rewritten.

## Accessibility

- All links, inputs, buttons, and navigation controls are keyboard reachable and have visible focus.
- Provide a skip link to the main documentation content.
- Give each input a persistent label; placeholder text is not a label.
- Use semantic headings, navigation landmarks, table headers, and lists.
- Announce loading and request status with a live status message. Announce errors through an alert or equivalent accessible error region.
- Do not communicate availability, errors, or selection by color alone; include text and the HTTP status/code.
- Preserve keyboard operation for mobile navigation and allow users to close it and return focus to its trigger.
- Keep response JSON selectable and readable at narrow widths; do not require horizontal scrolling to operate the request form.

## Acceptance criteria

- **Given** a user opens the documentation overview, **when** it loads, **then** all five contracted API operations and the OpenAPI document are reachable by keyboard.
- **Given** a user submits a valid Search request, **when** the API returns 200, **then** the UI displays the returned envelope and pagination fields without inventing fields.
- **Given** a valid query with no matching products, **when** the API returns an empty 200 response, **then** the UI presents it as a successful empty state, not as an error.
- **Given** a user submits unknown, repeated, malformed, or incompatible parameters, **when** the API returns 400, **then** the UI shows the exact returned error message and permits correction and retry.
- **Given** a user requests recommendations for an unknown or non-public product, **when** the API returns 404, **then** the UI shows `Product not found.` and does not show fabricated recommendations.
- **Given** the catalog or purchase provider is unavailable, **when** the API returns its 503 error, **then** the UI displays the exact returned message and distinguishes the failure from an empty successful result.
- **Given** a user runs a request, **when** the request is pending, **then** the UI announces loading and prevents duplicate submission until it completes or fails.
- **Given** a user navigates with a keyboard or screen reader, **when** they move through the docs, request form, status, and response, **then** controls have labels, focus is visible, and status/error information is available without relying on color.
- **Given** a user opens the recommendations reference, **when** they run Also bought and the API returns no purchase evidence, **then** the UI shows an empty successful `items` array without substituting Similar results.

## Navigation between modules

- Link the documentation breadcrumb to the shared **Docs** hub and the application home.
- Keep Search & Recommendations navigation within its documentation routes.
- Storefront consumes these APIs, but this module does not invent a Storefront route. Add a cross-module link only when Storefront publishes and agrees on its destination.

## Out of scope

- Customer-facing product listing, product detail, cart, checkout, or order journeys.
- Catalog editing, seller administration, stock changes, authentication, and authorization workflows.
- Any API operation, query parameter, or response field not present in the Session 5 contract.
- Real Marketplace catalog synchronization or real purchase history; current responses are mock-backed.
- The model playground, MCP setup flows, and their separate configuration or run APIs.
