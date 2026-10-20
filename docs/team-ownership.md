# Team ownership proposal

| Feature                  | Responsibility                                                                |
| ------------------------ | ----------------------------------------------------------------------------- |
| `accounting`             | Invoices, VAT calculation, refund bookkeeping, financial exports.             |
| `admin-identity`         | Accounts, authentication, permissions, admin back office and catalog editing. |
| `crm`                    | Customer profiles, contact history, segmentation and lifecycle.               |
| `logistics`              | Shipping methods, carrier integration, shipments and tracking.                |
| `marketing`              | Campaigns, newsletters, discounts and promotional pages.                      |
| `marketplace`            | Seller onboarding, commissions and seller dashboards.                         |
| `storefront`             | Shop navigation, product presentation and cart UI.                            |
| `search-recommendations` | Search, filters, autocomplete and recommendations.                            |
| `reviews-ratings`        | Reviews, ratings, moderation and verified-purchase checks.                    |
| `analytics-reporting`    | Revenue, conversion, product and stock reporting.                             |

Unassigned core responsibilities: orders, checkout, payment processing and inventory. Assign named owners and maintainers before implementing them. Each feature README records its eventual contracts and data ownership. Shared infrastructure needs designated class maintainers; no individual is assigned yet.
