import { describe, expect, it } from "vitest";
import {
  promotionValue,
  toRuleCode,
  toRulePromotion,
} from "../server/services/discount-rule-mapper";
import { codeRow, promotionRow } from "./fixtures";

const at = new Date("2026-11-21T12:00:00.000Z");

describe("discount-rule mapper: shared schema rows → rules (MAR-21)", () => {
  it("maps a code and its promotion, scope and limits included", () => {
    expect(
      toRuleCode(
        codeRow({
          type: "fixed",
          value: "5",
          validFrom: at,
          minOrderTotal: "20",
          maxUses: 3,
          productIds: ["p-1"],
          categoryIds: ["cat-kitchen"],
        }),
      ),
    ).toEqual({
      type: "fixed",
      value: "5",
      currency: "EUR",
      validFrom: at,
      validTo: null,
      minOrderTotal: "20",
      active: true,
      maxUses: 3,
      maxUsesPerCustomer: null,
      productIds: ["p-1"],
      categoryIds: ["cat-kitchen"],
    });
  });

  it("a code is inactive when its promotion is inactive", () => {
    expect(toRuleCode(codeRow({ promotionActive: false })).active).toBe(false);
    expect(toRuleCode(codeRow({ active: false })).active).toBe(false);
  });

  it("a code of a percent promotion without currency works in any currency", () => {
    expect(toRuleCode(codeRow({ currency: null })).currency).toBeNull();
  });

  it("maps a promotion row: basis points back to percent, no scope = whole cart", () => {
    expect(
      toRulePromotion(
        promotionRow({ id: "x", validFrom: at, categoryIds: ["cat-a"] }),
      ),
    ).toEqual({
      id: "x",
      name: "AUTO10",
      type: "percent",
      value: "10",
      validFrom: at,
      validTo: null,
      active: true,
      productIds: [],
      categoryIds: ["cat-a"],
    });
  });

  it("reads the value column that matches the type", () => {
    expect(promotionValue(promotionRow({ value: "12.5" })).toString()).toBe(
      "12.5",
    );
    expect(
      promotionValue(promotionRow({ type: "fixed", value: "5.5" })).toString(),
    ).toBe("5.5");
    expect(
      promotionValue(promotionRow({ type: "free_shipping" })).toString(),
    ).toBe("0");
  });
});
