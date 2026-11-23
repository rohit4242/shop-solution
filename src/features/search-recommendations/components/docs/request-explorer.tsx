"use client";
import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { CodeBlock } from "./code-examples";
const allowedPaths = new Set([
  "/api/v1/search",
  "/api/v1/search/facets",
  "/api/v1/search/autocomplete",
  "/api/v1/recommendations/similar",
  "/api/v1/recommendations/also-bought",
]);
export function RequestExplorer({
  path,
  exampleQuery,
}: {
  path: string;
  exampleQuery: string;
}) {
  const [query, setQuery] = useState(exampleQuery),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(""),
    [body, setBody] = useState("");
  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!allowedPaths.has(path)) return;
    setBusy(true);
    setStatus("Loading…");
    setBody("");
    try {
      const response = await fetch(`${path}?${new URLSearchParams(query)}`, {
        cache: "no-store",
        credentials: "omit",
        signal: AbortSignal.timeout(10000),
      });
      setStatus(`HTTP ${response.status} ${response.statusText}`);
      setBody(JSON.stringify(await response.json(), null, 2));
    } catch {
      setStatus(
        "Request failed or timed out. Check that the application is running and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 rounded-lg border p-5">
      <p className="text-sm text-muted-foreground">
        Calls this application using mock data. No request is sent until you
        click Run request.
      </p>
      <form onSubmit={run} className="space-y-3">
        <Label htmlFor="request-query">Query parameters</Label>
        <Input
          id="request-query"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="font-mono text-sm"
          autoComplete="off"
        />
        <Button disabled={busy} type="submit">
          {busy ? "Running…" : "Run request"}
        </Button>
      </form>
      <p role="status" className="text-sm font-medium">
        {status}
      </p>
      {body && <CodeBlock code={body} />}
    </div>
  );
}
