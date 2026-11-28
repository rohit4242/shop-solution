import { describe, expect, it } from "vitest";
import {
  assertDistinctImages,
  decodeCursor,
  detectImageType,
  encodeCursor,
  isPublic,
  planNewItems,
  planOfferUpdate,
  sellerOfImageKey,
  totals,
  type ItemState,
  type OfferState,
} from "../server/services/rules";
import { createOfferSchema } from "../schemas/marketplace.schema";
import { MarketplaceError } from "../server/errors";

const key = (n: number) => `mkt_seller1_${String(n).padStart(32, "0")}`;

const defaultItem: ItemState = {
  id: "item_default",
  label: "Standard",
  isDefault: true,
  priceMinor: 1999,
  stock: 12,
  held: 0,
  imageKeys: [],
};
const variation = (id: string, patch: Partial<ItemState> = {}): ItemState => ({
  id,
  label: id.toUpperCase(),
  isDefault: false,
  priceMinor: 1500,
  stock: 3,
  held: 0,
  imageKeys: [],
  ...patch,
});

const offer = (patch: Partial<OfferState> = {}): OfferState => ({
  status: "active",
  name: "Stoneware mug",
  description: "Hand-thrown.",
  categorySlug: "home-kitchen",
  attributes: { colour: "sand" },
  imageKeys: [key(1)],
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  weightGrams: null,
  items: [defaultItem],
  ...patch,
});

function codeOf(run: () => unknown) {
  try {
    run();
  } catch (error) {
    if (error instanceof MarketplaceError) return error.code;
    throw error;
  }
  return null;
}

describe("public visibility", () => {
  it("needs an active offer, an active shop and an active product", () => {
    expect(isPublic("active", "active", "active")).toBe(true);
    expect(isPublic("active", "pending", "active")).toBe(false);
    expect(isPublic("active", "suspended", "active")).toBe(false);
    expect(isPublic("pending", "active", "active")).toBe(false);
    expect(isPublic("active", "active", "draft")).toBe(false);
    expect(isPublic("active", "active", "archived")).toBe(false);
  });
});

describe("new offers", () => {
  const base = {
    name: "Mug",
    description: "",
    categorySlug: "home-kitchen",
    imageKeys: [key(1)],
  };
  it("gets one default item without variations", () => {
    const items = planNewItems(
      createOfferSchema.parse({ ...base, priceMinor: 999, stock: 4 }),
    );
    expect(items).toEqual([
      expect.objectContaining({
        id: null,
        isDefault: true,
        priceMinor: 999,
        stock: 4,
      }),
    ]);
  });
  it("gets one item per variation, with its own price and stock", () => {
    const items = planNewItems(
      createOfferSchema.parse({
        ...base,
        variations: [
          { label: "S", priceMinor: 1000, stock: 1 },
          { label: "M", priceMinor: 1200, stock: 0, imageKeys: [key(2)] },
        ],
      }),
    );
    expect(items.map((i) => [i.label, i.isDefault, i.priceMinor])).toEqual([
      ["S", false, 1000],
      ["M", false, 1200],
    ]);
  });
  it("refuses an image used twice in one offer", () => {
    expect(
      codeOf(() =>
        assertDistinctImages(
          [key(1)],
          [{ imageKeys: [key(2)] }, { imageKeys: [key(1)] }],
        ),
      ),
    ).toBe("VALIDATION_ERROR");
  });
});

describe("totals", () => {
  it("uses the cheapest and dearest item and sums stock and availability", () => {
    expect(
      totals([
        { priceMinor: 1500, stock: 2, available: 1 },
        { priceMinor: 1200, stock: 0, available: 0 },
        { priceMinor: 1800, stock: 5, available: 5 },
      ]),
    ).toEqual({
      priceMinor: 1200,
      maximumPriceMinor: 1800,
      stock: 7,
      available: 6,
    });
  });
});

describe("planOfferUpdate: review on edit", () => {
  it("keeps an active offer live when only price or stock change", () => {
    const plan = planOfferUpdate(offer(), { priceMinor: 2499, stock: 3 });
    expect(plan.status).toBe("active");
    expect(plan.statusReason).toBeUndefined();
    expect(plan.productChanged).toBe(false);
    expect(plan.items).toEqual([
      expect.objectContaining({
        id: "item_default",
        priceMinor: 2499,
        stock: 3,
      }),
    ]);
  });
  it.each([
    ["name", { name: "Big mug" }, true],
    ["category", { categorySlug: "other" }, true],
    ["attributes", { attributes: { colour: "blue" } }, true],
    ["measurement", { weightGrams: 350 }, true],
    ["images", { imageKeys: [key(2)] }, false],
  ])(
    "sends an active offer back to review when the %s changes",
    (_, input, productChanged) => {
      const plan = planOfferUpdate(offer(), input);
      expect(plan.status).toBe("pending");
      expect(plan.statusReason).toBeNull();
      expect(plan.productChanged).toBe(productChanged);
    },
  );
  it("sends it back to review when a variation label changes", () => {
    const current = offer({ items: [variation("s"), variation("m")] });
    const plan = planOfferUpdate(current, {
      variations: [
        {
          offerItemId: "s",
          label: "Small",
          priceMinor: 1500,
          stock: 3,
          imageKeys: [],
        },
        {
          offerItemId: "m",
          label: "M",
          priceMinor: 1500,
          stock: 3,
          imageKeys: [],
        },
      ],
    });
    expect(plan.status).toBe("pending");
  });
  it("keeps it live when only variation prices and stock change", () => {
    const current = offer({ items: [variation("s", { label: "S" })] });
    const plan = planOfferUpdate(current, {
      variations: [
        {
          offerItemId: "s",
          label: "S",
          priceMinor: 999,
          stock: 7,
          imageKeys: [],
        },
      ],
    });
    expect(plan.status).toBe("active");
    expect(plan.deactivate).toEqual([]);
  });
  it("resubmits a rejected offer on any edit, even stock", () => {
    const plan = planOfferUpdate(offer({ status: "rejected" }), { stock: 1 });
    expect(plan.status).toBe("pending");
    expect(plan.statusReason).toBeNull();
  });
  it("leaves a pending offer pending", () => {
    expect(
      planOfferUpdate(offer({ status: "pending" }), { name: "X" }).status,
    ).toBe("pending");
  });
  it.each(["blocked", "removed"] as const)("locks a %s offer", (status) => {
    expect(codeOf(() => planOfferUpdate(offer({ status }), { stock: 1 }))).toBe(
      "OFFER_LOCKED",
    );
  });
});

describe("planOfferUpdate: offer items", () => {
  it("turns variations on: new items, the default item is deactivated", () => {
    const plan = planOfferUpdate(offer(), {
      variations: [
        { label: "S", priceMinor: 1000, stock: 1, imageKeys: [] },
        { label: "M", priceMinor: 1100, stock: 2, imageKeys: [] },
      ],
    });
    expect(plan.items.map((i) => [i.id, i.label, i.isDefault])).toEqual([
      [null, "S", false],
      [null, "M", false],
    ]);
    expect(plan.deactivate).toEqual(["item_default"]);
    expect(plan.status).toBe("pending");
  });
  it("turns variations off: one default item with the given price and stock", () => {
    const current = offer({ items: [variation("s"), variation("m")] });
    const plan = planOfferUpdate(current, {
      variations: [],
      priceMinor: 1500,
      stock: 6,
    });
    expect(plan.items).toEqual([
      expect.objectContaining({
        id: null,
        isDefault: true,
        priceMinor: 1500,
        stock: 6,
      }),
    ]);
    expect(plan.deactivate).toEqual(["s", "m"]);
  });
  it("needs price and stock to turn variations off", () => {
    const current = offer({ items: [variation("s")] });
    expect(
      codeOf(() => planOfferUpdate(current, { variations: [], stock: 1 })),
    ).toBe("VALIDATION_ERROR");
  });
  it("deactivates removed variations instead of deleting them", () => {
    const current = offer({ items: [variation("s"), variation("m")] });
    const plan = planOfferUpdate(current, {
      variations: [
        {
          offerItemId: "m",
          label: "M",
          priceMinor: 1500,
          stock: 3,
          imageKeys: [],
        },
      ],
    });
    expect(plan.items.map((i) => i.id)).toEqual(["m"]);
    expect(plan.deactivate).toEqual(["s"]);
  });
  it("refuses unknown, repeated or default-item IDs as variations", () => {
    const current = offer({ items: [variation("s")] });
    const row = { label: "S", priceMinor: 1, stock: 1, imageKeys: [] };
    for (const ids of [["nope"], ["s", "s"]])
      expect(
        codeOf(() =>
          planOfferUpdate(current, {
            variations: ids.map((offerItemId) => ({ ...row, offerItemId })),
          }),
        ),
      ).toBe("VALIDATION_ERROR");
    expect(
      codeOf(() =>
        planOfferUpdate(offer(), {
          variations: [{ ...row, offerItemId: "item_default" }],
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });
  it("refuses an offer-level price or stock while variations exist", () => {
    const current = offer({ items: [variation("s")] });
    expect(codeOf(() => planOfferUpdate(current, { stock: 4 }))).toBe(
      "VALIDATION_ERROR",
    );
    expect(codeOf(() => planOfferUpdate(current, { priceMinor: 4 }))).toBe(
      "VALIDATION_ERROR",
    );
  });
  it("never sets stock below what open checkouts hold", () => {
    const current = offer({ items: [{ ...defaultItem, stock: 5, held: 2 }] });
    expect(codeOf(() => planOfferUpdate(current, { stock: 1 }))).toBe(
      "STOCK_BELOW_HELD",
    );
    expect(planOfferUpdate(current, { stock: 2 }).items[0].stock).toBe(2);
  });
  it("refuses an image used both on the offer and on a variation", () => {
    const current = offer({ items: [variation("s")] });
    expect(
      codeOf(() =>
        planOfferUpdate(current, {
          variations: [
            {
              offerItemId: "s",
              label: "S",
              priceMinor: 1,
              stock: 1,
              imageKeys: [key(1)],
            },
          ],
        }),
      ),
    ).toBe("VALIDATION_ERROR");
  });
});

describe("image keys", () => {
  it("names the seller they were issued to", () => {
    expect(sellerOfImageKey(key(7))).toBe("seller1");
    expect(sellerOfImageKey("mkt_cm3k9x2ab0001_" + "f".repeat(32))).toBe(
      "cm3k9x2ab0001",
    );
    expect(sellerOfImageKey("../etc/passwd")).toBeNull();
    expect(sellerOfImageKey("mkt_x_short")).toBeNull();
  });
  it("detects JPG, PNG and WEBP signatures only", () => {
    const pad = (bytes: number[]) =>
      new Uint8Array([...bytes, ...new Array(12).fill(0)]);
    expect(detectImageType(pad([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(
      detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBe("image/png");
    expect(
      detectImageType(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
    ).toBe("image/webp");
    expect(detectImageType(pad([0x47, 0x49, 0x46]))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8]))).toBeNull();
  });
});

describe("catalog cursor", () => {
  it("round-trips canonical IDs", () => {
    const at = new Date("2026-11-27T09:00:00.000Z");
    expect(decodeCursor(encodeCursor(at, "cm3k9x2ab0002qz8l9c1d3f4g"))).toEqual(
      { updatedAt: at, offerId: "cm3k9x2ab0002qz8l9c1d3f4g" },
    );
  });
  it("rejects a cursor that was changed", () => {
    expect(codeOf(() => decodeCursor("bm9wZQ"))).toBe("VALIDATION_ERROR");
  });
});
