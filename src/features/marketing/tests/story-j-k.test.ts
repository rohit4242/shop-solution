import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type MarketingPromotion } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { promotionCreateSchema } from "../schemas/promotion.schema";
import { validateDiscount } from "../server/services/validate-service";

// Story steps j and k at module level (Level 1): a 10 % promotion for product M1, then a cart with M1.
// M1's real product id comes from the catalog owner; "M1" stands in for it here.

vi.mock("@/server/db", () => ({
  db: {
    marketingDiscountCode: { findUnique: vi.fn() },
    marketingPromotion: { findMany: vi.fn() },
    marketingRedemption: { count: vi.fn() },
  },
}));

const M1 = "M1";
const now = new Date("2026-12-01T10:00:00.000Z");
const m1Promotion = (
  overrides: Partial<MarketingPromotion> = {},
): MarketingPromotion => ({
  id: "7d7f5a3e-1c1b-4c55-9a51-2f4f6f0d9a10",
  name: "M1 10 %",
  description: "10 % off M1 in December",
  type: "percent",
  value: new Prisma.Decimal("10"),
  productIds: [M1],
  categoryIds: [],
  validFrom: new Date("2026-12-01T00:00:00.000Z"),
  validTo: new Date("2026-12-31T23:59:59.000Z"),
  active: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([m1Promotion()]);
});

describe("step j: create the 10 % promotion for M1", () => {
  const input = {
    name: "M1 10 %",
    description: "10 % off M1 in December",
    type: "percent",
    value: 10,
    productIds: [M1],
    validFrom: "2026-12-01T00:00:00.000Z",
    validTo: "2026-12-31T23:59:59.000Z",
  };

  it("accepts a promotion with a period and a product condition", () => {
    expect(promotionCreateSchema.parse(input)).toMatchObject({
      value: 10,
      productIds: [M1],
    });
  });

  it.each([
    ["missing name", { ...input, name: undefined }, "name"],
    [
      "end before start",
      { ...input, validTo: "2026-11-30T00:00:00.000Z" },
      "validTo",
    ],
    ["more than 100 %", { ...input, value: 110 }, "value"],
    ["0 %", { ...input, value: 0 }, "value"],
  ])("rejects %s", (_label, body, field) => {
    const result = promotionCreateSchema.safeParse(body);
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.path.join("."))).toContain(
      field,
    );
  });
});

describe("step k: buy M1 with the promotion", () => {
  const cart = (
    items: { productId: string; unitPrice: number; quantity: number }[],
  ) => ({ currency: "EUR", items });

  it("applies 10 % to M1, rounded half up (59.90 → 5.99)", async () => {
    const result = await validateDiscount(
      cart([{ productId: M1, unitPrice: 59.9, quantity: 1 }]),
      now,
    );
    expect(result).toMatchObject({
      valid: true,
      appliedBy: "promotion",
      discountTotal: 5.99,
      items: [{ productId: M1, discount: 5.99 }],
    });
  });

  it("rounds half up per line (0.05 × 10 % = 0.005 → 0.01)", async () => {
    const result = await validateDiscount(
      cart([{ productId: M1, unitPrice: 0.05, quantity: 1 }]),
      now,
    );
    expect(result.discountTotal).toBe(0.01);
  });

  it("does not discount other products in the same cart", async () => {
    const result = await validateDiscount(
      cart([
        { productId: M1, unitPrice: 59.9, quantity: 1 },
        { productId: "M2", unitPrice: 20, quantity: 1 },
      ]),
      now,
    );
    expect(result.items).toEqual([
      { productId: M1, discount: 5.99 },
      { productId: "M2", discount: 0 },
    ]);
  });

  it("gives nothing for a cart without M1", async () => {
    const result = await validateDiscount(
      cart([{ productId: "M2", unitPrice: 20, quantity: 1 }]),
      now,
    );
    expect(result).toMatchObject({
      valid: true,
      appliedBy: null,
      discountTotal: 0,
    });
  });

  it.each([
    ["before the period", new Date("2026-11-30T23:59:59.000Z")],
    ["after the period", new Date("2027-01-01T00:00:00.000Z")],
  ])("gives nothing %s", async (_label, at) => {
    const result = await validateDiscount(
      cart([{ productId: M1, unitPrice: 59.9, quantity: 1 }]),
      at,
    );
    expect(result).toMatchObject({ appliedBy: null, discountTotal: 0 });
  });

  it("gives nothing once the promotion is deactivated", async () => {
    vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([
      m1Promotion({ active: false }),
    ]);
    const result = await validateDiscount(
      cart([{ productId: M1, unitPrice: 59.9, quantity: 1 }]),
      now,
    );
    expect(result).toMatchObject({ appliedBy: null, discountTotal: 0 });
  });
});
