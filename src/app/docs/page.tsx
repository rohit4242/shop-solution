import Link from "next/link";
import { ProjectHeader } from "@/shared/components/project-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";

export const metadata = {
  title: "Project docs | Shop Solution",
  description: "Documentation, APIs and agent tools from every team.",
};

const repo = "https://github.com/rohit4242/shop-solution";
const featureTree = `${repo}/tree/main/src/features`;

// Teams add their links here once they publish docs.
const teams: {
  slug: string;
  name: string;
  description?: string;
  links?: { label: string; href: string }[];
}[] = [
  {
    slug: "search-recommendations",
    name: "Search & Recommendations",
    links: [
      { label: "API docs", href: "/docs/search-recommendations" },
      {
        label: "Use with your AI agent (MCP)",
        href: "/docs/search-recommendations/use-with-ai",
      },
      {
        label: "OpenAPI contract",
        href: "/docs/search-recommendations/openapi.yaml",
      },
      {
        label: "Discovery workbench",
        href: "/docs/search-recommendations/discover",
      },
      { label: "Playground", href: "/docs/search-recommendations/playground" },
    ],
  },
  { slug: "accounting", name: "Accounting" },
  {
    slug: "admin-identity",
    name: "Admin & Identity",
    description: "Integration docs and local demo setup",
    links: [
      {
        label: "Moderation flow draft",
        href: `${repo}/blob/main/docs/search-recommendations/exercises/cross-module-flow/flow.md`,
      },
    ],
  },
  { slug: "analytics-reporting", name: "Analytics & Reporting" },
  { slug: "crm", name: "CRM" },
  {
    slug: "logistics",
    name: "Logistics",
    description: "Workspace, API contract and exercise docs",
    links: [
      { label: "Logistics workspace", href: "/logistics" },
      {
        label: "OpenAPI contract",
        href: `${repo}/blob/main/src/features/logistics/api/openapi.yaml`,
      },
      {
        label: "Exercise and MCP docs",
        href: `${featureTree}/logistics/docs/session7`,
      },
    ],
  },
  {
    slug: "marketing",
    name: "Marketing",
    description: "Workspace, API contract, MCP and exercise docs",
    links: [
      { label: "Marketing workspace", href: "/marketing/promotions" },
      {
        label: "OpenAPI contract",
        href: `${repo}/blob/main/docs/marketing/marketing.yaml`,
      },
      {
        label: "Exercise and MCP docs",
        href: `${repo}/tree/main/docs/marketing`,
      },
    ],
  },
  { slug: "marketplace", name: "Marketplace" },
  { slug: "reviews-ratings", name: "Reviews & Ratings" },
  { slug: "storefront", name: "Storefront" },
];

export default function DocsHub() {
  return (
    <>
      <ProjectHeader />
      <main className="mx-auto max-w-6xl space-y-8 px-5 py-12 sm:px-8 sm:py-16">
        <header className="space-y-3">
          <h1 className="font-display text-5xl tracking-tight sm:text-6xl">
            Project docs
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
            APIs, contracts and agent tools from every team. Teams without
            published docs link to their feature README on GitHub.
          </p>
        </header>
        <div className="grid gap-4 sm:grid-cols-2">
          {teams.map((team) => (
            <Card key={team.slug} id={`team-${team.slug}`}>
              <CardHeader>
                <CardTitle>
                  <h2>{team.name}</h2>
                </CardTitle>
                {team.description && (
                  <CardDescription>{team.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm">
                  {(team.links ?? []).map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="rounded-sm text-link underline underline-offset-4"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                  <li>
                    <a
                      href={`${featureTree}/${team.slug}`}
                      className="rounded-sm text-muted-foreground underline underline-offset-4"
                    >
                      Feature README on GitHub ↗
                    </a>
                  </li>
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </>
  );
}
