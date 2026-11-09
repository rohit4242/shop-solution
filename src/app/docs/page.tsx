import Link from "next/link";
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

const repo =
  "https://github.com/rohit4242/shop-solution/tree/main/src/features";

// Teams add their links here once they publish docs.
const teams: {
  slug: string;
  name: string;
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
      { label: "Playground", href: "/docs/search-recommendations/playground" },
    ],
  },
  { slug: "accounting", name: "Accounting" },
  { slug: "admin-identity", name: "Admin & Identity" },
  { slug: "analytics-reporting", name: "Analytics & Reporting" },
  { slug: "crm", name: "CRM" },
  { slug: "logistics", name: "Logistics" },
  { slug: "marketing", name: "Marketing" },
  { slug: "marketplace", name: "Marketplace" },
  { slug: "reviews-ratings", name: "Reviews & Ratings" },
  { slug: "storefront", name: "Storefront" },
];

export default function DocsHub() {
  return (
    <main className="mx-auto max-w-5xl space-y-8 px-6 py-16">
      <nav className="text-sm text-zinc-500">
        <Link href="/" className="underline underline-offset-4">
          Shop Solution
        </Link>{" "}
        / Docs
      </nav>
      <header className="space-y-3">
        <h1 className="text-4xl font-semibold">Project docs</h1>
        <p className="text-lg text-zinc-600">
          APIs, contracts and agent tools from every team. Teams without
          published docs link to their feature README on GitHub.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        {teams.map((team) => (
          <Card key={team.slug}>
            <CardHeader>
              <CardTitle>{team.name}</CardTitle>
              <CardDescription>
                {team.links ? "Live docs" : "No published docs yet"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {(team.links ?? []).map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="underline underline-offset-4"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a
                    href={`${repo}/${team.slug}`}
                    className="text-zinc-500 underline underline-offset-4"
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
  );
}
