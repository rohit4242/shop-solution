# Team ownership proposal

| Feature                                                                      | Responsibility                                                                |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| [Accounting](../src/features/accounting/README.md)                           | Invoices, VAT calculation, refund bookkeeping, financial exports.             |
| [Admin & Identity](../src/features/admin-identity/README.md)                 | Accounts, authentication, permissions, admin back office and catalog editing. |
| [CRM](../src/features/crm/README.md)                                         | Customer profiles, contact history, segmentation and lifecycle.               |
| [Logistics](../src/features/logistics/README.md)                             | Shipping methods, carrier integration, shipments and tracking.                |
| [Marketing](../src/features/marketing/README.md)                             | Campaigns, newsletters, discounts and promotional pages.                      |
| [Marketplace](../src/features/marketplace/README.md)                         | Seller onboarding, commissions and seller dashboards.                         |
| [Storefront](../src/features/storefront/README.md)                           | Shop navigation, product presentation and cart UI.                            |
| [Search & Recommendations](../src/features/search-recommendations/README.md) | Search, filters, autocomplete and recommendations.                            |
| [Reviews & Ratings](../src/features/reviews-ratings/README.md)               | Reviews, ratings, moderation and verified-purchase checks.                    |
| [Analytics & Reporting](../src/features/analytics-reporting/README.md)       | Revenue, conversion, product and stock reporting.                             |

Unassigned core responsibilities: orders, checkout, payment processing and inventory. Assign named owners and maintainers before implementing them. Each feature README records its eventual contracts and data ownership. Shared infrastructure needs designated class maintainers; no individual is assigned yet.
