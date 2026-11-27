import { describe, expect, it } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  toRuleCode,
  toRulePromotion,
} from "../server/services/discount-rule-mapper";

const at = new Date("2026-11-21T12:00:00.000Z");

describe("discount-rule.mapper (MAR-21)", () => {
  it("maps a code row, scope included", () => {
    expect(
      toRuleCode({
        type: "fixed",
        value: new Prisma.Decimal("5"),
        currency: "EUR",
        validFrom: at,
        validTo: null,
        minOrderTotal: new Prisma.Decimal("20"),
        active: true,
        maxUses: 3,
        maxUsesPerCustomer: null,
        productIds: ["p-1"],
        categoryIds: ["cat-kitchen"],
      }),
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

  it("treats missing scope lists (rows from before the migration) as whole cart", () => {
    const rule = toRuleCode({
      type: "percent",
      value: new Prisma.Decimal("10"),
      currency: "EUR",
      validFrom: at,
      validTo: null,
      minOrderTotal: null,
      active: true,
      maxUses: null,
      maxUsesPerCustomer: null,
    });
    expect(rule.productIds).toEqual([]);
    expect(rule.categoryIds).toEqual([]);
  });

  it("maps a promotion row", () => {
    expect(
      toRulePromotion({
        id: "x",
        name: "AUTO10",
        type: "percent",
        value: new Prisma.Decimal("10"),
        validFrom: at,
        validTo: null,
        active: true,
        productIds: [],
        categoryIds: ["cat-a"],
      }),
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
});
