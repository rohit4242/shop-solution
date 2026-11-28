// Marketing's developer docs under /docs/marketing (same structure as the other teams' docs).
export const docsBase = "/docs/marketing";

export type DocPage = {
  slug: string;
  title: string;
  group: string;
  method?: string;
  path?: string;
};

export const docPages: DocPage[] = [
  { slug: "", title: "Overview", group: "Getting started" },
  { slug: "quick-start", title: "Quick start", group: "Getting started" },
  {
    slug: "active-promotions",
    title: "Active promotions",
    group: "API reference",
    method: "GET",
    path: "/api/v1/marketing/promotions/active",
  },
  {
    slug: "validate",
    title: "Validate a cart",
    group: "API reference",
    method: "POST",
    path: "/api/v1/marketing/discounts/validate",
  },
  {
    slug: "promotions",
    title: "Manage promotions",
    group: "API reference",
    method: "API",
    path: "/api/v1/marketing/promotions",
  },
  { slug: "rules", title: "Discount rules", group: "Concepts" },
  { slug: "money", title: "Money and IDs", group: "Concepts" },
  { slug: "checkout", title: "Checkout hand-over", group: "Integration" },
  { slug: "teams", title: "Team responsibilities", group: "Integration" },
  { slug: "use-with-ai", title: "Use with your AI agent", group: "MCP" },
  { slug: "errors", title: "Errors", group: "Reference" },
  { slug: "openapi", title: "OpenAPI", group: "Reference" },
];
