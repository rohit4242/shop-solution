import { describe, expect, it, vi } from "vitest";
import { createDiscoveryApi } from "../server/services/api";
import {
  createMockOffers,
  mockOfferSource,
  mockPurchaseSource,
} from "../server/repositories/mock-sources";
import { createCatalogLoader } from "../server/repositories/snapshots";
import { catalogSchema, searchQuerySchema } from "../schemas/contracts";
import { relevance } from "../server/services/discovery";
const request = (query = "") =>
  new Request(`http://localhost/api/v1/search${query ? `?${query}` : ""}`);
const api = () => createDiscoveryApi(mockOfferSource, mockPurchaseSource);
describe("public discovery contracts", () => {
  it("only exposes active offers, including out of stock, without internal fields", async () => {
    const response = await api()("search", request("pageSize=100"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    const { data } = await response.json();
    expect(data.total).toBe(20);
    expect(
      data.items.some(
        (o: { availability: string }) => o.availability === "out_of_stock",
      ),
    ).toBe(true);
    expect(data.items[0]).not.toHaveProperty("status");
    expect(data.items[0]).not.toHaveProperty("attributes");
  });
  it.each([
    "q=a&q=b",
    "extra=1",
    "page=0",
    "page=1.2",
    "page=1e2",
    "page=",
    "page=9007199254740992",
    "minPriceMinor=20&maxPriceMinor=10",
    "pageSize=101",
    "sort=random",
    "q=" + "word%20".repeat(21),
  ])("rejects invalid query %s before loading providers", async (query) => {
    const loadOffers = vi.fn();
    const handler = createDiscoveryApi({ loadOffers }, mockPurchaseSource);
    expect((await handler("search", request(query))).status).toBe(400);
    expect(loadOffers).not.toHaveBeenCalled();
  });
  it("matches accents and all terms, with weighted and exact-name ranking", async () => {
    const handler = api();
    expect(
      (await (await handler("search", request("q=cafe"))).json()).data.items[0]
        .name,
    ).toBe("Café Cup");
    expect(
      (await (await handler("search", request("q=wireless%20black"))).json())
        .data.total,
    ).toBe(1);
    expect(
      (await (await handler("search", request("q=wireless%20ceramic"))).json())
        .data.total,
    ).toBe(0);
    const offer = createMockOffers()[0];
    expect(relevance(offer, "Wireless Mouse")).toBe(18);
    expect(relevance(offer, "everyday")).toBe(1);
    expect(relevance(offer, "black")).toBe(2);
  });
  it("applies inclusive price and availability filters before stable pagination", async () => {
    const handler = api();
    const query =
      "category=Electronics&availability=in_stock&minPriceMinor=1999&maxPriceMinor=1999&sort=price_asc&pageSize=1";
    const first = (await (await handler("search", request(query))).json()).data;
    const next = (
      await (await handler("search", request(query + "&page=2"))).json()
    ).data;
    expect(first.total).toBe(2);
    expect(first.items[0].productId).not.toBe(next.items[0].productId);
    expect(
      (await (await handler("search", request("page=999"))).json()).data.items,
    ).toEqual([]);
  });
  it("uses disjunctive facet counts and ignores price bounds for range", async () => {
    const { data } = await (
      await api()("facets", request("category=Electronics&minPriceMinor=3999"))
    ).json();
    expect(
      data.categories.some((v: { category: string }) => v.category === "Home"),
    ).toBe(true);
    expect(data.priceRange).toEqual({
      minPriceMinor: 1999,
      maxPriceMinor: 3999,
    });
    expect(
      (await (await api()("facets", request("q=nonexistent"))).json()).data
        .priceRange,
    ).toBeNull();
  });
  it("autocomplete is a visible name prefix, with a minimum length", async () => {
    const handler = api();
    expect((await handler("autocomplete", request("q=c"))).status).toBe(400);
    expect(
      (await (await handler("autocomplete", request("q=cafe"))).json()).data
        .suggestions,
    ).toEqual([{ productId: "prd_7", name: "Café Cup" }]);
    expect(
      (await (await handler("autocomplete", request("q=charger"))).json()).data
        .suggestions,
    ).toEqual([]);
  });
  it("similar excludes the source and other categories; sorts shared attributes then price", async () => {
    const { data } = await (
      await api()("similar", request("productId=prd_1"))
    ).json();
    expect(data.items[0].productId).toBe("prd_5");
    expect(
      data.items.every(
        (o: { category: string; productId: string }) =>
          o.category === "Electronics" && o.productId !== "prd_1",
      ),
    ).toBe(true);
  });
  it("co-purchases deduplicate each group, remove hidden/missing candidates, and honor stock", async () => {
    const handler = createDiscoveryApi(mockOfferSource, {
      async loadPurchaseGroups() {
        return [
          {
            purchaseId: "a",
            productIds: ["prd_1", "prd_4", "prd_4", "prd_6", "missing"],
          },
          { purchaseId: "b", productIds: ["prd_1", "prd_2"] },
          { purchaseId: "c", productIds: ["prd_1", "prd_2"] },
        ];
      },
    });
    expect(
      (
        await (await handler("also-bought", request("productId=prd_1"))).json()
      ).data.items.map((o: { productId: string }) => o.productId),
    ).toEqual(["prd_2", "prd_4"]);
    expect(
      (
        await (
          await handler(
            "also-bought",
            request("productId=prd_1&availability=in_stock"),
          )
        ).json()
      ).data.items.map((o: { productId: string }) => o.productId),
    ).toEqual(["prd_4"]);
    expect(
      (await (await handler("also-bought", request("productId=prd_24"))).json())
        .data.items,
    ).toEqual([]);
  });
  it.each(["prd_6", "missing"])(
    "does not reveal hidden or missing source %s",
    async (productId) => {
      const loadPurchaseGroups = vi.fn();
      const handler = createDiscoveryApi(mockOfferSource, {
        loadPurchaseGroups,
      });
      expect(
        (await handler("also-bought", request(`productId=${productId}`)))
          .status,
      ).toBe(404);
      expect(loadPurchaseGroups).not.toHaveBeenCalled();
    },
  );
  it("maps dependency failure to distinct 503s rather than empty results", async () => {
    const catalogFailure = createDiscoveryApi(
      {
        async loadOffers() {
          throw Error("secret");
        },
      },
      mockPurchaseSource,
    );
    expect(await (await catalogFailure("search", request())).json()).toEqual({
      error: {
        code: "CATALOG_UNAVAILABLE",
        message: "Catalog data is temporarily unavailable.",
      },
    });
    const purchaseFailure = createDiscoveryApi(mockOfferSource, {
      async loadPurchaseGroups() {
        throw Error("secret");
      },
    });
    const response = await purchaseFailure(
      "also-bought",
      request("productId=prd_1"),
    );
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe(
      "RECOMMENDATION_DATA_UNAVAILABLE",
    );
  });
});
describe("snapshot integrity", () => {
  it("rejects duplicate products, offers, unknown statuses, invalid URLs and oversized catalogs", () => {
    const offer = createMockOffers()[0];
    for (const input of [
      [offer, offer],
      [offer, { ...offer, offerId: "other" }],
      [{ ...offer, status: "unknown" }],
      [{ ...offer, imageUrls: ["javascript:alert(1)"] }],
      Array(10001).fill(offer),
    ])
      expect(catalogSchema.safeParse(input).success).toBe(false);
  });
  it("shares concurrent loads, retries failure and freezes the snapshot", async () => {
    const loadOffers = vi
      .fn()
      .mockRejectedValueOnce(Error("temporary"))
      .mockResolvedValue(createMockOffers());
    const load = createCatalogLoader({ loadOffers });
    const a = load(),
      b = load();
    expect(a).toBe(b);
    await expect(a).rejects.toThrow("Catalog data");
    const snapshot = await load();
    await load();
    expect(loadOffers).toHaveBeenCalledTimes(2);
    expect(Object.isFrozen(snapshot.offers)).toBe(true);
    expect(Object.isFrozen(snapshot.offers[0].attributes)).toBe(true);
  });
  it("accepts documented query defaults", () =>
    expect(searchQuerySchema.parse({})).toEqual({
      q: "",
      sort: "relevance",
      page: 1,
      pageSize: 20,
    }));
});

describe("boundary and ordering regressions", () => {
  it("sorts prices numerically in both directions and breaks equal prices by name", async () => {
    const handler = api();
    const ascending = (
      await (
        await handler("search", request("category=Electronics&sort=price_asc"))
      ).json()
    ).data.items;
    const descending = (
      await (
        await handler("search", request("category=Electronics&sort=price_desc"))
      ).json()
    ).data.items;
    expect(ascending.map((o: { priceMinor: number }) => o.priceMinor)).toEqual([
      1999, 1999, 2999, 2999, 3999,
    ]);
    expect(descending.map((o: { priceMinor: number }) => o.priceMinor)).toEqual(
      [3999, 2999, 2999, 1999, 1999],
    );
    expect(ascending.slice(0, 2).map((o: { name: string }) => o.name)).toEqual([
      "USB Keyboard",
      "Wireless Mouse",
    ]);
  });
  it("rejects malformed source money, dates and currencies without exposing partial catalogs", async () => {
    for (const patch of [
      { priceMinor: 1.5 },
      { priceMinor: -1 },
      { updatedAt: "yesterday" },
      { currency: "USD" },
    ]) {
      const handler = createDiscoveryApi(
        {
          async loadOffers() {
            return [
              ...createMockOffers().slice(1),
              { ...createMockOffers()[0], ...patch },
            ];
          },
        },
        mockPurchaseSource,
      );
      expect((await handler("search", request())).status).toBe(503);
    }
  });
  it("rejects repeated purchase IDs rather than inflating recommendations", async () => {
    const group = { purchaseId: "duplicate", productIds: ["prd_1", "prd_2"] };
    const handler = createDiscoveryApi(mockOfferSource, {
      async loadPurchaseGroups() {
        return [group, group];
      },
    });
    expect(
      (await handler("also-bought", request("productId=prd_1"))).status,
    ).toBe(503);
  });
  it("validates endpoint-specific limits and required fields", async () => {
    const handler = api();
    expect((await handler("similar", request())).status).toBe(400);
    expect(
      (await handler("similar", request("productId=prd_1&limit=21"))).status,
    ).toBe(400);
    expect(
      (await handler("autocomplete", request("q=mouse&limit=11"))).status,
    ).toBe(400);
    expect((await handler("facets", request("page=1"))).status).toBe(400);
  });
});
