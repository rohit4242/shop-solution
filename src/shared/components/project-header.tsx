import { ArrowUpRight, ShoppingBag } from "lucide-react";
import Link from "next/link";

export function ProjectHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 px-5 sm:px-8">
        <Link
          href="/"
          className="flex min-h-14 items-center gap-2 rounded-sm font-semibold text-link sm:min-h-16"
        >
          <ShoppingBag aria-hidden="true" className="size-5 shrink-0" />
          Shop Solution
        </Link>
        <nav aria-label="Project" className="flex flex-wrap gap-5 text-sm">
          <Link
            href="/docs"
            className="inline-flex min-h-11 items-center rounded-sm hover:underline"
          >
            Docs
          </Link>
          <a
            href="https://github.com/rohit4242/shop-solution"
            className="inline-flex min-h-11 items-center gap-1 rounded-sm hover:underline"
          >
            GitHub <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </a>
        </nav>
      </div>
    </header>
  );
}
