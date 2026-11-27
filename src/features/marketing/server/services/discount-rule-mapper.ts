import type {
  MarketingDiscountCode as DiscountCode,
  MarketingPromotion as Promotion,
} from "@/generated/prisma/client";
import type { RuleCode, RulePromotion } from "./discount-rules";

// The one place where database rows become rule inputs (MAR-21). validate.service.ts and
// redemption.service.ts both use it, so the redeemed amount always equals the validated amount
// for the same cart. Pure: no database access here.

type CodeRecord = Pick<
  DiscountCode,
  | "type"
  | "value"
  | "currency"
  | "validFrom"
  | "validTo"
  | "minOrderTotal"
  | "active"
  | "maxUses"
  | "maxUsesPerCustomer"
> &
  Partial<Pick<DiscountCode, "productIds" | "categoryIds">>;

type PromotionRecord = Pick<
  Promotion,
  "id" | "name" | "type" | "value" | "validFrom" | "validTo" | "active"
> &
  Partial<Pick<Promotion, "productIds" | "categoryIds">>;

export function toRuleCode(record: CodeRecord): RuleCode {
  return {
    type: record.type,
    value: record.value.toString(),
    currency: record.currency,
    validFrom: record.validFrom,
    validTo: record.validTo,
    minOrderTotal: record.minOrderTotal?.toString() ?? null,
    active: record.active,
    maxUses: record.maxUses,
    maxUsesPerCustomer: record.maxUsesPerCustomer,
    // Rows from before the migration (and Postgres NULL arrays) are unscoped.
    productIds: record.productIds ?? [],
    categoryIds: record.categoryIds ?? [],
  };
}

export function toRulePromotion(record: PromotionRecord): RulePromotion {
  return {
    id: record.id,
    name: record.name,
    type: record.type,
    value: record.value.toString(),
    validFrom: record.validFrom,
    validTo: record.validTo,
    active: record.active,
    productIds: record.productIds ?? [],
    categoryIds: record.categoryIds ?? [],
  };
}
