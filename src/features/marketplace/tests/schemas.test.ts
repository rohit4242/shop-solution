import { describe, expect, it } from "vitest";
import {
  catalogQuerySchema,
  createOfferSchema,
  registerSellerSchema,
  updateOfferSchema,
  updateSellerSchema,
} from "../schemas/marketplace.schema";

const image = "mkt_cm3k9x2ab0001_" + "a".repeat(32);
const shop = {
  displayName: "Ben's Books",
  legalName: "Ben Becker e.K.",
  contactEmail: "ben@example.com",
  address: {
    street: "Hauptstr. 1",
    postalCode: "10115",
    city: "Berlin",
    country: "DE",
  },
};
const product = {
  name: "Stoneware mug",
  description: "",
  categorySlug: "home-kitchen",
  imageKeys: [image],
  priceMinor: 1999,
  stock: 5,
};

describe("registerSellerSchema", () => {
  it("accepts a complete shop and never a browser-supplied user ID", () => {
    expect(registerSellerSchema.safeParse(shop).success).toBe(true);
    expect(
      registerSellerSchema.safeParse({ ...shop, userId: "usr_x" }).success,
    ).toBe(false);
  });
  it("rejects a bad e-mail and a lower-case country", () => {
    expect(
      registerSellerSchema.safeParse({
        ...shop,
        contactEmail: "ben-at-example",
      }).success,
    ).toBe(false);
    expect(
      registerSellerSchema.safeParse({
        ...shop,
        address: { ...shop.address, country: "de" },
      }).success,
    ).toBe(false);
  });
  it("needs at least one field to update", () => {
    expect(updateSellerSchema.safeParse({}).success).toBe(false);
    expect(
      updateSellerSchema.safeParse({ contactEmail: "new@example.com" }).success,
    ).toBe(true);
  });
});

describe("createOfferSchema", () => {
  it("accepts a simple product", () => {
    expect(createOfferSchema.safeParse(product).success).toBe(true);
  });
  it("needs price and stock without variations", () => {
    expect(
      createOfferSchema.safeParse({ ...product, priceMinor: undefined })
        .success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...product, stock: undefined }).success,
    ).toBe(false);
  });
  it("refuses a product price or stock next to variations", () => {
    const variations = [{ label: "S", priceMinor: 1000, stock: 1 }];
    expect(
      createOfferSchema.safeParse({
        ...product,
        priceMinor: undefined,
        stock: undefined,
        variations,
      }).success,
    ).toBe(true);
    expect(
      createOfferSchema.safeParse({ ...product, variations }).success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...product, stock: undefined, variations })
        .success,
    ).toBe(false);
  });
  it("refuses an existing item ID in a new offer", () => {
    expect(
      createOfferSchema.safeParse({
        ...product,
        priceMinor: undefined,
        stock: undefined,
        variations: [
          { offerItemId: "cm3k", label: "S", priceMinor: 1000, stock: 1 },
        ],
      }).success,
    ).toBe(false);
  });
  it("needs 1–10 distinct image keys, a category slug and a positive whole price", () => {
    expect(
      createOfferSchema.safeParse({ ...product, imageKeys: [] }).success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...product, imageKeys: [image, image] })
        .success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...product, imageKeys: ["img_old"] })
        .success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({
        ...product,
        categorySlug: "Home & Kitchen",
      }).success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...product, priceMinor: 0 }).success,
    ).toBe(false);
    expect(
      createOfferSchema.safeParse({ ...product, priceMinor: 19.99 }).success,
    ).toBe(false);
  });
  it("rejects unknown fields", () => {
    expect(
      createOfferSchema.safeParse({ ...product, status: "active" }).success,
    ).toBe(false);
  });
});

describe("updateOfferSchema", () => {
  it("needs a change and refuses price or stock next to variations", () => {
    expect(updateOfferSchema.safeParse({}).success).toBe(false);
    expect(updateOfferSchema.safeParse({ stock: 9 }).success).toBe(true);
    expect(
      updateOfferSchema.safeParse({
        stock: 9,
        variations: [{ label: "S", priceMinor: 1, stock: 1 }],
      }).success,
    ).toBe(false);
    expect(
      updateOfferSchema.safeParse({
        priceMinor: 9,
        variations: [{ label: "S", priceMinor: 1, stock: 1 }],
      }).success,
    ).toBe(false);
    expect(
      updateOfferSchema.safeParse({ variations: [], priceMinor: 9, stock: 1 })
        .success,
    ).toBe(true);
  });
});

describe("catalog queries", () => {
  it("needs a time zone in updatedSince and caps the page size", () => {
    expect(catalogQuerySchema.parse({}).limit).toBe(100);
    expect(
      catalogQuerySchema.safeParse({ updatedSince: "2026-11-20T00:00:00" })
        .success,
    ).toBe(false);
    expect(
      catalogQuerySchema.safeParse({ updatedSince: "2026-11-20T00:00:00Z" })
        .success,
    ).toBe(true);
    expect(catalogQuerySchema.safeParse({ limit: "201" }).success).toBe(false);
  });
});
