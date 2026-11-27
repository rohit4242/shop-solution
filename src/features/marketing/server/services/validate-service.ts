import "server-only";

import { db } from "@/server/db";
import { toJson, type Money } from "../../utils/money";
import { normalizeCode } from "../../utils/normalize-code";
import { toRuleCode } from "./discount-rule-mapper";
import {
  calculateDiscount,
  checkEligibility,
  promotionDiscount,
  selectBestDiscount,
  type RuleCode,
  type RuleItem,
  type RulePromotion,
  type RuleUsage,
} from "./discount-rules";
import { listActivePromotions } from "../repositories/promotion-repository";
import { countActiveRedemptions } from "../repositories/redemption-repository";
import type { ValidateRequest } from "../../schemas/validate.schema";

async function findRuleCode(code: string) {
  const record = await db.marketingDiscountCode.findUnique({
    where: { code: normalizeCode(code) },
  });
  if (!record) return null;
  return {
    id: record.id,
    ruleCode: toRuleCode(record),
    campaignId: record.campaignId,
  };
}

// Counts only for limits that are set, and the per-customer count only for a known customer.
async function countUsage(
  codeId: string,
  ruleCode: RuleCode,
  customerId: string | undefined,
): Promise<RuleUsage> {
  const total =
    ruleCode.maxUses != null ? await countActiveRedemptions(db, { codeId }) : 0;
  const forCustomer =
    ruleCode.maxUsesPerCustomer != null && customerId
      ? await countActiveRedemptions(db, { codeId, customerId })
      : null;
  return { total, forCustomer };
}

type Discount = {
  discountTotal: Money;
  items: { productId: string; discount: Money }[];
};

function itemsJson(discount: Discount) {
  return discount.items.map((item) => ({
    productId: item.productId,
    discount: toJson(item.discount),
  }));
}

/** The best promotion for this cart, or null (MAR-21: biggest wins, never stacked). */
export function bestPromotion(
  promotions: RulePromotion[],
  cart: { currency: string; items: RuleItem[] },
  now: Date,
) {
  const candidates = promotions.flatMap((promotion) => {
    const discount = promotionDiscount(promotion, cart, now);
    return discount
      ? [
          {
            source: "promotion" as const,
            id: promotion.id,
            validFrom: promotion.validFrom,
            discountTotal: discount.discountTotal,
            promotion,
            discount,
          },
        ]
      : [];
  });
  return selectBestDiscount(candidates);
}

// Read-only: redemptions are only counted here, recorded on order.placed, and Storefront owns the order total.
// Promotions never create redemptions. The four cases are documented at /discounts/validate in the contract.
// TODO(MKT-15): use attributionToken for attribution.
export async function validateDiscount(
  { code, customerId, currency, items }: ValidateRequest,
  now = new Date(),
) {
  const cart = { currency, items };
  const noDiscount = {
    discountTotal: 0,
    currency,
    campaignId: null,
    appliedBy: null,
    promotionId: null,
    items: items.map(({ productId }) => ({ productId, discount: 0 })),
  };
  const promotions = await listActivePromotions(now);
  const promotion = bestPromotion(promotions, cart, now);
  const promotionResult = promotion && {
    discountTotal: toJson(promotion.discountTotal),
    currency,
    campaignId: null,
    appliedBy: "promotion" as const,
    promotionId: promotion.id,
    items: itemsJson(promotion.discount),
  };

  // Case 1: no code.
  if (code === undefined)
    return { valid: true, ...(promotionResult ?? noDiscount) };

  const found = await findRuleCode(code);
  const usage = found
    ? await countUsage(found.id, found.ruleCode, customerId)
    : undefined;
  const eligibility = checkEligibility(
    found?.ruleCode ?? null,
    cart,
    now,
    usage,
  );
  // Case 4: invalid code. Nothing is applied; a promotion that would apply is offered alongside.
  if (!eligibility.ok) {
    return {
      valid: false,
      reasonCode: eligibility.reasonCode,
      ...noDiscount,
      ...(promotion && {
        promotion: {
          promotionId: promotion.id,
          name: promotion.promotion.name,
          discountTotal: toJson(promotion.discountTotal),
          items: itemsJson(promotion.discount),
        },
      }),
    };
  }

  const discount = calculateDiscount(found!.ruleCode, items);
  const winner = selectBestDiscount([
    {
      source: "code" as const,
      id: found!.id,
      validFrom: found!.ruleCode.validFrom,
      discountTotal: discount.discountTotal,
    },
    ...(promotion ? [promotion] : []),
  ]);
  // Case 3: a promotion gives more than the valid code.
  if (winner?.source === "promotion" && promotionResult)
    return { valid: true, ...promotionResult };

  // Case 2: the code applies (also a valid code worth 0, such as free shipping, when no promotion applies).
  return {
    valid: true,
    discountTotal: toJson(discount.discountTotal),
    currency,
    campaignId: found!.campaignId,
    appliedBy: "code" as const,
    promotionId: null,
    items: itemsJson(discount),
  };
}
