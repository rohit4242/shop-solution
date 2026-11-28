import { describe, expect, it } from "vitest";
import { validateRequestSchema } from "../schemas/validate.schema";

const body = {
  currency: "EUR",
  items: [{ productId: "p-1", unitPrice: 29.95, quantity: 2 }],
};
const withItem = (change: object) => ({
  ...body,
  items: [{ ...body.items[0], ...change }],
});

describe("validateRequestSchema", () => {
  it("accepts a full request", () => {
    const result = validateRequestSchema.safeParse({
      ...withItem({ offerId: "o-1", sellerId: "s-1" }),
      code: " welcome10 ",
      customerId: "c-42",
      attributionToken: "token",
    });
    expect(result.success).toBe(true);
    expect(result.data?.code).toBe("welcome10");
  });

  it.each(["", "   "])("treats the code %j as absent", (code) => {
    expect(validateRequestSchema.parse({ ...body, code }).code).toBeUndefined();
  });

  it("strips unknown fields inside an item", () => {
    const parsed = validateRequestSchema.parse(withItem({ color: "red" }));
    expect(parsed.items[0]).toEqual(body.items[0]);
  });

  it.each([
    ["missing items", "items", { currency: "EUR" }],
    ["empty items", "items", { ...body, items: [] }],
    ["missing currency", "currency", { items: body.items }],
    ["lowercase currency", "currency", { ...body, currency: "eur" }],
    ["quantity 0", "items.0.quantity", withItem({ quantity: 0 })],
    ["fractional quantity", "items.0.quantity", withItem({ quantity: 1.5 })],
    ["negative price", "items.0.unitPrice", withItem({ unitPrice: -1 })],
    ["3-decimal price", "items.0.unitPrice", withItem({ unitPrice: 1.999 })],
    ["empty productId", "items.0.productId", withItem({ productId: "" })],
    ["unknown top-level field", "", { ...body, coupon: "X" }],
  ])("rejects %s", (_name, path, input) => {
    const result = validateRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].path.join(".")).toBe(path);
  });
});
