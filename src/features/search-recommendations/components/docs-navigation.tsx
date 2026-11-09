"use client";
import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Search } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/shared/components/ui/sheet";
// Navigation data is passed from the server; schema modules stay out of this client bundle.
export function DocsNavigation({
  pages,
}: {
  pages: readonly {
    slug: string;
    title: string;
    group: string;
    path?: string;
  }[];
}) {
  const [filter, setFilter] = useState(""),
    [open, setOpen] = useState(false);
  const pathname = usePathname();
  const matches = pages.filter((p) =>
    `${p.title} ${p.path ?? ""}`.toLowerCase().includes(filter.toLowerCase()),
  );
  function navigation(mobile: boolean) {
    return (
      <>
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            aria-label={
              mobile ? "Search mobile documentation" : "Search documentation"
            }
            placeholder="Search docs…"
            className="pl-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <nav
          aria-label={mobile ? "Mobile documentation" : "Documentation"}
          className="space-y-6"
        >
          {!matches.length && (
            <p role="status" className="text-sm text-muted-foreground">
              No matching pages.
            </p>
          )}
          {[...new Set(matches.map((p) => p.group))].map((group) => (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {group}
              </p>
              <ul className="space-y-1">
                {matches
                  .filter((p) => p.group === group)
                  .map((p) => {
                    const href = `/docs/search-recommendations${p.slug ? `/${p.slug}` : ""}`;
                    return (
                      <li key={p.slug}>
                        <Link
                          href={href}
                          onClick={() => setOpen(false)}
                          aria-current={pathname === href ? "page" : undefined}
                          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-muted aria-[current=page]:font-medium aria-[current=page]:text-foreground"
                        >
                          {p.path && (
                            <span className="rounded border px-1 text-[10px] font-semibold text-foreground">
                              GET
                            </span>
                          )}
                          {p.title}
                        </Link>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
        </nav>
      </>
    );
  }
  return (
    <>
      <aside className="sticky top-20 hidden h-[calc(100vh-5rem)] w-64 shrink-0 overflow-y-auto px-5 py-8 lg:block">
        {navigation(false)}
      </aside>
      <div className="border-b px-4 py-3 lg:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu />
              Navigation
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetTitle className="mb-2 font-semibold">
              Developer documentation
            </SheetTitle>
            <SheetDescription className="mb-6 text-sm text-muted-foreground">
              Search pages or choose an API.
            </SheetDescription>
            {navigation(true)}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
