import { McpDocsContent, mcpDocSlugs } from "./mcp-docs-content";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
import { endpointDefinitions, docsBase, isEndpointKey } from "../docs/registry";
import { CodeBlock, CodeExamples } from "./code-examples";
import { RequestExplorer } from "./request-explorer";
import { displayOrigin } from "../server/origin";
// The deployed address on Vercel, localhost in development.
const baseUrl = () => displayOrigin() ?? "http://localhost:3000";
const json = (value: unknown) => JSON.stringify(value, null, 2);
const linkClass = "underline underline-offset-4 hover:text-muted-foreground";
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}
function Table({
  headers,
  rows,
}: {
  headers: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted/50">
          <tr>
            {headers.map((h) => (
              <th scope="col" key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 align-top leading-6">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function DocsContent({ slug }: { slug: string }) {
  if (mcpDocSlugs.includes(slug)) return <McpDocsContent slug={slug} />;
  if (isEndpointKey(slug)) {
    const e = endpointDefinitions[slug],
      url = e.path + "?" + e.exampleQuery;
    return (
      <div className="space-y-10">
        <p className="flex flex-wrap items-center gap-3">
          <span className="rounded border px-2 py-1 text-xs font-semibold">
            GET
          </span>
          <code className="break-all text-sm">{e.path}</code>
        </p>
        <p className="leading-7 text-muted-foreground">
          {e.description} Public endpoint; no authentication required.
        </p>
        <Section title="Query parameters">
          <p className="text-sm text-muted-foreground">
            Unknown and repeated parameters are rejected. Integer values must
            contain decimal digits only. Every response uses Cache-Control:
            no-store.
          </p>
          <Table
            headers={["Parameter", "Type", "Required / default", "Description"]}
            rows={e.parameters.map((p) => [
              <code key={p.name}>{p.name}</code>,
              p.type,
              p.required ? "Required" : (p.defaultValue ?? "Optional"),
              p.description,
            ])}
          />
        </Section>
        <Section title="Request">
          <CodeExamples
            examples={[
              {
                label: "cURL",
                code: `curl --get '${baseUrl()}${url}'`,
              },
              {
                label: "JavaScript",
                code: `const response = await fetch('${url}');
const result = await response.json();
if (!response.ok) throw new Error(result.error.message);
console.log(result.data);`,
              },
            ]}
          />
        </Section>
        <Section title="Response">
          <CodeExamples
            examples={[
              { label: "200 Success", code: json(e.example) },
              { label: "200 Empty", code: json(e.empty) },
              {
                label: "400 Error",
                code: json({
                  error: {
                    code: "INVALID_INPUT",
                    message:
                      "Invalid query parameters. See the endpoint documentation.",
                  },
                }),
              },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Empty examples illustrate the response shape when no matches exist;
            the request above uses populated fixtures. See{" "}
            <Link className={linkClass} href={`${docsBase}/types`}>
              shared types
            </Link>{" "}
            and{" "}
            <Link className={linkClass} href={`${docsBase}/errors`}>
              all error codes
            </Link>
            .
          </p>
        </Section>
        <Section title="Behavior">
          <p className="leading-7 text-muted-foreground">{e.behavior}</p>
        </Section>
        <Section title="Try request">
          <RequestExplorer path={e.path} exampleQuery={e.exampleQuery} />
        </Section>
      </div>
    );
  }
  switch (slug) {
    case "":
      return (
        <div className="space-y-10">
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Search products, explore filters, and recommend related items
            through five small, predictable APIs.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6">
            <strong>Mock-backed release.</strong> All endpoints work with
            synthetic fixtures. Marketplace integration and real purchase data
            are not connected.
          </div>
          <Section title="Server">
            <CodeBlock code={baseUrl()} />
            <p className="text-sm text-muted-foreground">
              No token is needed. When you run the repository yourself with pnpm
              dev, use http://localhost:3000 instead.
            </p>
            <Link className={linkClass} href={`${docsBase}/quick-start`}>
              Make your first request →
            </Link>
          </Section>
          <Section title="API reference">
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(endpointDefinitions).map(([key, e]) => (
                <Link
                  href={`${docsBase}/${key}`}
                  key={key}
                  className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full shadow-none hover:bg-muted/40">
                    <CardHeader>
                      <p className="mb-3 text-xs text-muted-foreground">
                        <span className="mr-2 rounded border px-1 font-semibold text-foreground">
                          GET
                        </span>
                        {e.path}
                      </p>
                      <CardTitle>{e.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="leading-6">
                        {e.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </Section>
          <Section title="What we own">
            <p className="leading-7 text-muted-foreground">
              Search, filters, facets, autocomplete, and recommendation APIs.
              Storefront owns the shopping UI. We maintain a derived in-memory
              catalog, not canonical product or order tables.
            </p>
          </Section>
        </div>
      );
    case "quick-start":
      return (
        <div className="space-y-8">
          <Section title="1. Pick a server">
            <p>
              The examples below call {baseUrl()}. To run the API yourself,
              install the repository’s pinned dependencies and run the command
              below, then use http://localhost:3000.
            </p>
            <CodeBlock code="pnpm dev" />
            <p className="text-sm text-muted-foreground">
              Search itself uses no database. The wider app still has its own
              Prisma and auth setup.
            </p>
          </Section>
          <Section title="2. Search the mock catalog">
            <CodeBlock code={`curl '${baseUrl()}/api/v1/search?q=wireless'`} />
            <p>
              The response contains Wireless Mouse, product ID prd_1. No token
              is required.
            </p>
          </Section>
          <Section title="3. Request recommendations">
            <CodeBlock
              code={`curl '${baseUrl()}/api/v1/recommendations/also-bought?productId=prd_1'`}
            />
            <p>
              These results come from synthetic grouped purchases, not actual
              customer behavior.
            </p>
          </Section>
          <Section title="4. Integrate safely">
            <p>
              Handle non-2xx responses, render empty results, retain returned
              product and offer IDs, and format priceMinor / 100 as EUR. Prices
              include VAT and exclude Marketing discounts.
            </p>
          </Section>
        </div>
      );
    case "data-flow":
      return (
        <div className="space-y-8">
          <Section title="Catalog request flow">
            <ol className="list-decimal space-y-3 pl-5">
              <li>
                Marketplace-shaped mock provider loads offers with embedded
                product details.
              </li>
              <li>
                Zod validates every record, unique IDs, and the 10,000-record
                limit.
              </li>
              <li>An immutable snapshot retains active offers only.</li>
              <li>
                Our services apply matching, filters, ranking, and public-field
                projection.
              </li>
              <li>Storefront consumes JSON and owns presentation.</li>
            </ol>
            <CodeBlock
              code="Marketplace → provider → validation → snapshot → APIs → Storefront
Synthetic purchase groups → validation → also-bought service"
            />
          </Section>
          <Section title="Snapshot lifecycle">
            <p>
              Initialization happens once per process, shared by concurrent
              requests. Failed loads can retry. The validated snapshot is
              published atomically and remains unchanged until restart. There is
              no polling, webhook ingestion, or persistent synchronization yet.
            </p>
          </Section>
        </div>
      );
    case "rules":
      return (
        <div className="space-y-8">
          <Section title="Visibility and prices">
            <p>
              Only active offers are public. Pending, rejected, blocked, and
              removed records never appear. Out-of-stock products remain visible
              by default. Prices are VAT-inclusive seller prices before
              Marketing discounts.
            </p>
          </Section>
          <Section title="Text ranking">
            <p>
              Lowercase and remove combining accents, then tokenize Unicode
              letters and digits. Each query term must occur within a field
              token. Use the highest matching field weight per term: name 4,
              category 2, attribute keys/values 2, description 1. Add 10 for an
              exact normalized full name. Relevance ties use normalized name
              then product ID.
            </p>
            <p>
              Empty queries browse alphabetically. Punctuation-only queries
              return no matches. There is no fuzzy, semantic, or personalized
              search.
            </p>
          </Section>
          <Section title="Filters and facets">
            <p>
              Category and seller matching are exact. Price bounds are
              inclusive. Each facet ignores its own filter; price range ignores
              both price bounds. All facets still respect the query and public
              visibility.
            </p>
          </Section>
          <Section title="Recommendations">
            <p>
              Similar products share a category and rank by matching attribute
              pairs, price proximity, then product ID. Also-bought uses pair
              frequency across synthetic purchases; each purchase contributes
              once per pair. It returns no results without supporting data.
            </p>
          </Section>
        </div>
      );
    case "teams":
      return (
        <div className="space-y-8">
          <Table
            headers={["Team", "Exchange", "Status"]}
            rows={[
              [
                "Marketplace",
                "We receive product details, seller/offer IDs, price, availability, and offer moderation status.",
                "Marketplace clarified ownership; final API wire spec and joint acknowledgment pending.",
              ],
              [
                "Storefront",
                "We provide search, facets, suggestions, and recommendation results.",
                "Implemented local API; consumer review pending.",
              ],
              [
                "Admin & Identity",
                "Identity and moderation coordination. No separate catalog join in this mock model.",
                "Admin acknowledgment of latest Marketplace clarification pending.",
              ],
              [
                "Purchase-data owner",
                "We need qualifying grouped product IDs for co-purchases.",
                "Owner unconfirmed; synthetic provider only.",
              ],
              [
                "Marketing",
                "Final discount handling is separate from seller price.",
                "No discount integration implemented.",
              ],
            ]}
          />
          <p>
            These notes record partner messages and implementation assumptions.
            They do not reassign repository-wide ownership or replace required
            cross-group review.
          </p>
        </div>
      );
    case "mock-data":
      return (
        <div className="space-y-8">
          <Section title="Reproducible fixtures">
            <p>
              24 offers across Electronics, Home, Clothing, and Outdoors, with
              three sellers. Twenty are active; four cover pending, rejected,
              blocked, and removed states. Fixtures include out-of-stock items,
              a zero price, matching attributes, and an accented name.
            </p>
          </Section>
          <Table
            headers={["Example", "Identifier", "Use"]}
            rows={[
              ["Wireless Mouse", "prd_1", "Search and recommendations"],
              ["Café Cup", "prd_7", "Accent-normalized search"],
              ["Running Belt", "prd_24", "Zero price and no purchase history"],
              [
                "Travel Charger",
                "prd_6",
                "Hidden product; recommendation source returns 404",
              ],
            ]}
          />
          <Section title="Synthetic purchases">
            <p>
              Three synthetic groups link prd_1 with prd_2/prd_4 and prd_7 with
              prd_8. No real users, account records, or orders are stored.
              Missing history produces empty results.
            </p>
          </Section>
          <Section title="Local assumptions">
            <p>
              EUR only, string-valued attributes, empty image lists allowed, and
              one offer per product. These constraints are validated rather than
              silently coerced.
            </p>
          </Section>
        </div>
      );
    case "real-integration":
      return (
        <div className="space-y-8">
          <Section title="Before connecting Marketplace">
            <ul className="list-disc space-y-3 pl-5">
              <li>
                Confirm final URL, authentication, response envelope, full-load
                endpoint, and pagination.
              </li>
              <li>
                Agree updatedSince precision, ordering, duplicates, tombstones,
                and retry behavior.
              </li>
              <li>
                Confirm attribute types, currencies, category representation,
                and one-offer cardinality.
              </li>
              <li>
                Obtain Admin acknowledgment and affected-team contract review.
              </li>
            </ul>
          </Section>
          <Section title="Before using real purchases">
            <p>
              Identify the actual owner and agree which purchases qualify,
              cancellation/refund handling, grouping, update semantics, and data
              minimization. Do not assume Accounting or Storefront owns this
              feed.
            </p>
          </Section>
          <Section title="Adapter boundary">
            <CodeBlock
              code="interface OfferSource {
  loadOffers(): Promise<unknown>;
}
interface PurchaseSource {
  loadPurchaseGroups(): Promise<unknown>;
}"
            />
            <p>
              Replace the mock provider at server composition after agreement.
              Live incremental synchronization, persistent checkpoints, and
              scheduling require a separate design. No automatic mock fallback
              is implemented.
            </p>
          </Section>
        </div>
      );
    case "types":
      return (
        <div className="space-y-8">
          <Section title="DiscoveryItem">
            <CodeBlock
              code={`type DiscoveryItem = {
  offerId: string;
  productId: string;
  sellerId: string;
  name: string;
  category: string;
  imageUrls: string[]; // HTTP(S) URLs
  priceMinor: number; // safe nonnegative integer
  currency: "EUR";
  availability: "in_stock" | "out_of_stock";
};`}
            />
          </Section>
          <Section title="Other response types">
            <p>
              Autocomplete returns productId and name. Facets return
              category/count, sellerId/count, availability/count lists, plus a
              nullable minPriceMinor/maxPriceMinor range. Search includes total,
              page, and pageSize; recommendation responses include items.
            </p>
            <p>
              Public responses omit source moderation details, attributes,
              purchase identifiers, user data, and internal scores.
            </p>
          </Section>
          <Section title="Marketplace-shaped input">
            <CodeBlock
              code={`type MarketplaceOffer = DiscoveryItem & {
  description: string;
  attributes: Record<string, string>;
  status: "active" | "pending" | "rejected" | "blocked" | "removed";
  updatedAt: string; // ISO timestamp with timezone
};`}
            />
            <p>
              Input IDs are stable opaque strings, 1–128 characters. Duplicate
              product or offer IDs reject the load.
            </p>
          </Section>
        </div>
      );
    case "errors":
      return (
        <div className="space-y-8">
          <CodeBlock
            code={json({
              error: {
                code: "INVALID_INPUT",
                message:
                  "Invalid query parameters. See the endpoint documentation.",
              },
            })}
          />
          <Table
            headers={["HTTP", "Code", "Meaning"]}
            rows={[
              [
                "400",
                "INVALID_INPUT",
                "Unknown, repeated, malformed, or incompatible parameters.",
              ],
              [
                "404",
                "PRODUCT_NOT_FOUND",
                "Recommendation source is missing or not public.",
              ],
              [
                "503",
                "CATALOG_UNAVAILABLE",
                "Catalog loading or validation failed; retry later.",
              ],
              [
                "503",
                "RECOMMENDATION_DATA_UNAVAILABLE",
                "Purchase loading or validation failed; retry later.",
              ],
              [
                "500",
                "INTERNAL_ERROR",
                "Unexpected failure; internal details are not returned.",
              ],
            ]}
          />
          <p>
            No matches is a successful 200 response with empty results, not a
            service error. All responses disable caching.
          </p>
        </div>
      );
    case "openapi":
      return (
        <div className="space-y-8">
          <p>
            The OpenAPI 3.1 document describes all five endpoints. Request and
            response schemas are derived from the same Zod schemas used by the
            module.
          </p>
          <a
            className={linkClass}
            href={`${docsBase}/openapi.json`}
            download="search-recommendations.openapi.json"
          >
            Download OpenAPI JSON
          </a>
          <p className="text-sm text-muted-foreground">
            Custom rules such as duplicate query rejection and cross-field price
            bounds are described in prose; JSON Schema cannot express every HTTP
            parsing rule.
          </p>
        </div>
      );
    default:
      return null;
  }
}
