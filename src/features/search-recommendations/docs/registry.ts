import {
  searchQuerySchema,
  facetsQuerySchema,
  autocompleteQuerySchema,
  recommendationQuerySchema,
  searchResponseSchema,
  facetsResponseSchema,
  autocompleteResponseSchema,
  recommendationsResponseSchema,
} from "../schemas/contracts";
export const docsBase = "/docs/search-recommendations";
export const docPages = [
  {
    slug: "use-with-ai",
    title: "Use with your AI agent",
    group: "MCP & playground",
  },
  { slug: "mcp", title: "MCP overview", group: "MCP & playground" },
  { slug: "connect", title: "Connect your client", group: "MCP & playground" },
  {
    slug: "playground-guide",
    title: "Playground guide",
    group: "MCP & playground",
  },
  { slug: "playground", title: "Team playground", group: "MCP & playground" },
  { slug: "mcp-local", title: "Local MCP setup", group: "MCP & playground" },
  {
    slug: "mcp-troubleshooting",
    title: "MCP troubleshooting",
    group: "MCP & playground",
  },
  { slug: "", title: "Overview", group: "Getting started" },
  { slug: "quick-start", title: "Quick start", group: "Getting started" },
  {
    slug: "search",
    title: "Search",
    group: "API reference",
    path: "/api/v1/search",
  },
  {
    slug: "facets",
    title: "Facets",
    group: "API reference",
    path: "/api/v1/search/facets",
  },
  {
    slug: "autocomplete",
    title: "Autocomplete",
    group: "API reference",
    path: "/api/v1/search/autocomplete",
  },
  {
    slug: "similar",
    title: "Similar products",
    group: "API reference",
    path: "/api/v1/recommendations/similar",
  },
  {
    slug: "also-bought",
    title: "Also bought",
    group: "API reference",
    path: "/api/v1/recommendations/also-bought",
  },
  { slug: "data-flow", title: "Data flow", group: "Concepts" },
  { slug: "rules", title: "Search & ranking rules", group: "Concepts" },
  { slug: "teams", title: "Team responsibilities", group: "Integration" },
  { slug: "mock-data", title: "Mock data", group: "Integration" },
  {
    slug: "real-integration",
    title: "Real integration checklist",
    group: "Integration",
  },
  { slug: "types", title: "Shared types", group: "Reference" },
  { slug: "errors", title: "Errors", group: "Reference" },
  { slug: "openapi", title: "OpenAPI", group: "Reference" },
];
export type Parameter = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
  defaultValue?: string;
};
const query: Parameter = {
  name: "q",
  type: "string",
  description:
    "Trimmed; at most 200 characters and 20 terms. Empty allows browsing.",
  defaultValue: "empty",
};
const category: Parameter = {
  name: "category",
  type: "string",
  description: "Exact category name, 1–128 characters.",
};
const availability: Parameter = {
  name: "availability",
  type: "enum",
  description: "in_stock or out_of_stock. Omit to include both.",
};
const filters: Parameter[] = [
  query,
  category,
  {
    name: "sellerId",
    type: "string",
    description: "Exact seller identifier, 1–128 characters.",
  },
  availability,
  {
    name: "minPriceMinor",
    type: "integer",
    description: "Inclusive minimum, nonnegative safe integer in euro cents.",
  },
  {
    name: "maxPriceMinor",
    type: "integer",
    description: "Inclusive maximum; must be at least minPriceMinor.",
  },
];
const recommendation: Parameter[] = [
  {
    name: "productId",
    type: "string",
    required: true,
    description: "Active source product identifier, 1–128 characters.",
  },
  availability,
  {
    name: "limit",
    type: "integer",
    description: "1–20 items.",
    defaultValue: "5",
  },
];
export const sampleItem = {
  offerId: "off_1",
  productId: "prd_1",
  sellerId: "sel_2",
  name: "Wireless Mouse",
  category: "Electronics",
  imageUrls: [],
  priceMinor: 1999,
  currency: "EUR" as const,
  availability: "in_stock" as const,
};
export const endpointDefinitions = {
  search: {
    title: "Search",
    path: "/api/v1/search",
    description:
      "Find public products using text, filters, sorting, and pagination.",
    querySchema: searchQuerySchema,
    responseSchema: searchResponseSchema,
    parameters: [
      ...filters,
      {
        name: "sort",
        type: "enum",
        description: "relevance, price_asc, price_desc, or name_asc.",
        defaultValue: "relevance",
      },
      {
        name: "page",
        type: "integer",
        description:
          "Positive safe integer. Pages beyond the end return empty items.",
        defaultValue: "1",
      },
      {
        name: "pageSize",
        type: "integer",
        description: "1–100 items per page.",
        defaultValue: "20",
      },
    ],
    exampleQuery: "q=wireless",
    example: { data: { items: [sampleItem], total: 1, page: 1, pageSize: 20 } },
    empty: { data: { items: [], total: 0, page: 1, pageSize: 20 } },
    behavior:
      "Every query term must match. Visibility and filters apply before sorting and pagination. Active out-of-stock products are included by default.",
  },
  facets: {
    title: "Facets",
    path: "/api/v1/search/facets",
    description: "Get filter values, counts, and the available price range.",
    querySchema: facetsQuerySchema,
    responseSchema: facetsResponseSchema,
    parameters: filters,
    exampleQuery: "q=wireless",
    example: {
      data: {
        categories: [{ category: "Electronics", count: 1 }],
        sellers: [{ sellerId: "sel_2", count: 1 }],
        availability: [{ availability: "in_stock", count: 1 }],
        priceRange: { minPriceMinor: 1999, maxPriceMinor: 1999 },
      },
    },
    empty: {
      data: { categories: [], sellers: [], availability: [], priceRange: null },
    },
    behavior:
      "Each facet ignores its own filter and respects the others. The price range ignores both price bounds. Counts represent products, not purchases.",
  },
  autocomplete: {
    title: "Autocomplete",
    path: "/api/v1/search/autocomplete",
    description: "Suggest visible product names as customers type.",
    querySchema: autocompleteQuerySchema,
    responseSchema: autocompleteResponseSchema,
    parameters: [
      {
        ...query,
        required: true,
        defaultValue: undefined,
        description:
          "At least 2 characters; at most 200 characters and 20 terms. Normalized name prefix.",
      },
      category,
      availability,
      {
        name: "limit",
        type: "integer",
        description: "1–10 suggestions.",
        defaultValue: "5",
      },
    ],
    exampleQuery: "q=wire",
    example: {
      data: { suggestions: [{ productId: "prd_1", name: "Wireless Mouse" }] },
    },
    empty: { data: { suggestions: [] } },
    behavior:
      "Matches the start of the full normalized name. Results are alphabetical with product ID as a tie-breaker; query history is not stored.",
  },
  similar: {
    title: "Similar products",
    path: "/api/v1/recommendations/similar",
    description: "Find alternatives in the source product's category.",
    querySchema: recommendationQuerySchema,
    responseSchema: recommendationsResponseSchema,
    parameters: recommendation,
    exampleQuery: "productId=prd_1&limit=1",
    example: {
      data: {
        items: [
          {
            ...sampleItem,
            offerId: "off_5",
            productId: "prd_5",
            sellerId: "sel_3",
            name: "Desk Speaker",
            priceMinor: 2999,
          },
        ],
      },
    },
    empty: { data: { items: [] } },
    behavior:
      "Same category only. Rank by shared attribute pairs, then absolute price difference, then product ID. Exclude the source. Missing or hidden sources return 404.",
  },
  "also-bought": {
    title: "Also bought",
    path: "/api/v1/recommendations/also-bought",
    description:
      "Recommend products that occur together in synthetic purchase groups.",
    querySchema: recommendationQuerySchema,
    responseSchema: recommendationsResponseSchema,
    parameters: recommendation,
    exampleQuery: "productId=prd_1&limit=1",
    example: {
      data: {
        items: [
          {
            ...sampleItem,
            offerId: "off_2",
            productId: "prd_2",
            sellerId: "sel_3",
            name: "Quiet Mouse",
            priceMinor: 2999,
            availability: "out_of_stock",
          },
        ],
      },
    },
    empty: { data: { items: [] } },
    behavior:
      "Count each pair once per purchase, then sort by count descending and product ID. No history means no results. Similarity and popularity are never substituted. Purchase data is synthetic.",
  },
};
export type EndpointKey = keyof typeof endpointDefinitions;
export function isEndpointKey(value: string): value is EndpointKey {
  return Object.hasOwn(endpointDefinitions, value);
}
