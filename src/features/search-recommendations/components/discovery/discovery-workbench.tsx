"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { ZodType } from "zod";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import {
  errorResponseSchema,
  recommendationsResponseSchema,
  searchResponseSchema,
} from "../../schemas/contracts";
import { identitySessionStatusSchema } from "../../schemas/identity-session";
import type { DiscoveryItem } from "../../types/discovery";
import type {
  RecommendationsResponse,
  SearchResponse,
} from "../../types/responses";

type ViewState<T> =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; data: T }
  | { kind: "error"; message: string };

type IdentitySessionState =
  | { kind: "loading" }
  | { kind: "anonymous" }
  | { kind: "authenticated"; email: string; displayName: string }
  | { kind: "error"; message: string };

const networkError =
  "The discovery service is not available. Check the service and try again.";
const invalidResponseError =
  "The discovery service returned an invalid response. Please try again.";
const identitySessionError =
  "Could not check the Admin & Identity session. Search remains available; try again.";

async function requestApi<T>(
  path: string,
  params: URLSearchParams,
  schema: ZodType<{ data: T }>,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${path}?${params}`, {
      cache: "no-store",
      credentials: "omit",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(networkError);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(invalidResponseError);
  }

  if (!response.ok) {
    const failure = errorResponseSchema.safeParse(body);
    if (failure.success) throw new Error(failure.data.error.message);
    throw new Error(invalidResponseError);
  }

  const result = schema.safeParse(body);
  if (!result.success) throw new Error(invalidResponseError);
  return result.data.data;
}

async function requestIdentitySession() {
  let response: Response;
  try {
    response = await fetch("/api/integrations/admin-identity/session", {
      cache: "no-store",
      credentials: "same-origin",
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    throw new Error(identitySessionError);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new Error(invalidResponseError);
  }

  if (!response.ok) {
    const failure = errorResponseSchema.safeParse(body);
    if (failure.success) throw new Error(failure.data.error.message);
    throw new Error(identitySessionError);
  }

  const result = identitySessionStatusSchema.safeParse(body);
  if (!result.success) throw new Error(invalidResponseError);
  return result.data;
}

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : networkError;
}

function ProductCards({
  items,
  onUseProduct,
}: {
  items: DiscoveryItem[];
  onUseProduct?: (productId: string) => void;
}) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.productId}>
          <Card className="h-full shadow-none">
            <CardHeader>
              <CardTitle className="text-base">{item.name}</CardTitle>
              <p className="text-sm text-muted-foreground">{item.category}</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                <dt className="text-muted-foreground">Product ID</dt>
                <dd>
                  <code>{item.productId}</code>
                </dd>
                <dt className="text-muted-foreground">Price</dt>
                <dd>
                  {new Intl.NumberFormat("en-IE", {
                    style: "currency",
                    currency: item.currency,
                  }).format(item.priceMinor / 100)}
                </dd>
                <dt className="text-muted-foreground">Availability</dt>
                <dd>
                  {item.availability === "in_stock"
                    ? "In stock"
                    : "Out of stock"}
                </dd>
              </dl>
              {onUseProduct && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onUseProduct(item.productId)}
                >
                  Use product ID
                </Button>
              )}
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function DiscoveryWorkbench() {
  const [identitySession, setIdentitySession] = useState<IdentitySessionState>({
    kind: "loading",
  });
  const [sessionRefreshKey, setSessionRefreshKey] = useState(0);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [searchState, setSearchState] = useState<
    ViewState<SearchResponse["data"]>
  >({ kind: "idle" });
  const [productId, setProductId] = useState("");
  const [recommendationState, setRecommendationState] = useState<
    ViewState<RecommendationsResponse["data"]>
  >({ kind: "idle" });

  useEffect(() => {
    let active = true;
    void requestIdentitySession()
      .then((session) => {
        if (!active) return;
        setIdentitySession(
          session.authenticated
            ? {
                kind: "authenticated",
                email: session.email,
                displayName: session.displayName,
              }
            : { kind: "anonymous" },
        );
      })
      .catch((error: unknown) => {
        if (active) {
          setIdentitySession({ kind: "error", message: messageFrom(error) });
        }
      });
    return () => {
      active = false;
    };
  }, [sessionRefreshKey]);

  async function search(q: string, page: number) {
    setSubmittedQuery(q);
    setSearchState({ kind: "loading" });
    const params = new URLSearchParams({
      q,
      page: String(page),
    });
    try {
      const data = await requestApi(
        "/api/v1/search",
        params,
        searchResponseSchema,
      );
      setSearchState({ kind: "success", data });
    } catch (error) {
      setSearchState({ kind: "error", message: messageFrom(error) });
    }
  }

  async function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await search(query.trim(), 1);
  }

  async function loadRecommendations(operation: "similar" | "also-bought") {
    const id = productId.trim();
    if (!id) return;

    setRecommendationState({ kind: "loading" });
    const params = new URLSearchParams({ productId: id });
    try {
      const data = await requestApi(
        `/api/v1/recommendations/${operation}`,
        params,
        recommendationsResponseSchema,
      );
      setRecommendationState({ kind: "success", data });
    } catch (error) {
      setRecommendationState({ kind: "error", message: messageFrom(error) });
    }
  }

  const searchBusy = searchState.kind === "loading";
  const recommendationsBusy = recommendationState.kind === "loading";
  const totalPages =
    searchState.kind === "success"
      ? Math.ceil(searchState.data.total / searchState.data.pageSize)
      : 0;

  return (
    <div className="space-y-10">
      <header className="max-w-3xl space-y-3">
        <p className="text-sm text-muted-foreground">
          Developer tool · Mock-backed public API
        </p>
        <p className="leading-7 text-muted-foreground">
          Search the mock catalog and inspect the recommendation APIs. This
          workbench uses the public Search &amp; Recommendations API. Shared
          sign-in status is read separately through Admin &amp; Identity.
        </p>
      </header>

      <section
        aria-labelledby="identity-session-heading"
        className="flex flex-col gap-3 border-b pb-6 sm:flex-row sm:items-start sm:justify-between"
      >
        <div className="space-y-2">
          <h2
            id="identity-session-heading"
            className="text-sm font-semibold text-foreground"
          >
            Shared sign-in
          </h2>
          {identitySession.kind === "loading" && (
            <p role="status" className="text-sm text-muted-foreground">
              Checking shared sign-in…
            </p>
          )}
          {identitySession.kind === "anonymous" && (
            <p role="status" className="text-sm text-muted-foreground">
              Not signed in. Search remains public; no separate login is needed.
            </p>
          )}
          {identitySession.kind === "authenticated" && (
            <p role="status" className="text-sm text-muted-foreground">
              Signed in as {identitySession.displayName} (
              {identitySession.email}). Search uses the same shared session.
            </p>
          )}
          {identitySession.kind === "error" && (
            <p role="alert" className="text-sm text-destructive">
              {identitySession.message}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link
              href="http://localhost:5500/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground underline underline-offset-4"
            >
              Admin &amp; Identity (Back Office)
            </Link>
            <Link
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              Identity API docs
            </Link>
            <Link
              href="http://localhost:3000/admin/codes"
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              Marketing (Campaigns &amp; Codes)
            </Link>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={identitySession.kind === "loading"}
          onClick={() => {
            setIdentitySession({ kind: "loading" });
            setSessionRefreshKey((key) => key + 1);
          }}
        >
          Refresh sign-in status
        </Button>
      </section>

      <section aria-labelledby="search-heading" className="space-y-5">
        <div className="space-y-1">
          <h2 id="search-heading" className="text-xl font-semibold">
            Search products
          </h2>
          <p className="text-sm text-muted-foreground">
            Search matches product names and other documented catalog fields.
          </p>
        </div>
        <form
          onSubmit={submitSearch}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="discovery-query">Search phrase</Label>
            <Input
              id="discovery-query"
              name="q"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. wireless"
              autoComplete="off"
            />
          </div>
          <Button type="submit" className="self-end" disabled={searchBusy}>
            {searchBusy ? "Searching…" : "Search"}
          </Button>
        </form>

        <div
          aria-busy={searchBusy}
          aria-labelledby="search-results-heading"
          className="space-y-4"
        >
          <h3 id="search-results-heading" className="text-lg font-medium">
            Search results
          </h3>
          {searchState.kind === "idle" && (
            <p role="status" className="rounded-lg border p-4 text-sm">
              Enter a phrase to search the mock catalog.
            </p>
          )}
          {searchState.kind === "loading" && (
            <p role="status" className="rounded-lg border p-4 text-sm">
              Searching catalog…
            </p>
          )}
          {searchState.kind === "error" && (
            <p role="alert" className="rounded-lg border p-4 text-sm">
              {searchState.message}
            </p>
          )}
          {searchState.kind === "success" && (
            <>
              {searchState.data.items.length === 0 ? (
                <p role="status" className="rounded-lg border p-4 text-sm">
                  No products matched your search. Try another phrase.
                </p>
              ) : (
                <>
                  <p role="status" className="text-sm text-muted-foreground">
                    Showing{" "}
                    {(searchState.data.page - 1) * searchState.data.pageSize +
                      1}
                    –
                    {Math.min(
                      searchState.data.page * searchState.data.pageSize,
                      searchState.data.total,
                    )}{" "}
                    of {searchState.data.total} products
                  </p>
                  <ProductCards
                    items={searchState.data.items}
                    onUseProduct={(id) => setProductId(id)}
                  />
                </>
              )}
              {totalPages > 1 && (
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={searchBusy || searchState.data.page <= 1}
                    onClick={() =>
                      void search(submittedQuery, searchState.data.page - 1)
                    }
                  >
                    Previous page
                  </Button>
                  <span className="text-sm" aria-label="Current page">
                    Page {searchState.data.page} of {totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={searchBusy || searchState.data.page >= totalPages}
                    onClick={() =>
                      void search(submittedQuery, searchState.data.page + 1)
                    }
                  >
                    Next page
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <section
        aria-labelledby="recommendations-heading"
        className="space-y-5 border-t pt-8"
      >
        <div className="space-y-1">
          <h2 id="recommendations-heading" className="text-xl font-semibold">
            Inspect recommendations
          </h2>
          <p className="text-sm text-muted-foreground">
            Use a product ID from a search result, or enter one from the mock
            contract.
          </p>
        </div>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void loadRecommendations("similar");
          }}
        >
          <div className="max-w-md space-y-2">
            <Label htmlFor="recommendation-product-id">Product ID</Label>
            <Input
              id="recommendation-product-id"
              name="productId"
              value={productId}
              onChange={(event) => setProductId(event.target.value)}
              placeholder="e.g. prd_1"
              autoComplete="off"
              maxLength={128}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="outline"
              disabled={recommendationsBusy || productId.trim().length === 0}
            >
              {recommendationsBusy ? "Loading…" : "Similar"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={recommendationsBusy || productId.trim().length === 0}
              onClick={() => void loadRecommendations("also-bought")}
            >
              {recommendationsBusy ? "Loading…" : "Also bought"}
            </Button>
          </div>
        </form>

        <div
          aria-busy={recommendationsBusy}
          aria-labelledby="recommendation-results-heading"
          className="space-y-4"
        >
          <h3
            id="recommendation-results-heading"
            className="text-lg font-medium"
          >
            Recommendation results
          </h3>
          {recommendationState.kind === "idle" && (
            <p role="status" className="rounded-lg border p-4 text-sm">
              Enter a product ID to inspect recommendations.
            </p>
          )}
          {recommendationState.kind === "loading" && (
            <p role="status" className="rounded-lg border p-4 text-sm">
              Loading recommendations…
            </p>
          )}
          {recommendationState.kind === "error" && (
            <p role="alert" className="rounded-lg border p-4 text-sm">
              {recommendationState.message}
            </p>
          )}
          {recommendationState.kind === "success" &&
            (recommendationState.data.items.length === 0 ? (
              <p role="status" className="rounded-lg border p-4 text-sm">
                No recommendations are available for this product.
              </p>
            ) : (
              <ProductCards items={recommendationState.data.items} />
            ))}
        </div>
      </section>
    </div>
  );
}
