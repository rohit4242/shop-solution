import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { docPages, docsBase } from "../../docs/navigation";
import { docsOrigin } from "../../server/docs";
import { CodeBlock, CodeExamples } from "./code-examples";

// Marketing's developer docs. Everything here follows src/features/marketing/api/openapi.yaml.

const api = "/api/v1/marketing";
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

function Endpoint({ method, path }: { method: string; path: string }) {
  return (
    <p className="flex flex-wrap items-center gap-3">
      <span className="rounded border px-2 py-1 text-xs font-semibold">
        {method}
      </span>
      <code className="break-all text-sm">{path}</code>
    </p>
  );
}

const m1Promotion = {
  promotionId: "cmih3x0q50000ab12cd34ef56",
  name: "M1 10 %",
  description: "10 % off the wireless mouse M1",
  type: "percent",
  value: 10,
  productIds: ["M1"],
  categoryIds: [],
  validFrom: "2026-12-01T00:00:00.000Z",
  validTo: "2026-12-31T22:59:59.000Z",
};

const validateRequest = {
  currency: "EUR",
  items: [
    { productId: "M1", unitPrice: 59.9, quantity: 1 },
    { productId: "M2", unitPrice: 20, quantity: 1 },
  ],
};

const validateResult = {
  valid: true,
  discountTotal: 5.99,
  currency: "EUR",
  campaignId: null,
  appliedBy: "promotion",
  promotionId: m1Promotion.promotionId,
  items: [
    { productId: "M1", discount: 5.99 },
    { productId: "M2", discount: 0 },
  ],
};

const errorExample = {
  error: {
    code: "invalid_input",
    message: "The request is not valid.",
    fieldErrors: { name: ["Enter a name."] },
  },
};

export function DocsContent({ slug }: { slug: string }) {
  const origin = docsOrigin();
  switch (slug) {
    case "":
      return (
        <div className="space-y-10">
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Automatic promotions for the shop, and the discount check Storefront
            calls at checkout. One discount per cart; the biggest wins.
          </p>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6">
            <strong>Current release (0.4.0).</strong> Promotion management and
            discount validation on the shared shop database. How checkout stores
            the applied discount and how the invoice reads it is being agreed
            with Storefront and Accounting.
          </div>
          <Section title="Server">
            <CodeBlock code={`${origin}${api}`} />
            <p className="text-sm text-muted-foreground">
              The public operations need no token. When you run the repository
              yourself with pnpm dev, use http://localhost:3000.
            </p>
            <Link className={linkClass} href={`${docsBase}/quick-start`}>
              Make your first request →
            </Link>
          </Section>
          <Section title="API reference">
            <div className="grid gap-4 md:grid-cols-2">
              {docPages
                .filter((p) => p.path)
                .map((p) => (
                  <Link
                    href={`${docsBase}/${p.slug}`}
                    key={p.slug}
                    className="rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Card className="h-full shadow-none hover:bg-muted/40">
                      <CardHeader>
                        <p className="mb-3 text-xs text-muted-foreground">
                          <span className="mr-2 rounded border px-1 font-semibold text-foreground">
                            {p.method}
                          </span>
                          {p.path}
                        </p>
                        <CardTitle>{p.title}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <CardDescription className="leading-6">
                          {
                            {
                              "active-promotions":
                                "Promotions that apply right now, for Storefront to show. Public.",
                              validate:
                                "The discount a cart gets at checkout, per line. Public and read-only.",
                              promotions:
                                "Create, change, list and deactivate promotions. Marketing managers only.",
                            }[p.slug]
                          }
                        </CardDescription>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
            </div>
          </Section>
          <Section title="What we own">
            <p className="leading-7 text-muted-foreground">
              Promotions and their rules: which products or categories they
              cover, the period, and which discount wins. Marketing writes the
              shared <code>promotion</code>, <code>promotion_product</code> and{" "}
              <code>promotion_category</code> tables. Checkout owns the order
              and stores the applied discount with it.
            </p>
          </Section>
        </div>
      );

    case "quick-start":
      return (
        <div className="space-y-8">
          <Section title="1. Pick a server">
            <p>
              The examples call {origin}. To run the API yourself, install the
              repository’s dependencies, apply the migrations to a local
              database and start the app.
            </p>
            <CodeBlock code="pnpm install && pnpm db:deploy && pnpm dev" />
          </Section>
          <Section title="2. List the promotions that apply now">
            <CodeBlock code={`curl '${origin}${api}/promotions/active'`} />
            <p>
              An empty list means no promotion is active. No token is required.
            </p>
          </Section>
          <Section title="3. Ask for a cart’s discount">
            <CodeBlock
              code={`curl -X POST '${origin}${api}/discounts/validate' \\
  -H 'content-type: application/json' \\
  -d '${JSON.stringify(validateRequest)}'`}
            />
            <p>
              With a 10 % promotion on M1, the M1 line gets 5.99 off 59.90 and
              the M2 line gets 0.
            </p>
          </Section>
          <Section title="4. Integrate safely">
            <p>
              Handle non-2xx responses, apply only the one discount returned,
              and show each line’s discount as returned. Do not recalculate:
              lines are rounded half up to cents before they are summed.
            </p>
          </Section>
        </div>
      );

    case "active-promotions":
      return (
        <div className="space-y-10">
          <Endpoint method="GET" path={`${api}/promotions/active`} />
          <p className="leading-7 text-muted-foreground">
            Automatic promotions that are active and inside their period right
            now (the end time is inclusive), latest start first. Public; no
            login. Sent with Cache-Control: no-store.
          </p>
          <Section title="Request">
            <CodeExamples
              examples={[
                {
                  label: "cURL",
                  code: `curl '${origin}${api}/promotions/active'`,
                },
                {
                  label: "JavaScript",
                  code: `const response = await fetch('${api}/promotions/active');
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
                { label: "200 Success", code: json({ data: [m1Promotion] }) },
                { label: "200 Empty", code: json({ data: [] }) },
              ]}
            />
            <p className="text-sm text-muted-foreground">
              <code>value</code> is a percentage for <code>percent</code> and an
              amount in EUR for <code>fixed</code>. Empty{" "}
              <code>productIds</code> and <code>categoryIds</code> mean the
              whole cart. <code>validTo</code> is null for no end.
            </p>
          </Section>
        </div>
      );

    case "validate":
      return (
        <div className="space-y-10">
          <Endpoint method="POST" path={`${api}/discounts/validate`} />
          <p className="leading-7 text-muted-foreground">
            The discount a cart gets at checkout, with the amount per line.
            Public and read-only: nothing is ordered or counted. Send{" "}
            <code>code</code> when the customer typed a discount code.
          </p>
          <Section title="Request body">
            <Table
              headers={["Field", "Type", "Required", "Description"]}
              rows={[
                [
                  <code key="c">currency</code>,
                  "string",
                  "Required",
                  "Three uppercase letters, e.g. EUR.",
                ],
                [
                  <code key="i">items</code>,
                  "array",
                  "Required",
                  "At least one line: productId, unitPrice (at most 2 decimal places), quantity (1 or more); optional categoryId, offerId, sellerId.",
                ],
                [
                  <code key="k">code</code>,
                  "string",
                  "Optional",
                  "The discount code the customer typed. Blank counts as none.",
                ],
                [
                  <code key="u">customerId</code>,
                  "string",
                  "Optional",
                  "Needed for per-customer code limits. Guests skip them.",
                ],
              ]}
            />
          </Section>
          <Section title="Request">
            <CodeExamples
              examples={[
                {
                  label: "cURL",
                  code: `curl -X POST '${origin}${api}/discounts/validate' \\
  -H 'content-type: application/json' \\
  -d '${JSON.stringify(validateRequest)}'`,
                },
                {
                  label: "Server code",
                  code: `import { validateDiscount } from "@/features/marketing/server";

const result = await validateDiscount(${JSON.stringify(validateRequest)});`,
                },
              ]}
            />
          </Section>
          <Section title="Response">
            <CodeExamples
              examples={[
                {
                  label: "200 Promotion",
                  code: json({ data: validateResult }),
                },
                {
                  label: "200 Code not valid",
                  code: json({
                    data: {
                      valid: false,
                      reasonCode: "code_expired",
                      discountTotal: 0,
                      currency: "EUR",
                      campaignId: null,
                      appliedBy: null,
                      promotionId: null,
                      items: [
                        { productId: "M1", discount: 0 },
                        { productId: "M2", discount: 0 },
                      ],
                      promotion: {
                        promotionId: m1Promotion.promotionId,
                        name: "M1 10 %",
                        discountTotal: 5.99,
                        items: [
                          { productId: "M1", discount: 5.99 },
                          { productId: "M2", discount: 0 },
                        ],
                      },
                    },
                  }),
                },
                {
                  label: "400 Error",
                  code: json({
                    error: {
                      code: "invalid_input",
                      message: "The request is not valid.",
                      fieldErrors: {
                        items: ["Too small: expected array to have >=1 items"],
                      },
                    },
                  }),
                },
              ]}
            />
            <p className="text-sm text-muted-foreground">
              <code>items</code> has one entry per request line, in the same
              order. See{" "}
              <Link className={linkClass} href={`${docsBase}/rules`}>
                discount rules
              </Link>{" "}
              for the four cases and the reason codes.
            </p>
          </Section>
        </div>
      );

    case "promotions":
      return (
        <div className="space-y-10">
          <p className="leading-7 text-muted-foreground">
            The back office for promotions. Every operation needs the
            marketing-manager login (the shared Admin & Identity login with the{" "}
            <code>marketing_manager</code> permission). The screen at{" "}
            <Link className={linkClass} href="/marketing/promotions">
              /marketing/promotions
            </Link>{" "}
            uses the same operations.
          </p>
          <Table
            headers={["Method", "Path", "What it does"]}
            rows={[
              ["POST", `${api}/promotions`, "Create a promotion (201)."],
              [
                "GET",
                `${api}/promotions?active=true|false`,
                "List promotions, latest start first.",
              ],
              ["GET", `${api}/promotions/{id}`, "Get one promotion."],
              [
                "PATCH",
                `${api}/promotions/{id}`,
                "Change only the fields sent; the rest stays.",
              ],
              [
                "POST",
                `${api}/promotions/{id}/deactivate`,
                "Stop a promotion at once. Promotions are never deleted.",
              ],
            ]}
          />
          <Section title="Create a promotion">
            <Table
              headers={["Field", "Rule"]}
              rows={[
                ["name", "1 to 100 characters."],
                ["description", "1 to 500 characters, shown to customers."],
                ["type", "percent or fixed (EUR)."],
                [
                  "value",
                  "Above 0, at most 2 decimal places; a percentage is at most 100.",
                ],
                [
                  "productIds / categoryIds",
                  "Catalog ids, at most 100 each. Both empty = whole cart. An unknown id is rejected.",
                ],
                [
                  "validFrom / validTo",
                  "ISO 8601 with a time zone. validFrom defaults to now; validTo is optional and must be after validFrom.",
                ],
              ]}
            />
            <CodeExamples
              examples={[
                {
                  label: "Request",
                  code: `POST ${api}/promotions
${json({
  name: m1Promotion.name,
  description: m1Promotion.description,
  type: "percent",
  value: 10,
  productIds: ["M1"],
  validTo: "2026-12-31T23:59:59+01:00",
})}`,
                },
                {
                  label: "201 Created",
                  code: json({ data: { ...m1Promotion, active: true } }),
                },
                { label: "400 Error", code: json(errorExample) },
              ]}
            />
          </Section>
        </div>
      );

    case "rules":
      return (
        <div className="space-y-8">
          <Section title="One discount per cart">
            <p>
              Promotions and codes never stack. The biggest discount wins. On a
              tie a code beats a promotion; between promotions the earlier start
              wins, then the lower id. A discount of 0 never wins.
            </p>
          </Section>
          <Section title="Which lines a discount covers">
            <p>
              With empty productIds and categoryIds a discount covers the whole
              cart. Otherwise a line counts when its productId or its categoryId
              is listed. Only those lines get a discount; a fixed amount is
              capped at their subtotal and split over them.
            </p>
          </Section>
          <Section title="Rounding">
            <p>
              Each line is rounded half up to cents before the lines are summed
              (10 % of 59.90 = 5.99). When a fixed amount is split, leftover
              cents go to the largest line.
            </p>
          </Section>
          <Section title="The four validate cases">
            <Table
              headers={["Case", "Result"]}
              rows={[
                [
                  "No code",
                  "The best promotion (appliedBy promotion), or nothing (appliedBy null, discount 0).",
                ],
                [
                  "Valid code, no promotion gives more",
                  "appliedBy code, with the code’s campaignId.",
                ],
                [
                  "Valid code, a promotion gives more",
                  "appliedBy promotion. Checkout applies the promotion, not the code.",
                ],
                [
                  "Invalid code",
                  "valid false with a reasonCode and zero discounts, plus a promotion object when one applies.",
                ],
              ]}
            />
            <p className="text-sm text-muted-foreground">
              Reason codes, in the order they are checked: code_not_found,
              code_inactive, code_not_started, code_expired, currency_mismatch,
              min_order_not_reached, no_eligible_items, usage_limit_reached,
              customer_limit_reached.
            </p>
          </Section>
        </div>
      );

    case "money":
      return (
        <div className="space-y-8">
          <Section title="On the wire">
            <p>
              Money is a decimal with at most 2 places plus a currency (59.90,
              EUR). Percentages are plain numbers (10 = 10 %). A value with more
              than 2 decimal places is rejected, never rounded.
            </p>
          </Section>
          <Section title="In the database">
            <p>
              The shared tables store cents and basis points: 59.90 is 5990, 10
              % is 1000. Marketing converts exactly at the API boundary. A fixed
              promotion is in EUR and applies to EUR carts only.
            </p>
          </Section>
          <Section title="IDs">
            <p>
              promotionId and campaignId are opaque strings. productIds and
              categoryIds are the shared catalog’s product and category ids.
            </p>
          </Section>
        </div>
      );

    case "checkout":
      return (
        <div className="space-y-8">
          <div className="rounded-lg border bg-muted/40 p-4 text-sm leading-6">
            <strong>Proposal, not yet agreed.</strong> Storefront and Accounting
            are reviewing it.
          </div>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              The checkout page calls <code>POST {api}/discounts/validate</code>{" "}
              to show the discount.
            </li>
            <li>
              When the order is placed, the server calls{" "}
              <code>validateDiscount(cart)</code> from{" "}
              <code>@/features/marketing/server</code> directly, so the discount
              is checked again at that moment.
            </li>
            <li>
              The order writer stores exactly that result with the order, in the
              same transaction: one <code>order_discount</code> row and one{" "}
              <code>order_discount_allocation</code> per discounted line, in
              cents (5.99 → 599).
            </li>
            <li>
              Accounting reads those rows for the invoice. An order without a
              discount has no <code>order_discount</code> row.
            </li>
          </ol>
          <p className="text-sm text-muted-foreground">
            Everything stays inside the app, so the hand-over needs no public
            route.
          </p>
        </div>
      );

    case "teams":
      return (
        <div className="space-y-8">
          <Table
            headers={["Team", "Exchange", "Status"]}
            rows={[
              [
                "Storefront",
                "Shows active promotions and asks validate for a cart’s discount.",
                "Operations available; checkout hand-over being agreed.",
              ],
              [
                "Checkout (owner open)",
                "Stores the applied discount with the order.",
                "Proposal sent.",
              ],
              [
                "Accounting",
                "Reads the stored discount for the invoice.",
                "Proposal sent; VAT and gross-price questions open.",
              ],
              [
                "Admin & Identity",
                "Login and the marketing_manager permission.",
                "Permission name to confirm.",
              ],
              [
                "Catalog",
                "Product and category ids that promotions target.",
                "Uses the shared product and category tables.",
              ],
            ]}
          />
          <p>
            These notes record the current agreements. They do not reassign
            ownership or replace cross-group review.
          </p>
        </div>
      );

    case "use-with-ai":
      return (
        <div className="space-y-10">
          <p>
            An AI agent can manage promotions through Marketing’s MCP server.
            The tools call the same operations as the API, with the same rules.
          </p>
          <Table
            headers={["Setting", "Value"]}
            rows={[
              ["Endpoint", `${origin}/api/mcp/marketing`],
              ["Transport", "Streamable HTTP"],
              [
                "Login",
                "A marketing manager’s session; 401 without a login, 403 without the permission.",
              ],
            ]}
          />
          <Section title="Tools">
            <Table
              headers={["Tool", "Changes data", "What it does"]}
              rows={[
                ["list_active_promotions", "no", "Promotions that apply now."],
                [
                  "list_promotions",
                  "no",
                  "All promotions with their ids; optional active filter.",
                ],
                ["create_promotion", "yes", "Creates a promotion."],
                [
                  "update_promotion",
                  "yes",
                  "Changes only the fields sent; the period stays.",
                ],
                ["deactivate_promotion", "yes", "Stops a promotion at once."],
                [
                  "check_cart_discount",
                  "no",
                  "The discount a cart gets, exactly as validate returns it.",
                ],
              ]}
            />
            <p className="text-sm text-muted-foreground">
              There is no delete or reset tool.
            </p>
          </Section>
          <Section title="Connect from code">
            <CodeBlock
              code={`import { createMCPClient } from "@ai-sdk/mcp";

const client = await createMCPClient({
  transport: {
    type: "http",
    url: "${origin}/api/mcp/marketing",
    headers: { cookie: managerSessionCookie },
  },
});
const tools = await client.tools();`}
            />
          </Section>
        </div>
      );

    case "errors":
      return (
        <div className="space-y-8">
          <CodeBlock code={json(errorExample)} />
          <Table
            headers={["HTTP", "Code", "Meaning"]}
            rows={[
              [
                "400",
                "invalid_input",
                "A field is missing or wrong; fieldErrors names it.",
              ],
              ["400", "invalid_id", "The promotion id is empty or too long."],
              ["401", "unauthorized", "Login required."],
              [
                "403",
                "forbidden",
                "The marketing_manager permission is missing.",
              ],
              ["404", "promotion_not_found", "No promotion with that id."],
              [
                "503",
                "identity_unavailable",
                "The login could not be checked; try again.",
              ],
            ]}
          />
          <p>
            A code that fails a rule is not an error: validate answers 200 with{" "}
            <code>valid: false</code> and a reasonCode.
          </p>
        </div>
      );

    case "openapi":
      return (
        <div className="space-y-8">
          <p>
            The OpenAPI 3.1 contract describes every Marketing operation. It is
            the source the handlers and their Zod schemas follow.
          </p>
          <div className="flex flex-wrap gap-6">
            <a className={linkClass} href={`${docsBase}/openapi.yaml`}>
              Open the OpenAPI YAML
            </a>
            <a
              className={linkClass}
              href={`${docsBase}/openapi.json`}
              download="marketing.openapi.json"
            >
              Download OpenAPI JSON
            </a>
          </div>
          <p className="text-sm text-muted-foreground">
            Changes are listed in the{" "}
            <a
              className={linkClass}
              href="https://github.com/rohit4242/shop-solution/blob/main/src/features/marketing/api/CHANGELOG.md"
            >
              changelog
            </a>
            .
          </p>
        </div>
      );

    default:
      return null;
  }
}
