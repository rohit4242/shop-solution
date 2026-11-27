import { money, percentOf, round2, sum, type Money } from "../../utils/money";

// Same names as ValidateResult.reasonCode in contracts/marketing.yaml.
export const VALIDATE_REASON_CODES = {
  codeNotFound: "code_not_found",
  codeInactive: "code_inactive",
  codeExpired: "code_expired",
  codeNotStarted: "code_not_started",
  minOrderNotReached: "min_order_not_reached",
  noEligibleItems: "no_eligible_items",
  usageLimitReached: "usage_limit_reached",
  customerLimitReached: "customer_limit_reached",
  currencyMismatch: "currency_mismatch",
} as const;

export type ValidateReasonCode =
  (typeof VALIDATE_REASON_CODES)[keyof typeof VALIDATE_REASON_CODES];

/**
 * MAR-21: which lines a code or promotion applies to. Both lists empty (or missing) = the whole cart;
 * otherwise a line is eligible when its productId is listed OR its categoryId is listed.
 * Missing equals empty, so rules built before MAR-21 stay unscoped; discount-rule.mapper.ts always sets both.
 */
export type RuleScope = { productIds?: string[]; categoryIds?: string[] };

export type RuleCode = RuleScope & {
  type: "percent" | "fixed" | "free_shipping";
  value: string;
  currency: string;
  validFrom: Date;
  validTo: Date | null;
  minOrderTotal: string | null;
  active: boolean;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
};

/** An automatic promotion (MAR-21): applies without a code, never creates a redemption. */
export type RulePromotion = Required<RuleScope> & {
  id: string;
  name: string;
  type: "percent" | "fixed" | "free_shipping";
  value: string;
  validFrom: Date;
  validTo: Date | null;
  active: boolean;
};

export type RuleItem = {
  productId: string;
  categoryId?: string;
  unitPrice: number;
  quantity: number;
};
export type RuleCart = { currency: string; items: RuleItem[] };

// Active redemption counts. forCustomer is null when it was not counted (guest or no per-customer limit).
export type RuleUsage = { total: number; forCustomer: number | null };

export type Eligibility =
  { ok: true } | { ok: false; reasonCode: ValidateReasonCode };

function lineTotal({ unitPrice, quantity }: RuleItem) {
  return round2(money(unitPrice).mul(quantity));
}

function reject(reasonCode: ValidateReasonCode): Eligibility {
  return { ok: false, reasonCode };
}

export function isLineEligible(
  item: Pick<RuleItem, "productId" | "categoryId">,
  scope: RuleScope,
) {
  const productIds = scope.productIds ?? [];
  const categoryIds = scope.categoryIds ?? [];
  if (productIds.length === 0 && categoryIds.length === 0) return true;
  // A line without categoryId never matches a category.
  return (
    productIds.includes(item.productId) ||
    (item.categoryId !== undefined && categoryIds.includes(item.categoryId))
  );
}

// The first failing rule wins, so the order of these checks is part of the contract.
export function checkEligibility(
  code: RuleCode | null,
  cart: RuleCart,
  now: Date,
  usage: RuleUsage = { total: 0, forCustomer: null },
): Eligibility {
  if (!code) return reject(VALIDATE_REASON_CODES.codeNotFound);
  if (!code.active) return reject(VALIDATE_REASON_CODES.codeInactive);
  if (now < code.validFrom) return reject(VALIDATE_REASON_CODES.codeNotStarted);
  if (code.validTo && now > code.validTo)
    return reject(VALIDATE_REASON_CODES.codeExpired);
  if (cart.currency !== code.currency)
    return reject(VALIDATE_REASON_CODES.currencyMismatch);
  // minOrderTotal always uses the FULL cart subtotal, also for a scoped code (MAR-21).
  if (
    code.minOrderTotal !== null &&
    sum(cart.items.map(lineTotal)).lt(code.minOrderTotal)
  ) {
    return reject(VALIDATE_REASON_CODES.minOrderNotReached);
  }
  if (!cart.items.some((item) => isLineEligible(item, code))) {
    return reject(VALIDATE_REASON_CODES.noEligibleItems);
  }
  if (code.maxUses != null && usage.total >= code.maxUses) {
    return reject(VALIDATE_REASON_CODES.usageLimitReached);
  }
  if (
    code.maxUsesPerCustomer != null &&
    usage.forCustomer !== null &&
    usage.forCustomer >= code.maxUsesPerCustomer
  ) {
    return reject(VALIDATE_REASON_CODES.customerLimitReached);
  }
  return { ok: true };
}

function percentDiscounts(percent: string, lineTotals: Money[]) {
  return lineTotals.map((total) => {
    const discount = percentOf(total, percent);
    return discount.gt(total) ? total : discount;
  });
}

// Splits the cart discount by line total. Rounding can leave cents over or short, and these go on
// the largest line. A line can only take cents up to its total and give back down to 0, so with
// very small lines the rest moves on to the next largest line (0.05 over ten lines of 0.01).
function fixedDiscounts(value: string, lineTotals: Money[]) {
  const subtotal = sum(lineTotals);
  if (subtotal.isZero()) return lineTotals.map(() => money(0));

  const discount = subtotal.lt(value) ? subtotal : money(value);
  const shares = lineTotals.map((total) =>
    round2(discount.mul(total).div(subtotal)),
  );
  let remainder = discount.sub(sum(shares));

  const largestFirst = lineTotals
    .map((_, index) => index)
    .sort((a, b) => lineTotals[b].cmp(lineTotals[a]));
  for (const index of largestFirst) {
    const limit = remainder.gt(0)
      ? lineTotals[index].sub(shares[index])
      : shares[index].neg();
    const moved = remainder.abs().lt(limit.abs()) ? remainder : limit;
    shares[index] = shares[index].add(moved);
    remainder = remainder.sub(moved);
  }
  return shares;
}

/**
 * Discount per line, in input order. Only eligible lines (RuleScope) get a discount; the others get 0.
 * A fixed amount is capped at the eligible subtotal and split over the eligible lines only.
 */
export function calculateDiscount(
  code: Pick<RuleCode, "type" | "value"> & RuleScope,
  items: RuleItem[],
) {
  const eligible = items.map((item) => isLineEligible(item, code));
  // Ineligible lines count as 0, so the split and the remainder never touch them.
  const lineTotals = items.map((item, index) =>
    eligible[index] ? lineTotal(item) : money(0),
  );
  const discounts = {
    percent: () => percentDiscounts(code.value, lineTotals),
    fixed: () => fixedDiscounts(code.value, lineTotals),
    // TODO(MKT-21): shipping is not in our cart, so free shipping gives no item discount yet.
    free_shipping: () => lineTotals.map(() => money(0)),
  }[code.type]();

  return {
    discountTotal: sum(discounts),
    items: items.map(({ productId }, index) => ({
      productId,
      discount: discounts[index],
    })),
  };
}

/** A promotion counts only while active and inside its window (validTo inclusive). */
export function isPromotionLive(
  promotion: Pick<RulePromotion, "active" | "validFrom" | "validTo">,
  now: Date,
) {
  return (
    promotion.active &&
    promotion.validFrom <= now &&
    (promotion.validTo === null || now <= promotion.validTo)
  );
}

export type DiscountCandidate = {
  source: "code" | "promotion";
  id: string;
  discountTotal: Money;
  validFrom: Date;
};

/**
 * One discount per cart, never stacked (MAR-21). The biggest discountTotal wins; a tie goes to the code;
 * between promotions the earlier validFrom, then the lower id. A discount of 0 never wins.
 */
export function selectBestDiscount<C extends DiscountCandidate>(
  candidates: C[],
): C | null {
  let best: C | null = null;
  for (const candidate of candidates) {
    if (!candidate.discountTotal.gt(0)) continue;
    if (!best || beats(candidate, best)) best = candidate;
  }
  return best;
}

function beats(a: DiscountCandidate, b: DiscountCandidate) {
  const byAmount = a.discountTotal.cmp(b.discountTotal);
  if (byAmount !== 0) return byAmount > 0;
  if (a.source !== b.source) return a.source === "code";
  if (a.validFrom.getTime() !== b.validFrom.getTime())
    return a.validFrom < b.validFrom;
  return a.id < b.id;
}

/**
 * Discount of one promotion for a cart, or null when it does not apply: outside its window, no eligible
 * line, or a fixed promotion on a non-EUR cart. Promotions have no currency column, so fixed values are
 * EUR. TODO(MKT-21/MAR-25): a currency per promotion would lift this limitation.
 */
export function promotionDiscount(
  promotion: RulePromotion,
  cart: RuleCart,
  now: Date,
) {
  if (!isPromotionLive(promotion, now)) return null;
  if (promotion.type === "fixed" && cart.currency !== "EUR") return null;
  if (!cart.items.some((item) => isLineEligible(item, promotion))) return null;
  return calculateDiscount(promotion, cart.items);
}
