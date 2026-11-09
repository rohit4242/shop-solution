import { describe, expect, it, vi } from "vitest";
import { createDiscoveryApi } from "../server/services/api";
import {
  mockOfferSource,
  mockPurchaseSource,
} from "../server/repositories/mock-sources";
import { toolDefinitions, callDiscoveryTool } from "../server/mcp/tools";

describe("discovery request evidence", () => {
  it("correlates success and invalid-input responses with exactly one sanitized log each", async () => {
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    try {
      const api = createDiscoveryApi(mockOfferSource, mockPurchaseSource);
      for (const query of ["q=wireless", "secret=do-not-log"]) {
        const result = await api(
          "search",
          new Request(`http://localhost/api/v1/search?${query}`),
        );
        expect(result.headers.get("x-request-id")).toBeTruthy();
        expect(JSON.stringify(log.mock.calls.at(-1))).toContain(
          result.headers.get("x-request-id"),
        );
      }
      expect(log).toHaveBeenCalledTimes(2);
      expect(JSON.stringify(log.mock.calls)).not.toContain("do-not-log");
    } finally {
      log.mockRestore();
    }
  });
});

describe("MCP translation", () => {
  it("has five bounded tool schemas, including enums and required IDs", () => {
    expect(Object.keys(toolDefinitions)).toEqual([
      "search",
      "facets",
      "autocomplete",
      "similar",
      "also_bought",
    ]);
    expect(
      toolDefinitions.search.schema.safeParse({ availability: "unknown" })
        .success,
    ).toBe(false);
    expect(toolDefinitions.similar.schema.safeParse({}).success).toBe(false);
    expect(
      toolDefinitions.search.schema.safeParse({ pageSize: 101 }).success,
    ).toBe(false);
  });
  it("sends one safely encoded request and preserves the API error", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "PRODUCT_NOT_FOUND", message: "Product not found." },
        }),
        { status: 404, headers: { "x-request-id": "r1" } },
      ),
    );
    const result = await callDiscoveryTool(
      "similar",
      { productId: "missing & value" },
      { origin: "http://localhost:3000", fetcher },
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("productId")).toBe("missing & value");
    expect(result.isError).toBe(true);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      status: 404,
      requestId: "r1",
      body: { error: { code: "PRODUCT_NOT_FOUND" } },
    });
  });
  it("does not call upstream for invalid input; distinguishes connection failure", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("secret URL"));
    await expect(
      callDiscoveryTool(
        "search",
        { pageSize: 101 },
        { origin: "http://localhost:3000", fetcher },
      ),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
    const result = await callDiscoveryTool(
      "search",
      {},
      { origin: "http://localhost:3000", fetcher },
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      status: null,
      error: { code: "CONNECTION_FAILED" },
    });
    expect(result.content[0].text).not.toContain("secret URL");
  });
});
it("forwards preview bypass only upstream, never into tool output", async () => {
  vi.stubEnv("VERCEL_AUTOMATION_BYPASS_SECRET", "preview-secret");
  try {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ data: { items: [] } }));
    const result = await callDiscoveryTool(
      "search",
      {},
      { origin: "http://localhost:3000", fetcher },
    );
    expect(fetcher.mock.calls[0][1].headers["x-vercel-protection-bypass"]).toBe(
      "preview-secret",
    );
    expect(JSON.stringify(result)).not.toContain("preview-secret");
  } finally {
    vi.unstubAllEnvs();
  }
});
