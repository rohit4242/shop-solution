import "server-only";

import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { OrderPlacedData } from "../../schemas/order-event.schema";
import { money, toJson, type Money } from "../../utils/money";
import { normalizeCode } from "../../utils/normalize-code";
import { listActivePromotions } from "../repositories/promotion-repository";
import { toRuleCode } from "./discount-rule-mapper";
import { calculateDiscount } from "./discount-rules";
import { bestPromotion } from "./validate-service";

// The discount applied to one order, per line, for Accounting's invoice (story steps k and o).
// Written once on order.placed; read at GET /orders/{orderId}/discounts.
//
// Which discount applies follows the validate contract: Storefront sends `discountCode` only when the
// code won at checkout (cases 2 and 4 never send one that lost). Without a code, the best promotion
// live at order time applies, computed with the same rules as validate.

const storedItemSchema = z.object({
  productId: z.string(),
  offerId: z.string().nullable(),
  // A string, so the stored amount keeps its exact 2 decimal places.
  discount: z.string(),
});

export type RecordOrderDiscountResult =
  | { recorded: true; appliedBy: "code" | "promotion"; discountTotal: number }
  | {
      recorded: false;
      reason: "already_recorded" | "code_not_found" | "no_discount";
    };

function storedItems(
  lines: OrderPlacedData["items"],
  discounts: { discount: Money }[],
) {
  return lines.map((line, index) => ({
    productId: line.productId,
    offerId: line.offerId ?? null,
    discount: discounts[index].discount.toFixed(2),
  }));
}

export async function recordOrderDiscount(
  tx: Prisma.TransactionClient,
  data: OrderPlacedData,
  now = new Date(),
): Promise<RecordOrderDiscountResult> {
  // Checked first: a failed insert would abort the whole event transaction.
  const existing = await tx.marketingOrderDiscount.findUnique({
    where: { orderId: data.orderId },
    select: { id: true },
  });
  if (existing) return { recorded: false, reason: "already_recorded" };

  const base = { orderId: data.orderId, currency: data.currency };

  if (data.discountCode?.trim()) {
    const record = await tx.marketingDiscountCode.findUnique({
      where: { code: normalizeCode(data.discountCode) },
    });
    if (!record) return { recorded: false, reason: "code_not_found" };
    // Same amount as the redemption: Storefront already accepted the order with this code.
    const discount = calculateDiscount(toRuleCode(record), data.items);
    await tx.marketingOrderDiscount.create({
      data: {
        ...base,
        appliedBy: "code",
        codeId: record.id,
        code: record.code,
        discountTotal: discount.discountTotal.toFixed(2),
        items: storedItems(data.items, discount.items),
      },
    });
    return {
      recorded: true,
      appliedBy: "code",
      discountTotal: toJson(discount.discountTotal),
    };
  }

  const promotions = await listActivePromotions(now, tx);
  const best = bestPromotion(
    promotions,
    { currency: data.currency, items: data.items },
    now,
  );
  if (!best) return { recorded: false, reason: "no_discount" };
  await tx.marketingOrderDiscount.create({
    data: {
      ...base,
      appliedBy: "promotion",
      promotionId: best.id,
      discountTotal: best.discount.discountTotal.toFixed(2),
      items: storedItems(data.items, best.discount.items),
    },
  });
  return {
    recorded: true,
    appliedBy: "promotion",
    discountTotal: toJson(best.discount.discountTotal),
  };
}

type OrderDiscountRow = {
  orderId: string;
  appliedBy: "code" | "promotion";
  code: string | null;
  promotionId: string | null;
  currency: string;
  discountTotal: { toString(): string };
  items: unknown;
};

/** The response of GET /orders/{orderId}/discounts. The platform funds every discount. */
export function toOrderDiscountsDto(row: OrderDiscountRow) {
  const items = z.array(storedItemSchema).parse(row.items);
  return {
    orderId: row.orderId,
    currency: row.currency,
    appliedBy: row.appliedBy,
    code: row.code,
    promotionId: row.promotionId,
    discountTotal: toJson(money(row.discountTotal.toString())),
    items: items.map((item) => ({
      productId: item.productId,
      offerId: item.offerId,
      discount: toJson(item.discount),
      fundedBy: "platform" as const,
    })),
  };
}

/** null when the order got no discount (or Marketing never received its order.placed). */
export async function getOrderDiscounts(orderId: string) {
  const row = await db.marketingOrderDiscount.findUnique({
    where: { orderId },
  });
  return row ? toOrderDiscountsDto(row) : null;
}
