# Marketing: start here

Our team owns campaigns, newsletters, discounts and promotional pages for the shop ([team directory](../team-ownership.md)). Today shop-solution has automatic promotions (create, change, deactivate, list) and the discount check that Storefront calls at checkout. Other teams use us through a small HTTP API, and AI agents use the same operations through an MCP server.

## What's where

| You want to…                            | Go to                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Manage promotions in the back office    | `/marketing/promotions` on the running site (marketing-manager login)                                       |
| Call the API                            | [Public contract](../../src/features/marketing/README.md#public-contract) in the feature README             |
| Read the machine-readable contract      | [marketing.yaml](marketing.yaml) (OpenAPI 3.1) and its [changelog](CHANGELOG.md)                            |
| Connect an AI agent over MCP            | [mcp.md](mcp.md)                                                                                            |
| Run it locally                          | [Run locally](../../src/features/marketing/README.md#run-locally) in the feature README                     |
| Read or change the code                 | [src/features/marketing](../../src/features/marketing/README.md)                                            |
| Check which tables Marketing writes     | [Data and integrations](../../src/features/marketing/README.md#data-and-integrations) in the feature README |
| Run the module, system and agent tests  | [Verification](../../src/features/marketing/README.md#verification) in the feature README                   |
| See our session 8 exercise (tested ERP) | [exercises/session-8-finished-erp](exercises/session-8-finished-erp/README.md)                              |

## For the partner teams

- **Storefront** shows the promotions that apply now with `GET /api/v1/marketing/promotions/active` and asks for a cart's discount at checkout with `POST /api/v1/marketing/discounts/validate`. Both are public. One discount applies per cart; the biggest wins.
- **Accounting** needs the discount for the invoice. The proposal is that checkout stores it with the order in the shared `order_discount` tables and Accounting reads it there. Who sends `order.placed`, how those routes are protected and how the invoice reads the discount are still to agree with Storefront and Accounting ([Checkout hand-over](../../src/features/marketing/README.md#checkout-hand-over-to-agree-with-storefront-and-accounting)).
- Money on the wire is a decimal with 2 places plus `currency` (`59.90`, `"EUR"`). The database keeps minor units; Marketing converts exactly.
