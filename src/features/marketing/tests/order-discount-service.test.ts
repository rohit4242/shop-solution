/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import {
  getOrderDiscounts,
  recordOrderDiscount,
  toOrderDiscountsDto,
} from "../server/services/order-discount-service";

// Step k → o: the discount stored on order.placed is what Accounting reads for the invoice.

vi.mock("@/server/db", () => ({
  db: { marketingOrderDiscount: { findUnique: vi.fn() } },
}));

const now = new Date("2026-12-01T10:00:00.000Z");
const PROMO_ID = "7d7f5a3e-1c1b-4c55-9a51-2f4f6f0d9a10";
const promotion = {
  id: PROMO_ID,
  name: "M1 10 %",
  description: "",
  type: "percent",
  value: new Prisma.Decimal("10"),
  productIds: ["M1"],
  categoryIds: [],
  validFrom: new Date("2026-12-01T00:00:00.000Z"),
  validTo: null,
  active: true,
};
const code = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  code: "SAVE5",
  type: "fixed",
  value: new Prisma.Decimal("5"),
  currency: "EUR",
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  maxUses: null,
  maxUsesPerCustomer: null,
  minOrderTotal: null,
  active: true,
  productIds: [],
  categoryIds: [],
};
const order = (overrides = {}) => ({
  orderId: "o-1002",
  customerId: "c-42",
  items: [
    { productId: "M1", offerId: "of-1", unitPrice: 59.9, quantity: 1 },
    { productId: "M2", unitPrice: 20, quantity: 1 },
  ],
  total: 73.91,
  currency: "EUR",
  ...overrides,
});

let tx: any;
beforeEach(() => {
  tx = {
    marketingOrderDiscount: {
      findUnique: vi.fn(async () => null),
      create: vi.fn(async () => ({})),
    },
    marketingPromotion: { findMany: vi.fn(async () => [promotion]) },
    marketingDiscountCode: { findUnique: vi.fn(async () => code) },
  };
});

describe("recordOrderDiscount", () => {
  it("without a code stores the best live promotion per line (step k)", async () => {
    expect(await recordOrderDiscount(tx, order(), now)).toEqual({
      recorded: true,
      appliedBy: "promotion",
      discountTotal: 5.99,
    });
    expect(tx.marketingOrderDiscount.create).toHaveBeenCalledWith({
      data: {
        orderId: "o-1002",
        currency: "EUR",
        appliedBy: "promotion",
        promotionId: PROMO_ID,
        discountTotal: "5.99",
        items: [
          { productId: "M1", offerId: "of-1", discount: "5.99" },
          { productId: "M2", offerId: null, discount: "0.00" },
        ],
      },
    });
    // Read inside the event transaction, not through the global client.
    expect(tx.marketingPromotion.findMany).toHaveBeenCalledOnce();
  });

  it("with a code stores the code's discount and no promotion", async () => {
    const result = await recordOrderDiscount(
      tx,
      order({ discountCode: " save5 " }),
      now,
    );
    expect(result).toEqual({
      recorded: true,
      appliedBy: "code",
      discountTotal: 5,
    });
    expect(tx.marketingDiscountCode.findUnique).toHaveBeenCalledWith({
      where: { code: "SAVE5" },
    });
    expect(
      tx.marketingOrderDiscount.create.mock.calls[0][0].data,
    ).toMatchObject({ appliedBy: "code", code: "SAVE5", codeId: code.id });
    expect(tx.marketingPromotion.findMany).not.toHaveBeenCalled();
  });

  it("records nothing for an unknown code (no promotion fallback: Storefront sent a code)", async () => {
    tx.marketingDiscountCode.findUnique.mockResolvedValue(null);
    expect(
      await recordOrderDiscount(tx, order({ discountCode: "NOPE" }), now),
    ).toEqual({ recorded: false, reason: "code_not_found" });
    expect(tx.marketingOrderDiscount.create).not.toHaveBeenCalled();
  });

  it("records nothing when no promotion applies", async () => {
    tx.marketingPromotion.findMany.mockResolvedValue([]);
    expect(await recordOrderDiscount(tx, order(), now)).toEqual({
      recorded: false,
      reason: "no_discount",
    });
    expect(tx.marketingOrderDiscount.create).not.toHaveBeenCalled();
  });

  it("is idempotent per order", async () => {
    tx.marketingOrderDiscount.findUnique.mockResolvedValue({ id: "x" });
    expect(await recordOrderDiscount(tx, order(), now)).toEqual({
      recorded: false,
      reason: "already_recorded",
    });
    expect(tx.marketingOrderDiscount.create).not.toHaveBeenCalled();
  });
});

describe("GET /orders/{orderId}/discounts shape", () => {
  const row = {
    orderId: "o-1002",
    appliedBy: "promotion" as const,
    code: null,
    promotionId: PROMO_ID,
    currency: "EUR",
    discountTotal: new Prisma.Decimal("5.99"),
    items: [{ productId: "M1", offerId: null, discount: "5.99" }],
  };

  it("matches OrderDiscounts in the contract", () => {
    expect(toOrderDiscountsDto(row)).toEqual({
      orderId: "o-1002",
      currency: "EUR",
      appliedBy: "promotion",
      code: null,
      promotionId: PROMO_ID,
      discountTotal: 5.99,
      items: [
        {
          productId: "M1",
          offerId: null,
          discount: 5.99,
          fundedBy: "platform",
        },
      ],
    });
  });

  it("returns null for an order without a discount", async () => {
    vi.mocked(db.marketingOrderDiscount.findUnique).mockResolvedValue(null);
    expect(await getOrderDiscounts("o-unknown")).toBeNull();
  });
});
