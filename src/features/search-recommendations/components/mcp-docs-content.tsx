import Link from "next/link";
const code =
  "overflow-auto rounded-lg border bg-muted/40 p-4 text-xs leading-6 whitespace-pre-wrap";
export const mcpDocSlugs = [
  "mcp",
  "connect",
  "playground-guide",
  "mcp-local",
  "mcp-troubleshooting",
];
export function McpDocsContent({ slug }: { slug: string }) {
  const endpoint = process.env.SEARCH_PUBLIC_MCP_URL;
  if (slug === "mcp")
    return (
      <div className="space-y-6">
        <p>
          Use our five read-only tools from your own MCP client. The server
          translates each call into one request to the existing discovery API.
          It never invokes a model itself.
        </p>
        <pre className={code}>
          External client → MCP → Discovery API → feature services → mock
          catalog
        </pre>
        <p>
          The endpoint is <code>/api/mcp/search-recommendations</code>, using
          Streamable HTTP. It exposes search, facets, autocomplete, similar and
          also_bought, plus the resource{" "}
          <code>erp://search-recommendations/openapi</code>.
        </p>
        <p>
          Products are mock records. Co-purchase evidence is synthetic.
          Similarity is never substituted for absent purchase evidence. Prices
          are integer EUR cents; active out-of-stock products are included
          unless you filter them.
        </p>
        <p>
          <Link
            href="/docs/search-recommendations/connect"
            className="underline"
          >
            Connect a client
          </Link>{" "}
          ·{" "}
          <a
            className="underline"
            href="/docs/search-recommendations/openapi.yaml"
          >
            Download OpenAPI YAML
          </a>{" "}
          ·{" "}
          <a
            className="underline"
            href="/docs/search-recommendations/openapi.json"
          >
            Download JSON
          </a>
        </p>
        <p className="text-sm text-muted-foreground">
          Public tools require no playground account. Your client supplies its
          own model configuration. Requests can return 400, 404, 503 or 500; an
          empty 200 result is not an error.
        </p>
      </div>
    );
  if (slug === "connect")
    return (
      <div className="space-y-6">
        <p>
          {endpoint
            ? "Configured public endpoint:"
            : "No verified production endpoint has been published yet. Use the local endpoint while developing."}
        </p>
        <pre className={code}>
          {endpoint ?? "http://127.0.0.1:3000/api/mcp/search-recommendations"}
        </pre>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Open your client’s MCP connection settings and select remote HTTP /
            Streamable HTTP.
          </li>
          <li>
            Add the complete endpoint URL. Public mock discovery tools do not
            require an access token.
          </li>
          <li>Connect and list tools. Expect exactly five tools.</li>
          <li>
            Call search with q=wireless, availability=in_stock,
            maxPriceMinor=2500.
          </li>
          <li>Read the OpenAPI resource using a resource-capable client.</li>
        </ol>
        <p>
          Client configuration formats differ. This is a generic connection
          example; adapt the enclosing configuration to your client:
        </p>
        <pre className={code}>
          {JSON.stringify(
            {
              url:
                endpoint ??
                "http://127.0.0.1:3000/api/mcp/search-recommendations",
              transport: "streamable-http",
            },
            null,
            2,
          )}
        </pre>
        <p>
          Verified locally with the official MCP Python SDK 2.3.0 client over
          stdio and HTTP. MCP Inspector and third-party desktop-client
          verification are tracked separately in the submission verification
          notes; no universal client compatibility claim is made.
        </p>
      </div>
    );
  if (slug === "playground-guide")
    return (
      <div className="space-y-6">
        <p>
          The{" "}
          <Link
            className="underline"
            href="/docs/search-recommendations/playground"
          >
            team playground
          </Link>{" "}
          requires a Better Auth account and explicit user-ID approval.
        </p>
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            Select an approved model, enabled tools and supported settings.
            Optional instructions and description overrides apply to your
            experiment only.
          </li>
          <li>
            Choose an example or write a prompt. Configuration is frozen during
            the run.
          </li>
          <li>
            Inspect tool arguments, MCP results, API status/request IDs and
            reported usage. Events are normalized by the SDK; they are not a raw
            network capture.
          </li>
          <li>
            Stop a run to retain partial results. Limits are ten model steps,
            twenty tool calls and 120 seconds.
          </li>
          <li>
            Export a run, fork it with changed settings and compare results.
            Description edits are a useful first response to misunderstood
            tools.
          </li>
        </ol>
        <p>
          History is stored in this browser, namespaced by user ID, with limits
          of 50 runs, 20 presets and 20 MB. It is not encrypted or centrally
          shared. Imports are validated, limited to 5 MB and never executed
          automatically. Export before explicitly deleting history.
        </p>
        <p>
          Model credentials and service URLs remain server-side. Unsupported
          options are disabled. Token usage may be unavailable; matching
          settings do not ensure deterministic answers.
        </p>
      </div>
    );
  if (slug === "mcp-local")
    return (
      <div className="space-y-6">
        <p>
          Start the API and use the isolated Python environment for the course
          adapter. Python 3.11+ is required.
        </p>
        <pre className={code}>{`pnpm install --frozen-lockfile
pnpm contract:check
pnpm dev

# Another terminal
python3 -m venv tools/search-recommendations-mcp/.venv
tools/search-recommendations-mcp/.venv/bin/pip install -r tools/search-recommendations-mcp/requirements.lock
tools/search-recommendations-mcp/.venv/bin/python tools/search-recommendations-mcp/smoke.py

# Inspector: run from the Python package directory
cd tools/search-recommendations-mcp
.venv/bin/mcp dev server.py`}</pre>
        <p>
          The equivalent course runner is <code>agent.py</code>; it is not the
          original lecture stage-4 file. Configure CHAT_AI_API_KEY,
          CHAT_AI_BASE_URL and CHAT_AI_MODEL in your shell before use. Never
          commit credentials.
        </p>
      </div>
    );
  return (
    <div className="space-y-6">
      <ul className="list-disc space-y-3 pl-5">
        <li>
          <strong>Connection failed:</strong> start the API and check the
          configured origin. A local stdio client must be able to launch its
          Python executable.
        </li>
        <li>
          <strong>400:</strong> check names, enums, numeric limits and required
          IDs. Unknown/repeated query parameters are rejected by the API.
        </li>
        <li>
          <strong>404:</strong> the source product is absent or hidden. Use a
          productId from search results.
        </li>
        <li>
          <strong>Empty also-bought:</strong> no qualifying synthetic purchase
          evidence exists. This does not mean similar products are unavailable.
        </li>
        <li>
          <strong>503 / timeout:</strong> an API dependency or connection is
          unavailable; the model should report the failure.
        </li>
        <li>
          <strong>Playground access denied:</strong> a signed-in account still
          needs approval. Database availability is required for sessions.
        </li>
        <li>
          <strong>Model not configured:</strong> an operator must provide
          genuine provider credentials and capability profiles. Placeholder
          values cannot run a model.
        </li>
        <li>
          <strong>Storage full:</strong> export and explicitly delete older runs
          or presets. No unexported run is automatically evicted.
        </li>
      </ul>
      <p>
        Instructor acceptance of the Next.js substitution, partner contract
        agreement and cross-group review remain separate release requirements.
      </p>
    </div>
  );
}
