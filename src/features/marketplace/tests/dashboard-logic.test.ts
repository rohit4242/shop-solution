import { describe, expect, it } from "vitest";
import type { Offer, OfferItem } from "../types/marketplace";
import { formatMoney, parsePriceMinor, parseStock } from "../utils/money";
import {
  changedFields,
  createBody,
  type OfferDraft,
  variationsOf,
} from "../utils/offer-changes";
import { errorText } from "../utils/api-client";

const image = (n: number) => {
  const imageKey = `mkt_seller1_${String(n).padStart(32, "0")}`;
  return { imageKey, imageUrl: `/api/v1/marketplace/images/${imageKey}` };
};
const item = (patch: Partial<OfferItem> = {}): OfferItem => ({
  offerItemId: "item_default",
  productVariantId: "variant_default",
  variantCode: "default",
  label: "Standard",
  priceMinor: 1999,
  currency: "EUR",
  stock: 12,
  available: 12,
  availability: "in_stock",
  images: [image(1)],
  inheritsImages: true,
  ...patch,
});
const offer: Offer = {
  offerId: "offer_mug",
  productId: "product_mug",
  sellerId: "seller1",
  name: "Stoneware mug",
  description: "Hand-thrown.",
  categorySlug: "home-kitchen",
  attributes: {},
  hasVariations: false,
  items: [item()],
  priceMinor: 1999,
  maximumPriceMinor: 1999,
  currency: "EUR",
  stock: 12,
  availability: "in_stock",
  images: [image(1)],
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
  categorySlug: o.categorySlug,
  imageKeys: o.images.map((i) => i.imageKey),
  priceMinor: o.hasVariations ? null : o.items[0].priceMinor,
  stock: o.hasVariations ? null : o.items[0].stock,
  variations: variationsOf(o),
  lengthCm: o.lengthCm,
  widthCm: o.widthCm,
  heightCm: o.heightCm,
  weightGrams: o.weightGrams,
});
const withVariations: Offer = {
  ...offer,
  hasVariations: true,
  items: [
    item({
      offerItemId: "item_s",
      variantCode: "v_s",
      label: "S",
      priceMinor: 1500,
      stock: 2,
    }),
    item({
      offerItemId: "item_m",
      variantCode: "v_m",
      label: "M",
      priceMinor: 1700,
      stock: 1,
      images: [image(2)],
      inheritsImages: false,
    }),
  ],
};

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
  it("reads variations from the items, with own images only", () => {
    expect(variationsOf(offer)).toEqual([]);
    expect(variationsOf(withVariations)).toEqual([
      {
        offerItemId: "item_s",
        label: "S",
        priceMinor: 1500,
        stock: 2,
        imageKeys: [],
      },
      {
        offerItemId: "item_m",
        label: "M",
        priceMinor: 1700,
        stock: 1,
        imageKeys: [image(2).imageKey],
      },
    ]);
    expect(changedFields(withVariations, draftOf(withVariations))).toEqual({});
  });
  it("sends the whole variation list when one variation changes", () => {
    const draft = draftOf(withVariations);
    draft.variations[0] = { ...draft.variations[0], stock: 5 };
    expect(changedFields(withVariations, draft)).toEqual({
      variations: draft.variations,
    });
  });
  it("turning variations off sends an empty list with price and stock", () => {
    expect(
      changedFields(withVariations, {
        ...draftOf(withVariations),
        variations: [],
        priceMinor: 1500,
        stock: 2,
      }),
    ).toEqual({ variations: [], priceMinor: 1500, stock: 2 });
  });
  it("sends new image keys in order", () => {
    expect(
      changedFields(offer, {
        ...draftOf(offer),
        imageKeys: [image(3).imageKey, image(1).imageKey],
      }),
    ).toEqual({ imageKeys: [image(3).imageKey, image(1).imageKey] });
  });
});

describe("createBody", () => {
  it("omits price and stock with variations and empty measurements", () => {
    const body = createBody({
      ...draftOf(offer),
      priceMinor: null,
      stock: null,
      variations: [{ label: "S", priceMinor: 1000, stock: 1, imageKeys: [] }],
    });
    expect(body).not.toHaveProperty("priceMinor");
    expect(body).not.toHaveProperty("stock");
    expect(body).not.toHaveProperty("lengthCm");
    expect(body).toHaveProperty("variations", [
      { label: "S", priceMinor: 1000, stock: 1, imageKeys: [] },
    ]);
  });
});

describe("errorText", () => {
  it("uses the spec texts and a safe fallback", () => {
    expect(errorText({ code: "SELLER_EXISTS", status: 409 })).toBe(
      "Error: You already have a shop.",
    );
    expect(
      errorText({
        code: "VALIDATION_ERROR",
        status: 400,
        message: "categorySlug: Unknown category.",
      }),
    ).toBe("Error: categorySlug: Unknown category.");
    expect(errorText({ code: "SOMETHING_NEW", status: 500 })).toBe(
      "Error: The marketplace service is not available. Please try again later.",
    );
  });
});
