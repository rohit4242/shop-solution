import type {
  DiscountCode,
  DiscountType,
  Promotion,
} from "@/generated/prisma/client";
import { fromBasisPoints, fromMinor } from "../../utils/money";
import type { RuleCode, RulePromotion } from "./discount-rules";

// The one place where rows of the shared shop schema become rule inputs (MAR-21). Validate and the
// order-discount read both use it, so the same promotion always gives the same amount. Pure: no
// database access here.
//
// Shared schema → rules: amounts are minor units (5990) and percentages basis points (1000); the rules
// work in decimals (59.90, 10), exactly like the wire contract.

export type PromotionWithScope = Pick<
  Promotion,
  | "id"
  | "name"
  | "type"
  | "percentBasisPoints"
  | "fixedMinor"
  | "currency"
  | "active"
  | "startsAt"
  | "endsAt"
> & {
  products?: { productId: string }[];
  categories?: { categoryId: string }[];
};

export type CodeWithPromotion = Pick<
  DiscountCode,
  "maxUses" | "maxUsesPerCustomer" | "minOrderTotalMinor" | "active"
> & { promotion: PromotionWithScope };

const RULE_TYPES = {
  PERCENT: "percent",
  FIXED: "fixed",
  FREE_SHIPPING: "free_shipping",
} as const satisfies Record<DiscountType, RulePromotion["type"]>;

export function toRuleType(type: DiscountType) {
  return RULE_TYPES[type];
}

/** The decimal value the rules and the API use: 10 for 10 %, 5.5 for EUR 5.50 off. */
export function promotionValue(
  record: Pick<Promotion, "type" | "percentBasisPoints" | "fixedMinor">,
) {
  if (record.type === "PERCENT")
    return fromBasisPoints(record.percentBasisPoints ?? 0);
  if (record.type === "FIXED") return fromMinor(record.fixedMinor ?? 0);
  return fromMinor(0);
}

function scope(record: PromotionWithScope) {
  return {
    productIds: (record.products ?? []).map((p) => p.productId),
    categoryIds: (record.categories ?? []).map((c) => c.categoryId),
  };
}

export function toRulePromotion(record: PromotionWithScope): RulePromotion {
  return {
    id: record.id,
    name: record.name,
    type: toRuleType(record.type),
    value: promotionValue(record).toString(),
    validFrom: record.startsAt,
    validTo: record.endsAt,
    active: record.active,
    ...scope(record),
  };
}

/** A code takes its discount, period and scope from its promotion, and its limits from itself. */
export function toRuleCode(record: CodeWithPromotion): RuleCode {
  const { promotion } = record;
  return {
    type: toRuleType(promotion.type),
    value: promotionValue(promotion).toString(),
    // A percent promotion has no currency, so its codes work in every currency.
    currency: promotion.currency,
    validFrom: promotion.startsAt,
    validTo: promotion.endsAt,
    minOrderTotal:
      record.minOrderTotalMinor == null
        ? null
        : fromMinor(record.minOrderTotalMinor).toString(),
    active: record.active && promotion.active,
    maxUses: record.maxUses,
    maxUsesPerCustomer: record.maxUsesPerCustomer,
    ...scope(promotion),
  };
}
