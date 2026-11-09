import Link from "next/link";
import { Button } from "@/shared/components/ui/button";

// Foundation placeholder until the Storefront team builds the real home page.
const quickLinks = [
  {
    label: "Search & Recommendations API docs",
    href: "/docs/search-recommendations",
  },
  {
    label: "Connect your AI agent (MCP)",
    href: "/docs/search-recommendations/use-with-ai",
  },
  { label: "Try the search API", href: "/api/v1/search?q=wireless" },
  { label: "Application health", href: "/api/health" },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-20">
      <div className="space-y-6">
        <p className="text-sm text-zinc-500">
          Agent-Based Software Development
        </p>
        <h1 className="text-4xl font-semibold">Shop Solution</h1>
        <p className="text-lg text-zinc-600">
          One shared application. Ten feature teams.
        </p>
        <p>
          The project foundation is ready for team development. Authentication,
          commerce features and team interfaces are developed through reviewed
          pull requests.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/docs">Project docs</Link>
        </Button>
        <Button asChild variant="outline">
          <a href="https://github.com/rohit4242/shop-solution">GitHub ↗</a>
        </Button>
      </div>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Quick links
        </h2>
        <ul className="space-y-2">
          {quickLinks.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="underline underline-offset-4">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
