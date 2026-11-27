import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { normalizeCode } from "../../utils/normalize-code";
import { toRuleCode } from "./discount-rule-mapper";
import {
  calculateDiscount,
  checkEligibility,
  type RuleItem,
  type ValidateReasonCode,
} from "./discount-rules";
import { countActiveRedemptions } from "../repositories/redemption-repository";

export type OrderPlacedData = {
  orderId: string;
  customerId?: string;
  items: RuleItem[];
  currency: string;
  discountCode?: string;
};

export type RecordRedemptionResult = {
  recorded: boolean;
  reason?: "no_code" | "code_not_found" | "already_recorded";
  redemptionId?: string;
  warning?: OrderTimeWarning;
};

// Storefront already accepted the order, so a code that fails a rule at order time is still recorded.
const ORDER_TIME_WARNINGS = {
  code_not_found: "not_found_at_order_time",
  code_inactive: "inactive_at_order_time",
  code_not_started: "not_started_at_order_time",
  code_expired: "expired_at_order_time",
  currency_mismatch: "currency_mismatch_at_order_time",
  min_order_not_reached: "min_order_not_reached_at_order_time",
  no_eligible_items: "no_eligible_items_at_order_time",
  usage_limit_reached: "over_limit_at_order_time",
  customer_limit_reached: "customer_over_limit_at_order_time",
} as const satisfies Record<ValidateReasonCode, string>;

type OrderTimeWarning = (typeof ORDER_TIME_WARNINGS)[ValidateReasonCode];

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

// Runs inside the event receiver transaction (tx). Business problems are logged and returned, never thrown,
// so they cannot fail the event. Unexpected errors propagate and roll back the whole event, like MKT-7.
export async function recordRedemptionForOrder(
  tx: Prisma.TransactionClient,
  data: OrderPlacedData,
  now = new Date(),
): Promise<RecordRedemptionResult> {
  if (!data.discountCode?.trim()) return { recorded: false, reason: "no_code" };

  const normalizedCode = normalizeCode(data.discountCode);
  const record = await tx.marketingDiscountCode.findUnique({
    where: { code: normalizedCode },
  });
  if (!record) {
    console.warn("Discount code not found for order.placed", {
      orderId: data.orderId,
      code: normalizedCode,
    });
    return { recorded: false, reason: "code_not_found" };
  }

  const logContext = {
    orderId: data.orderId,
    codeId: record.id,
    code: normalizedCode,
  };

  // Checked first because a failed insert aborts the whole Postgres transaction, including the ReceivedEvent row.
  const existing = await tx.marketingRedemption.findUnique({
    where: { codeId_orderId: { codeId: record.id, orderId: data.orderId } },
    select: { id: true },
  });
  if (existing) {
    console.info(
      "Redemption already recorded for this order and code",
      logContext,
    );
    return { recorded: false, reason: "already_recorded" };
  }

  // Same mapper as validate (MAR-21), so a scoped code redeems exactly what validate showed.
  const ruleCode = toRuleCode(record);
  // Counted before the insert, so "over limit" means this order is beyond the limit.
  const usage = {
    total:
      record.maxUses != null
        ? await countActiveRedemptions(tx, { codeId: record.id })
        : 0,
    forCustomer:
      record.maxUsesPerCustomer != null && data.customerId
        ? await countActiveRedemptions(tx, {
            codeId: record.id,
            customerId: data.customerId,
          })
        : null,
  };
  const eligibility = checkEligibility(
    ruleCode,
    { currency: data.currency, items: data.items },
    now,
    usage,
  );
  const warning = eligibility.ok
    ? undefined
    : ORDER_TIME_WARNINGS[eligibility.reasonCode];

  try {
    const redemption = await tx.marketingRedemption.create({
      data: {
        codeId: record.id,
        orderId: data.orderId,
        customerId: data.customerId ?? null,
        discountTotal: calculateDiscount(
          ruleCode,
          data.items,
        ).discountTotal.toFixed(2),
        status: "active",
      },
      select: { id: true },
    });
    if (warning)
      console.warn(
        "Redemption recorded for a code that fails a rule at order time",
        { ...logContext, warning },
      );
    return {
      recorded: true,
      redemptionId: redemption.id,
      ...(warning && { warning }),
    };
  } catch (error) {
    // Only when two deliveries of the same order race past the check above.
    if (isUniqueViolation(error)) {
      console.info(
        "Redemption already recorded for this order and code",
        logContext,
      );
      return { recorded: false, reason: "already_recorded" };
    }
    throw error;
  }
}
