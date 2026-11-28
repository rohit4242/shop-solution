import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import { validateDiscount } from "../server/services/validate-service";
import type { ValidateRequest } from "../schemas/validate.schema";
import { codeRow, promotionRow } from "./fixtures";

// MAR-21 (AC2, AC3): the four cases of src/features/marketing/api/openapi.yaml /discounts/validate, with promotions,
// on the shared shop tables (promotion, discount_code, order_discount).

vi.mock("@/server/db", () => ({
  db: {
    discountCode: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    promotion: { findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    orderDiscount: { count: vi.fn(), create: vi.fn() },
  },
}));

const now = new Date("2026-11-21T12:00:00.000Z");
const PROMO_ID = "promo-auto10";
const CAMPAIGN_ID = "campaign-1";

const codeRecord = (overrides: Parameters<typeof codeRow>[0] = {}) =>
  codeRow({ campaignId: CAMPAIGN_ID, ...overrides });
const promotionRecord = (overrides: Parameters<typeof promotionRow>[0] = {}) =>
  promotionRow({ id: PROMO_ID, ...overrides });

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
  vi.mocked(db.promotion.findMany).mockResolvedValue([promotionRecord()]);
  vi.mocked(db.orderDiscount.count).mockResolvedValue(0);
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
    expect(db.discountCode.findUnique).not.toHaveBeenCalled();
  });

  it("case 1: no code and no promotion → nothing (appliedBy null)", async () => {
    vi.mocked(db.promotion.findMany).mockResolvedValue([]);
    expect(await validateDiscount(request(), now)).toMatchObject({
      valid: true,
      discountTotal: 0,
      appliedBy: null,
      promotionId: null,
    });
  });

  it("case 2: a valid code that gives more wins (appliedBy code, campaignId kept)", async () => {
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(
      codeRecord({ value: "30" }),
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
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(
      codeRecord({ value: "10" }),
    );
    expect(await validateDiscount(request("save"), now)).toMatchObject({
      appliedBy: "code",
      discountTotal: 6.7,
    });
  });

  it("case 3: a valid code but the promotion gives more → promotion, campaignId null", async () => {
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(codeRecord());
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
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(null);
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
    vi.mocked(db.promotion.findMany).mockResolvedValue([]);
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(
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
    vi.mocked(db.promotion.findMany).mockResolvedValue([
      promotionRecord(),
      promotionRecord({
        id: "00000000-0000-4000-8000-000000000002",
        name: "KITCHEN50",
        value: "50",
        categoryIds: ["cat-kitchen"],
      }),
      promotionRecord({
        id: "00000000-0000-4000-8000-000000000003",
        name: "NOWHERE",
        value: "90",
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
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(codeRecord());
    await validateDiscount(request("save"), now);
    expect(vi.mocked(db.promotion.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        automatic: true,
        active: true,
        startsAt: { lte: now },
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
    });
    for (const write of [
      db.discountCode.create,
      db.discountCode.update,
      db.promotion.create,
      db.promotion.update,
      db.orderDiscount.create,
    ]) {
      expect(write).not.toHaveBeenCalled();
    }
  });
});

describe("scoped codes (MAR-21)", () => {
  it("a category-scoped fixed code is split over the eligible lines only", async () => {
    vi.mocked(db.promotion.findMany).mockResolvedValue([]);
    vi.mocked(db.discountCode.findUnique).mockResolvedValue(
      codeRecord({
        type: "fixed",
        value: "10",
        categoryIds: ["cat-kitchen", "cat-accessories"],
      }),
    );
    const validated = await validateDiscount(request("SAVE"), now);
    expect(validated).toMatchObject({
      valid: true,
      appliedBy: "code",
      discountTotal: 10,
    });
    expect(validated.items.map(({ discount }) => discount)).toEqual([
      6.76, 0, 3.24,
    ]);
  });
});
