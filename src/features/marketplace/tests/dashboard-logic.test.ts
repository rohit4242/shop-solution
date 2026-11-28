import { describe, expect, it } from "vitest";
import type { Offer } from "../types/marketplace";
import { formatMoney, parsePriceMinor, parseStock } from "../utils/money";
import {
  changedFields,
  createBody,
  type OfferDraft,
} from "../utils/offer-changes";
import { errorText } from "../utils/api-client";

const offer: Offer = {
  offerId: "off_mug",
  productId: "prd_mug",
  sellerId: "sel_anna",
  name: "Stoneware mug",
  description: "Hand-thrown.",
  category: "home_kitchen",
  attributes: {},
  priceMinor: 1999,
  startingPriceMinor: 1999,
  maximumPriceMinor: 1999,
  currency: "EUR",
  stock: 12,
  availability: "in_stock",
  imageIds: ["img_a"],
  imageUrls: ["/api/v1/marketplace/images/img_a"],
  variations: [],
  lengthCm: null,
  widthCm: null,
  heightCm: null,
  weightGrams: null,
  status: "active",
  statusReason: null,
  updatedAt: "2026-11-27T09:00:00.000Z",
};
const draftOf = (o: Offer): OfferDraft => ({
  name: o.name,
  description: o.description,
  category: o.category,
  imageIds: o.imageIds,
  priceMinor: o.variations.length ? null : o.priceMinor,
  stock: o.variations.length ? null : o.stock,
  variations: o.variations.map((v) => ({
    variationId: v.variationId,
    label: v.label,
    priceMinor: v.priceMinor,
    stock: v.stock,
    imageIds: v.imageIds,
  })),
  lengthCm: o.lengthCm,
  widthCm: o.widthCm,
  heightCm: o.heightCm,
  weightGrams: o.weightGrams,
});

describe("money", () => {
  it.each([
    ["24.90", 2490],
    ["24,9", 2490],
    ["24", 2400],
    ["0.05", 5],
  ])("parses %s as %i cents", (text, minor) =>
    expect(parsePriceMinor(text)).toBe(minor),
  );
  it.each(["abc", "24.999", "-1", "1e3", ""])("rejects %s", (text) =>
    expect(parsePriceMinor(text)).toBeNull(),
  );
  it("formats and parses stock", () => {
    expect(formatMoney(5997)).toBe("59.97 EUR");
    expect(parseStock("9")).toBe(9);
    expect(parseStock("1.5")).toBeNull();
  });
});

describe("changedFields (edit sends only what changed)", () => {
  it("sends nothing when nothing changed", () => {
    expect(changedFields(offer, draftOf(offer))).toEqual({});
  });
  it("sends exactly the stock when only the stock changed", () => {
    expect(changedFields(offer, { ...draftOf(offer), stock: 9 })).toEqual({
      stock: 9,
    });
  });
  it("clears a measurement with null and sets a new one", () => {
    const measured = { ...offer, weightGrams: 350 };
    expect(
      changedFields(measured, {
        ...draftOf(measured),
        weightGrams: null,
        lengthCm: 10,
      }),
    ).toEqual({
      weightGrams: null,
      lengthCm: 10,
    });
  });
  it("turning variations off sends an empty list with price and stock", () => {
    const withVariations: Offer = {
      ...offer,
      variations: [
        {
          variationId: "var_1",
          label: "S",
          priceMinor: 1500,
          currency: "EUR",
          stock: 2,
          availability: "in_stock",
          imageIds: [],
          imageUrls: [],
          inheritsImages: true,
        },
      ],
    };
    expect(
      changedFields(withVariations, {
        ...draftOf(withVariations),
        variations: [],
        priceMinor: 1500,
        stock: 2,
      }),
    ).toEqual({ variations: [], priceMinor: 1500, stock: 2 });
  });
});

describe("createBody", () => {
  it("omits price and stock with variations and empty measurements", () => {
    const body = createBody({
      ...draftOf(offer),
      priceMinor: null,
      stock: null,
      variations: [{ label: "S", priceMinor: 1000, stock: 1, imageIds: [] }],
    });
    expect(body).not.toHaveProperty("priceMinor");
    expect(body).not.toHaveProperty("stock");
    expect(body).not.toHaveProperty("lengthCm");
    expect(body).toHaveProperty("variations", [
      { label: "S", priceMinor: 1000, stock: 1, imageIds: [] },
    ]);
  });
});

describe("errorText", () => {
  it("uses the spec texts and a safe fallback", () => {
    expect(errorText({ code: "SELLER_EXISTS", status: 409 })).toBe(
      "Error: You already have a shop.",
    );
    expect(errorText({ code: "SOMETHING_NEW", status: 500 })).toBe(
      "Error: The marketplace service is not available. Please try again later.",
    );
  });
});
