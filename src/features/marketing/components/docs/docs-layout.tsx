import Link from "next/link";
import { docPages, docsBase } from "../../docs/navigation";
import { DocsNavigation } from "./docs-navigation";

export function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#docs-content"
        className="sr-only z-50 rounded bg-background p-3 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b bg-background">
        <div className="mx-auto flex min-h-20 max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <nav className="flex flex-wrap items-center gap-2 text-sm sm:text-base">
            <Link href="/" className="text-muted-foreground hover:underline">
              Shop Solution
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link
              href="/docs"
              className="text-muted-foreground hover:underline"
            >
              Docs
            </Link>
            <span className="text-muted-foreground">/</span>
            <Link href={docsBase} className="font-semibold tracking-tight">
              Marketing
            </Link>
          </nav>
          <div className="flex items-center gap-3 text-xs">
            <span className="rounded-md border px-2 py-1 text-muted-foreground">
              v0.4.0 · Promotions
            </span>
            <a
              href={`${docsBase}/openapi.json`}
              className="rounded-md px-2 py-1 underline underline-offset-4"
            >
              OpenAPI ↗
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col lg:flex-row">
        <DocsNavigation base={docsBase} pages={docPages} />
        <main
          id="docs-content"
          tabIndex={-1}
          className="min-w-0 flex-1 px-5 py-10 outline-none sm:px-10 lg:border-l lg:py-12"
        >
          {children}
          <footer className="mt-16 border-t pt-6 text-xs leading-6 text-muted-foreground">
            Marketing · Promotions and discount validation · Checkout hand-over
            to be agreed with Storefront and Accounting
          </footer>
        </main>
      </div>
    </div>
  );
}
