import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { money, round2, sum } from "../utils/money";
import {
  VALIDATE_REASON_CODES,
  calculateDiscount,
  checkEligibility,
  type RuleCode,
  type RuleItem,
} from "../server/services/discount-rules";

const now = new Date("2026-11-10T12:00:00.000Z");
const code: RuleCode = {
  type: "percent",
  value: "10",
  currency: "EUR",
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  minOrderTotal: null,
  active: true,
};
const item = (
  unitPrice: number,
  quantity = 1,
  productId = "p-1",
): RuleItem => ({ productId, unitPrice, quantity });
const cart = (items: RuleItem[] = [item(29.95, 2)], currency = "EUR") => ({
  currency,
  items,
});

function discountsFor(
  type: RuleCode["type"],
  value: string,
  items: RuleItem[],
) {
  const result = calculateDiscount({ type, value }, items);
  expectInvariants(result, items);
  return {
    total: result.discountTotal.toFixed(2),
    lines: result.items.map(({ discount }) => discount.toFixed(2)),
  };
}

function expectInvariants(
  result: ReturnType<typeof calculateDiscount>,
  items: RuleItem[],
) {
  const lineTotals = items.map(({ unitPrice, quantity }) =>
    round2(money(unitPrice).mul(quantity)),
  );
  expect(result.items.map(({ productId }) => productId)).toEqual(
    items.map(({ productId }) => productId),
  );
  result.items.forEach(({ discount }, index) => {
    expect(discount.gte(0)).toBe(true);
    expect(discount.lte(lineTotals[index])).toBe(true);
    expect(discount.decimalPlaces()).toBeLessThanOrEqual(2);
  });
  expect(result.discountTotal.lte(sum(lineTotals))).toBe(true);
  expect(
    sum(result.items.map(({ discount }) => discount)).eq(result.discountTotal),
  ).toBe(true);
}

describe("reason codes", () => {
  it("match the contract enum", () => {
    const contract = parse(
      readFileSync("docs/marketing/marketing.yaml", "utf8"),
    );
    const contractCodes: string[] =
      contract.components.schemas.ValidateResult.properties.reasonCode.enum;
    const codes = Object.values(VALIDATE_REASON_CODES);
    expect(contractCodes.toSorted()).toEqual(codes.toSorted());
  });
});

describe("checkEligibility", () => {
  it("accepts an eligible code", () => {
    expect(checkEligibility(code, cart(), now)).toEqual({ ok: true });
  });

  it.each([
    ["code_not_found", null, cart()],
    ["code_inactive", { ...code, active: false }, cart()],
    [
      "code_not_started",
      { ...code, validFrom: new Date(now.getTime() + 1) },
      cart(),
    ],
    ["code_expired", { ...code, validTo: new Date(now.getTime() - 1) }, cart()],
    ["currency_mismatch", code, cart(undefined, "USD")],
    ["min_order_not_reached", { ...code, minOrderTotal: "59.91" }, cart()],
  ])("returns %s", (reasonCode, ruleCode, ruleCart) => {
    expect(checkEligibility(ruleCode, ruleCart, now)).toEqual({
      ok: false,
      reasonCode,
    });
  });

  it.each([
    ["validFrom exactly now", { ...code, validFrom: now }],
    ["validTo exactly now", { ...code, validTo: now }],
    ["subtotal equal to minOrderTotal", { ...code, minOrderTotal: "59.90" }],
  ])("accepts %s", (_name, ruleCode) => {
    expect(checkEligibility(ruleCode, cart(), now)).toEqual({ ok: true });
  });

  it.each([
    [
      "inactive before expired",
      { active: false, validTo: new Date(0) },
      cart(),
      VALIDATE_REASON_CODES.codeInactive,
    ],
    [
      "inactive before not started",
      { active: false, validFrom: new Date(now.getTime() + 1) },
      cart(),
      VALIDATE_REASON_CODES.codeInactive,
    ],
    [
      "not started before currency",
      { validFrom: new Date(now.getTime() + 1) },
      cart(undefined, "USD"),
      VALIDATE_REASON_CODES.codeNotStarted,
    ],
    [
      "expired before currency",
      { validTo: new Date(0) },
      cart(undefined, "USD"),
      VALIDATE_REASON_CODES.codeExpired,
    ],
    [
      "currency before minimum order",
      { minOrderTotal: "1000" },
      cart(undefined, "USD"),
      VALIDATE_REASON_CODES.currencyMismatch,
    ],
  ])("checks %s", (_name, overrides, ruleCart, reasonCode) => {
    expect(checkEligibility({ ...code, ...overrides }, ruleCart, now)).toEqual({
      ok: false,
      reasonCode,
    });
  });
});

describe("checkEligibility usage limits", () => {
  const usage = (total: number, forCustomer: number | null = null) => ({
    total,
    forCustomer,
  });

  it.each([
    [1, { ok: true }],
    [2, { ok: false, reasonCode: VALIDATE_REASON_CODES.usageLimitReached }],
    [3, { ok: false, reasonCode: VALIDATE_REASON_CODES.usageLimitReached }],
  ])("maxUses 2 with %i active redemptions", (total, expected) => {
    expect(
      checkEligibility({ ...code, maxUses: 2 }, cart(), now, usage(total)),
    ).toEqual(expected);
  });

  it("never limits when maxUses is null", () => {
    expect(
      checkEligibility(
        { ...code, maxUses: null },
        cart(),
        now,
        usage(1_000_000),
      ),
    ).toEqual({ ok: true });
  });

  it.each([
    [0, { ok: true }],
    [1, { ok: false, reasonCode: VALIDATE_REASON_CODES.customerLimitReached }],
  ])(
    "maxUsesPerCustomer 1 with %i redemptions by this customer",
    (forCustomer, expected) => {
      expect(
        checkEligibility(
          { ...code, maxUsesPerCustomer: 1 },
          cart(),
          now,
          usage(0, forCustomer),
        ),
      ).toEqual(expected);
    },
  );

  it("skips the per-customer limit for a guest (forCustomer null) but keeps the total limit", () => {
    const limited = { ...code, maxUses: 2, maxUsesPerCustomer: 1 };
    expect(checkEligibility(limited, cart(), now, usage(1, null))).toEqual({
      ok: true,
    });
    expect(checkEligibility(limited, cart(), now, usage(2, null))).toEqual({
      ok: false,
      reasonCode: VALIDATE_REASON_CODES.usageLimitReached,
    });
  });

  it.each([
    [
      "inactive before over limit",
      { active: false, maxUses: 1 },
      usage(5, 5),
      VALIDATE_REASON_CODES.codeInactive,
    ],
    [
      "minimum order before over limit",
      { minOrderTotal: "1000", maxUses: 1 },
      usage(5),
      VALIDATE_REASON_CODES.minOrderNotReached,
    ],
    [
      "total before customer limit",
      { maxUses: 1, maxUsesPerCustomer: 1 },
      usage(1, 1),
      VALIDATE_REASON_CODES.usageLimitReached,
    ],
  ])("checks %s", (_name, overrides, ruleUsage, reasonCode) => {
    expect(
      checkEligibility({ ...code, ...overrides }, cart(), now, ruleUsage),
    ).toEqual({ ok: false, reasonCode });
  });
});

describe("percent", () => {
  it("gives 5.99 for 10 % of 29.95 × 2, the contract example", () => {
    expect(discountsFor("percent", "10", [item(29.95, 2)])).toEqual({
      total: "5.99",
      lines: ["5.99"],
    });
  });

  it("rounds half up per item before summing", () => {
    expect(discountsFor("percent", "10", [item(0.05)])).toEqual({
      total: "0.01",
      lines: ["0.01"],
    });
    expect(
      discountsFor("percent", "10", [item(0.05, 1, "a"), item(0.05, 1, "b")])
        .total,
    ).toBe("0.02");
  });

  it("gives exactly the line total at 100 %", () => {
    expect(discountsFor("percent", "100", [item(19.99, 3)])).toEqual({
      total: "59.97",
      lines: ["59.97"],
    });
  });

  it("caps at the line total", () => {
    expect(discountsFor("percent", "150", [item(10)])).toEqual({
      total: "10.00",
      lines: ["10.00"],
    });
  });

  it("gives 0 on a zero-price line", () => {
    expect(
      discountsFor("percent", "10", [item(0, 1, "free"), item(10)]).lines,
    ).toEqual(["0.00", "1.00"]);
  });
});

describe("fixed", () => {
  it("splits proportionally over two lines and sums to exactly 5.00", () => {
    expect(
      discountsFor("fixed", "5", [item(30, 1, "a"), item(10, 1, "b")]),
    ).toEqual({
      total: "5.00",
      lines: ["3.75", "1.25"],
    });
  });

  it("caps at the subtotal when the amount is larger", () => {
    expect(
      discountsFor("fixed", "100", [item(15, 1, "a"), item(5, 1, "b")]),
    ).toEqual({
      total: "20.00",
      lines: ["15.00", "5.00"],
    });
  });

  it("caps at the subtotal for 10.00 over three lines of 3.33", () => {
    expect(
      discountsFor("fixed", "10", [
        item(3.33, 1, "a"),
        item(3.33, 1, "b"),
        item(3.33, 1, "c"),
      ]),
    ).toEqual({
      total: "9.99",
      lines: ["3.33", "3.33", "3.33"],
    });
  });

  it("puts a missing cent on the largest line", () => {
    expect(
      discountsFor("fixed", "10", [
        item(5, 1, "a"),
        item(5, 1, "b"),
        item(5, 1, "c"),
      ]),
    ).toEqual({
      total: "10.00",
      lines: ["3.34", "3.33", "3.33"],
    });
    expect(
      discountsFor("fixed", "1", [item(1, 1, "a"), item(2, 1, "b")]).lines,
    ).toEqual(["0.33", "0.67"]);
  });

  it("takes an extra cent back from the largest line", () => {
    expect(
      discountsFor("fixed", "0.05", [
        item(0.5, 1, "a"),
        item(0.5, 1, "b"),
        item(0.5, 1, "c"),
      ]),
    ).toEqual({
      total: "0.05",
      lines: ["0.01", "0.02", "0.02"],
    });
  });

  it("spreads a remainder that one line cannot take", () => {
    const tiny = Array.from({ length: 10 }, (_, index) =>
      item(0.01, 1, `p-${index}`),
    );
    expect(discountsFor("fixed", "0.05", tiny).total).toBe("0.05");
    expect(discountsFor("fixed", "0.04", tiny).total).toBe("0.04");
  });

  it("gives 0 on a zero-price line", () => {
    expect(
      discountsFor("fixed", "5", [item(0, 1, "free"), item(10)]).lines,
    ).toEqual(["0.00", "5.00"]);
  });

  it("gives 0 everywhere when the subtotal is 0", () => {
    expect(
      discountsFor("fixed", "5", [item(0, 1, "a"), item(0, 2, "b")]),
    ).toEqual({
      total: "0.00",
      lines: ["0.00", "0.00"],
    });
  });

  it("holds the invariants across many generated carts", () => {
    let seed = 13;
    const next = (limit: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % limit;
    };
    for (let run = 0; run < 2000; run += 1) {
      const items = Array.from({ length: 1 + next(12) }, (_, index) =>
        item(next(run % 2 ? 20 : 5000) / 100, 1 + next(4), `p-${index}`),
      );
      const value = (next(run % 2 ? 300 : 20000) / 100).toFixed(2);
      const subtotal = sum(
        items.map(({ unitPrice, quantity }) =>
          round2(money(unitPrice).mul(quantity)),
        ),
      );
      const expected = subtotal.lt(value) ? subtotal : money(value);
      expect(discountsFor("fixed", value, items).total).toBe(
        expected.toFixed(2),
      );
      discountsFor("percent", String(1 + next(100)), items);
    }
  });
});

describe("free shipping", () => {
  it("gives no item discount", () => {
    expect(discountsFor("free_shipping", "0", [item(29.95, 2)])).toEqual({
      total: "0.00",
      lines: ["0.00"],
    });
  });
});
