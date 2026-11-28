import { ArrowRight, Package, Search } from "lucide-react";
import Link from "next/link";

import { ProjectHeader } from "@/shared/components/project-header";
import { Button } from "@/shared/components/ui/button";

const workspaces = [
  {
    title: "Product discovery",
    description:
      "Try search, filters, and recommendations with the demo catalog.",
    href: "/docs/search-recommendations/discover",
    icon: Search,
  },
  {
    title: "Logistics",
    description:
      "Create a demo shipment and follow updates in its tracking history.",
    href: "/logistics",
    icon: Package,
  },
];

const integrations = [
  {
    label: "Search API reference",
    href: "/docs/search-recommendations",
  },
  {
    label: "Connect an AI agent (MCP)",
    href: "/docs/search-recommendations/use-with-ai",
  },
  {
    label: "Try the search API",
    href: "/api/v1/search?q=wireless",
  },
  { label: "Application health", href: "/api/health" },
];

export default function Home() {
  return (
    <>
      <ProjectHeader />
      <main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid gap-10 border-b border-border-emphasis py-12 sm:py-20 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-20">
          <header>
            <h1 className="font-display text-5xl leading-[1.04] tracking-tight sm:text-7xl">
              Shop Solution
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-muted-foreground sm:text-lg">
              A shared shop built by ten teams in Agent-Based Software
              Development. Try a working module or find the contract for your
              integration.
            </p>
            <Button asChild size="lg" className="mt-7 min-h-11">
              <Link href="/docs">
                Browse project docs <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </header>
          <section
            aria-labelledby="integration-links"
            className="rounded-xl border border-border border-t-4 border-t-highlight bg-card p-5 sm:p-6"
          >
            <h2 id="integration-links" className="font-semibold">
              Integration resources
            </h2>
            <ul className="mt-3 divide-y divide-border">
              {integrations.map(({ href, label }) => (
                <li key={href}>
                  <a
                    href={href}
                    className="flex min-h-11 items-center justify-between gap-2 rounded-sm py-2 text-sm text-link hover:underline"
                  >
                    {label}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 shrink-0"
                    />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </div>
        <section aria-labelledby="workspaces" className="pt-8 sm:pt-10">
          <h2 id="workspaces" className="font-display text-3xl tracking-tight">
            Workspaces
          </h2>
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {workspaces.map(({ title, description, href, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex h-full items-start gap-4 rounded-xl border border-border bg-card p-5 hover:border-primary"
                >
                  <Icon
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold group-hover:underline">
                      {title}
                    </h3>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                      {description}
                    </p>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-primary"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
