import { describe, expect, it } from "vitest";
import { money, sum } from "../utils/money";
import {
  VALIDATE_REASON_CODES,
  calculateDiscount,
  checkEligibility,
  isLineEligible,
  isPromotionLive,
  promotionDiscount,
  selectBestDiscount,
  type RuleCode,
  type RuleItem,
  type RulePromotion,
} from "../server/services/discount-rules";

// MAR-21: scoped codes (AC1), promotions (AC2) and "biggest wins, no stacking" (AC3). Pure, no database.

const now = new Date("2026-11-21T12:00:00.000Z");
const mug: RuleItem = {
  productId: "p-1",
  categoryId: "cat-kitchen",
  unitPrice: 12.5,
  quantity: 2,
}; // 25.00
const shirt: RuleItem = {
  productId: "p-2",
  categoryId: "cat-apparel",
  unitPrice: 29.95,
  quantity: 1,
}; // 29.95
const sticker: RuleItem = { productId: "p-3", unitPrice: 3, quantity: 4 }; // 12.00, no category
const cart = [mug, shirt, sticker];

const code = (overrides: Partial<RuleCode> = {}): RuleCode => ({
  type: "percent",
  value: "20",
  currency: "EUR",
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  minOrderTotal: null,
  active: true,
  ...overrides,
});

const promotion = (overrides: Partial<RulePromotion> = {}): RulePromotion => ({
  id: "00000000-0000-4000-8000-000000000001",
  name: "AUTO10",
  type: "percent",
  value: "10",
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  active: true,
  productIds: [],
  categoryIds: [],
  ...overrides,
});

const lines = (result: ReturnType<typeof calculateDiscount>) =>
  result.items.map(({ discount }) => discount.toFixed(2));

describe("isLineEligible (AC1)", () => {
  it("empty scope = whole cart, also when the lists are missing", () => {
    expect(isLineEligible(sticker, {})).toBe(true);
    expect(isLineEligible(sticker, { productIds: [], categoryIds: [] })).toBe(
      true,
    );
  });

  it("matches by productId, by categoryId, or either", () => {
    expect(isLineEligible(mug, { productIds: ["p-1"] })).toBe(true);
    expect(isLineEligible(mug, { categoryIds: ["cat-kitchen"] })).toBe(true);
    expect(
      isLineEligible(shirt, {
        productIds: ["p-1"],
        categoryIds: ["cat-apparel"],
      }),
    ).toBe(true);
    expect(
      isLineEligible(shirt, {
        productIds: ["p-1"],
        categoryIds: ["cat-kitchen"],
      }),
    ).toBe(false);
  });

  it("a line without categoryId never matches a category", () => {
    expect(
      isLineEligible(sticker, { categoryIds: ["cat-kitchen", "cat-apparel"] }),
    ).toBe(false);
  });
});

describe("calculateDiscount with a scope (AC1)", () => {
  it("scoped percent: only eligible lines are discounted (product, category, either)", () => {
    expect(
      lines(
        calculateDiscount(
          { type: "percent", value: "20", productIds: ["p-2"] },
          cart,
        ),
      ),
    ).toEqual(["0.00", "5.99", "0.00"]);
    expect(
      lines(
        calculateDiscount(
          { type: "percent", value: "20", categoryIds: ["cat-kitchen"] },
          cart,
        ),
      ),
    ).toEqual(["5.00", "0.00", "0.00"]);
    expect(
      lines(
        calculateDiscount(
          {
            type: "percent",
            value: "20",
            productIds: ["p-3"],
            categoryIds: ["cat-kitchen"],
          },
          cart,
        ),
      ),
    ).toEqual(["5.00", "0.00", "2.40"]);
  });

  it("scoped fixed: split over eligible lines only, exact sum", () => {
    const result = calculateDiscount(
      { type: "fixed", value: "10", productIds: ["p-1", "p-3"] },
      cart,
    );
    // 10 over 25.00 and 12.00 (eligible subtotal 37.00): 6.76 + 3.24.
    expect(lines(result)).toEqual(["6.76", "0.00", "3.24"]);
    expect(result.discountTotal.toFixed(2)).toBe("10.00");
    expect(
      sum(result.items.map(({ discount }) => discount)).eq(
        result.discountTotal,
      ),
    ).toBe(true);
  });

  it("scoped fixed is capped at the eligible subtotal, not the cart subtotal", () => {
    const result = calculateDiscount(
      { type: "fixed", value: "50", categoryIds: ["cat-kitchen"] },
      cart,
    );
    expect(lines(result)).toEqual(["25.00", "0.00", "0.00"]);
    expect(result.discountTotal.toFixed(2)).toBe("25.00");
  });

  it("keeps the remainder on eligible lines (three equal eligible lines, one ineligible)", () => {
    const items: RuleItem[] = [
      { productId: "a", unitPrice: 1, quantity: 1 },
      { productId: "x", unitPrice: 100, quantity: 1 },
      { productId: "a", unitPrice: 1, quantity: 1 },
      { productId: "a", unitPrice: 1, quantity: 1 },
    ];
    const result = calculateDiscount(
      { type: "fixed", value: "1", productIds: ["a"] },
      items,
    );
    expect(result.items[1].discount.toFixed(2)).toBe("0.00");
    expect(result.discountTotal.toFixed(2)).toBe("1.00");
    expect(result.items.map(({ productId }) => productId)).toEqual([
      "a",
      "x",
      "a",
      "a",
    ]);
  });

  it("unscoped behaviour is identical to before (missing lists = empty lists)", () => {
    for (const type of ["percent", "fixed"] as const) {
      const before = calculateDiscount({ type, value: "7.5" }, cart);
      const after = calculateDiscount(
        { type, value: "7.5", productIds: [], categoryIds: [] },
        cart,
      );
      expect(lines(after)).toEqual(lines(before));
    }
  });
});

describe("checkEligibility with a scope (AC1)", () => {
  it("no eligible line → no_eligible_items", () => {
    expect(
      checkEligibility(
        code({ productIds: ["p-999"] }),
        { currency: "EUR", items: cart },
        now,
      ),
    ).toEqual({ ok: false, reasonCode: VALIDATE_REASON_CODES.noEligibleItems });
  });

  it("minOrderTotal uses the FULL cart subtotal, and is checked before the scope", () => {
    // Full cart 66.95 >= 50 although the kitchen line alone is 25.00.
    expect(
      checkEligibility(
        code({ categoryIds: ["cat-kitchen"], minOrderTotal: "50" }),
        { currency: "EUR", items: cart },
        now,
      ),
    ).toEqual({ ok: true });
    expect(
      checkEligibility(
        code({ productIds: ["p-999"], minOrderTotal: "100" }),
        { currency: "EUR", items: cart },
        now,
      ),
    ).toEqual({
      ok: false,
      reasonCode: VALIDATE_REASON_CODES.minOrderNotReached,
    });
  });

  it("checks the scope before usage limits", () => {
    expect(
      checkEligibility(
        code({ productIds: ["p-999"], maxUses: 1 }),
        { currency: "EUR", items: cart },
        now,
        { total: 5, forCustomer: null },
      ),
    ).toEqual({ ok: false, reasonCode: VALIDATE_REASON_CODES.noEligibleItems });
  });
});

describe("selectBestDiscount (AC3)", () => {
  const candidate = (
    source: "code" | "promotion",
    id: string,
    total: string,
    validFrom = "2026-11-01T00:00:00.000Z",
  ) => ({
    source,
    id,
    discountTotal: money(total),
    validFrom: new Date(validFrom),
  });

  it("the bigger discount wins", () => {
    expect(
      selectBestDiscount([
        candidate("code", "c", "5"),
        candidate("promotion", "p", "6.70"),
      ])?.id,
    ).toBe("p");
    expect(
      selectBestDiscount([
        candidate("promotion", "p", "6.70"),
        candidate("code", "c", "20.09"),
      ])?.id,
    ).toBe("c");
  });

  it("a tie goes to the code", () => {
    expect(
      selectBestDiscount([
        candidate("promotion", "p", "5"),
        candidate("code", "c", "5"),
      ])?.source,
    ).toBe("code");
    expect(
      selectBestDiscount([
        candidate("code", "c", "5"),
        candidate("promotion", "p", "5"),
      ])?.source,
    ).toBe("code");
  });

  it("between promotions: earlier validFrom, then lower id", () => {
    expect(
      selectBestDiscount([
        candidate("promotion", "b", "5", "2026-11-05T00:00:00.000Z"),
        candidate("promotion", "a", "5", "2026-11-09T00:00:00.000Z"),
      ])?.id,
    ).toBe("b");
    expect(
      selectBestDiscount([
        candidate("promotion", "b", "5"),
        candidate("promotion", "a", "5"),
      ])?.id,
    ).toBe("a");
  });

  it("a discount of 0 never wins", () => {
    expect(
      selectBestDiscount([
        candidate("code", "c", "0"),
        candidate("promotion", "p", "0"),
      ]),
    ).toBeNull();
    expect(selectBestDiscount([])).toBeNull();
  });
});

describe("promotion window and applicability (AC2)", () => {
  it("excludes not started, expired and inactive; validTo is inclusive", () => {
    expect(isPromotionLive(promotion(), now)).toBe(true);
    expect(
      isPromotionLive(
        promotion({ validFrom: new Date("2026-11-22T00:00:00.000Z") }),
        now,
      ),
    ).toBe(false);
    expect(
      isPromotionLive(
        promotion({ validTo: new Date("2026-11-21T11:59:59.999Z") }),
        now,
      ),
    ).toBe(false);
    expect(isPromotionLive(promotion({ active: false }), now)).toBe(false);
    expect(isPromotionLive(promotion({ validTo: now }), now)).toBe(true);
    expect(isPromotionLive(promotion({ validFrom: now }), now)).toBe(true);
  });

  it("applies a whole-cart percent promotion in any currency", () => {
    expect(
      promotionDiscount(
        promotion(),
        { currency: "USD", items: cart },
        now,
      )?.discountTotal.toFixed(2),
    ).toBe("6.70");
  });

  it("skips a fixed promotion on a non-EUR cart, and one without an eligible line", () => {
    expect(
      promotionDiscount(
        promotion({ type: "fixed", value: "5" }),
        { currency: "USD", items: cart },
        now,
      ),
    ).toBeNull();
    expect(
      promotionDiscount(
        promotion({ type: "fixed", value: "5" }),
        { currency: "EUR", items: cart },
        now,
      )?.discountTotal.toFixed(2),
    ).toBe("5.00");
    expect(
      promotionDiscount(
        promotion({ productIds: ["p-999"] }),
        { currency: "EUR", items: cart },
        now,
      ),
    ).toBeNull();
  });

  it("skips a promotion outside its window", () => {
    expect(
      promotionDiscount(
        promotion({ active: false }),
        { currency: "EUR", items: cart },
        now,
      ),
    ).toBeNull();
  });
});
