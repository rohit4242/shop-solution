import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  Prisma,
  type MarketingDiscountCode as DiscountCode,
  type MarketingPromotion as Promotion,
} from "@/generated/prisma/client";
import { db } from "@/server/db";
import { validateDiscount } from "../server/services/validate-service";
import { recordRedemptionForOrder } from "../server/services/redemption-service";
import type { ValidateRequest } from "../schemas/validate.schema";

// MAR-21 (AC2, AC3): the four cases of contracts/marketing.yaml /discounts/validate, with promotions.

vi.mock("@/server/db", () => ({
  db: {
    marketingDiscountCode: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    marketingPromotion: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    marketingRedemption: { count: vi.fn(), create: vi.fn() },
  },
}));

const now = new Date("2026-11-21T12:00:00.000Z");
const PROMO_ID = "7d7f5a3e-1c1b-4c55-9a51-2f4f6f0d9a10";
const CAMPAIGN_ID = "550e8400-e29b-41d4-a716-446655440001";

const codeRecord = (overrides: Partial<DiscountCode> = {}): DiscountCode => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  code: "SAVE",
  type: "percent",
  value: new Prisma.Decimal("5"),
  currency: "EUR",
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  maxUses: null,
  maxUsesPerCustomer: null,
  minOrderTotal: null,
  active: true,
  campaignId: CAMPAIGN_ID,
  productIds: [],
  categoryIds: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const promotionRecord = (overrides: Partial<Promotion> = {}): Promotion => ({
  id: PROMO_ID,
  name: "AUTO10",
  description: "10 % off everything",
  type: "percent",
  value: new Prisma.Decimal("10"),
  productIds: [],
  categoryIds: [],
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  active: true,
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const items = [
  { productId: "p-1", categoryId: "cat-kitchen", unitPrice: 12.5, quantity: 2 },
  {
    productId: "p-2",
    categoryId: "cat-apparel",
    unitPrice: 29.95,
    quantity: 1,
  },
  {
    productId: "p-3",
    categoryId: "cat-accessories",
    unitPrice: 3,
    quantity: 4,
  },
];
const request = (code?: string): ValidateRequest => ({
  ...(code ? { code } : {}),
  currency: "EUR",
  items,
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([
    promotionRecord(),
  ]);
  vi.mocked(db.marketingRedemption.count).mockResolvedValue(0);
});

describe("validate with automatic promotions (MAR-21)", () => {
  it("case 1: no code → the best promotion applies (appliedBy promotion)", async () => {
    expect(await validateDiscount(request(), now)).toEqual({
      valid: true,
      discountTotal: 6.7,
      currency: "EUR",
      campaignId: null,
      appliedBy: "promotion",
      promotionId: PROMO_ID,
      items: [
        { productId: "p-1", discount: 2.5 },
        { productId: "p-2", discount: 3 },
        { productId: "p-3", discount: 1.2 },
      ],
    });
    expect(db.marketingDiscountCode.findUnique).not.toHaveBeenCalled();
  });

  it("case 1: no code and no promotion → nothing (appliedBy null)", async () => {
    vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([]);
    expect(await validateDiscount(request(), now)).toMatchObject({
      valid: true,
      discountTotal: 0,
      appliedBy: null,
      promotionId: null,
    });
  });

  it("case 2: a valid code that gives more wins (appliedBy code, campaignId kept)", async () => {
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(
      codeRecord({ value: new Prisma.Decimal("30") }),
    );
    expect(await validateDiscount(request("save"), now)).toMatchObject({
      valid: true,
      discountTotal: 20.09,
      appliedBy: "code",
      promotionId: null,
      campaignId: CAMPAIGN_ID,
    });
  });

  it("case 2: on a tie the code wins", async () => {
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(
      codeRecord({ value: new Prisma.Decimal("10") }),
    );
    expect(await validateDiscount(request("save"), now)).toMatchObject({
      appliedBy: "code",
      discountTotal: 6.7,
    });
  });

  it("case 3: a valid code but the promotion gives more → promotion, campaignId null", async () => {
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(
      codeRecord(),
    );
    const result = await validateDiscount(request("save"), now);
    expect(result).toMatchObject({
      valid: true,
      appliedBy: "promotion",
      promotionId: PROMO_ID,
      campaignId: null,
      discountTotal: 6.7,
    });
    expect(result).not.toHaveProperty("reasonCode");
  });

  it("case 4: invalid code → valid false, zero discounts, plus the promotion object", async () => {
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(null);
    expect(await validateDiscount(request("nope"), now)).toEqual({
      valid: false,
      reasonCode: "code_not_found",
      discountTotal: 0,
      currency: "EUR",
      campaignId: null,
      appliedBy: null,
      promotionId: null,
      items: [
        { productId: "p-1", discount: 0 },
        { productId: "p-2", discount: 0 },
        { productId: "p-3", discount: 0 },
      ],
      promotion: {
        promotionId: PROMO_ID,
        name: "AUTO10",
        discountTotal: 6.7,
        items: [
          { productId: "p-1", discount: 2.5 },
          { productId: "p-2", discount: 3 },
          { productId: "p-3", discount: 1.2 },
        ],
      },
    });
  });

  it("case 4 without a promotion has no promotion field", async () => {
    vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([]);
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(
      codeRecord({ productIds: ["p-999"] }),
    );
    const result = await validateDiscount(request("save"), now);
    expect(result).toMatchObject({
      valid: false,
      reasonCode: "no_eligible_items",
    });
    expect(result).not.toHaveProperty("promotion");
  });

  it("picks the biggest of several promotions and skips ones that do not apply", async () => {
    vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([
      promotionRecord(),
      promotionRecord({
        id: "00000000-0000-4000-8000-000000000002",
        name: "KITCHEN50",
        value: new Prisma.Decimal("50"),
        categoryIds: ["cat-kitchen"],
      }),
      promotionRecord({
        id: "00000000-0000-4000-8000-000000000003",
        name: "NOWHERE",
        value: new Prisma.Decimal("90"),
        productIds: ["p-999"],
      }),
    ]);
    expect(await validateDiscount(request(), now)).toMatchObject({
      appliedBy: "promotion",
      promotionId: "00000000-0000-4000-8000-000000000002",
      discountTotal: 12.5,
    });
  });

  it("loads only promotions live now and stays read-only", async () => {
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(
      codeRecord(),
    );
    await validateDiscount(request("save"), now);
    expect(
      vi.mocked(db.marketingPromotion.findMany).mock.calls[0][0],
    ).toMatchObject({
      where: {
        active: true,
        validFrom: { lte: now },
        OR: [{ validTo: null }, { validTo: { gte: now } }],
      },
    });
    for (const write of [
      db.marketingDiscountCode.create,
      db.marketingDiscountCode.update,
      db.marketingPromotion.create,
      db.marketingPromotion.update,
      db.marketingRedemption.create,
    ]) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});

describe("shared mapper: redeemed amount equals validated amount (MAR-21)", () => {
  it("for a category-scoped code, order.placed redeems exactly what validate showed", async () => {
    vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([]);
    const scoped = codeRecord({
      type: "fixed",
      value: new Prisma.Decimal("10"),
      categoryIds: ["cat-kitchen", "cat-accessories"],
    });
    vi.mocked(db.marketingDiscountCode.findUnique).mockResolvedValue(scoped);
    const validated = await validateDiscount(request("SAVE"), now);
    expect(validated).toMatchObject({
      valid: true,
      appliedBy: "code",
      discountTotal: 10,
    });
    expect(validated.items.map(({ discount }) => discount)).toEqual([
      6.76, 0, 3.24,
    ]);

    const tx = {
      marketingDiscountCode: { findUnique: vi.fn(async () => scoped) },
      marketingRedemption: {
        findUnique: vi.fn(async () => null),
        count: vi.fn(async () => 0),
        create: vi.fn(async () => ({ id: "r-1" })),
      },
    };
    await recordRedemptionForOrder(
      tx as never,
      { orderId: "o-1", items, currency: "EUR", discountCode: "SAVE" },
      now,
    );
    const created = tx.marketingRedemption.create.mock.calls[0] as unknown as [
      { data: { discountTotal: string } },
    ];
    expect(created[0].data.discountTotal).toBe(
      validated.discountTotal.toFixed(2),
    );
  });
});
