import "server-only";

import { db } from "@/server/db";
import { fromMinor, toJson } from "../../utils/money";

// The discount applied to one order, per line, for Accounting's invoice (story steps k and o):
// GET /orders/{orderId}/discounts.
//
// Checkout records the applied discount with the order in the shared tables `order_discount` and
// `order_discount_allocation` (docs/commerce/README.md, "Pricing and campaigns"). Marketing does not
// write them; this read turns those rows back into the decimal wire contract (599 → 5.99).

export type OrderDiscountRows = {
  id: string;
  currency: string;
  lines: {
    id: string;
    offerItem: { productId: string; offerId: string };
  }[];
  discounts: {
    promotionId: string;
    codeId: string | null;
    code: { code: string } | null;
    appliedMinor: number;
    allocations: { orderLineId: string; amountMinor: number }[];
  }[];
};

/**
 * The response of GET /orders/{orderId}/discounts, or null when no discount applies. One discount per
 * order is Marketing's rule (validate never offers two), so the earliest non-reversed one is returned.
 * Every order line is listed; a line without an allocation has discount 0. The platform funds every
 * discount.
 */
export function toOrderDiscountsDto(order: OrderDiscountRows) {
  const [applied, ...others] = order.discounts;
  if (!applied) return null;
  if (others.length)
    console.warn(
      "Order has more than one applied discount; returning the first",
      {
        orderId: order.id,
        count: order.discounts.length,
      },
    );
  const byLine = new Map<string, number>();
  for (const allocation of applied.allocations)
    byLine.set(
      allocation.orderLineId,
      (byLine.get(allocation.orderLineId) ?? 0) + allocation.amountMinor,
    );
  const byCode = applied.codeId !== null;
  return {
    orderId: order.id,
    currency: order.currency,
    appliedBy: byCode ? ("code" as const) : ("promotion" as const),
    code: applied.code?.code ?? null,
    promotionId: byCode ? null : applied.promotionId,
    discountTotal: toJson(fromMinor(applied.appliedMinor)),
    items: order.lines.map((line) => ({
      productId: line.offerItem.productId,
      offerId: line.offerItem.offerId,
      discount: toJson(fromMinor(byLine.get(line.id) ?? 0)),
      fundedBy: "platform" as const,
    })),
  };
}

/** null when the order does not exist or got no (non-reversed) discount. */
export async function getOrderDiscounts(orderId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      currency: true,
      lines: {
        select: {
          id: true,
          offerItem: { select: { productId: true, offerId: true } },
        },
        orderBy: { id: "asc" },
      },
      discounts: {
        where: { reversedAt: null },
        select: {
          promotionId: true,
          codeId: true,
          code: { select: { code: true } },
          appliedMinor: true,
          allocations: { select: { orderLineId: true, amountMinor: true } },
        },
        orderBy: [{ appliedAt: "asc" }, { id: "asc" }],
      },
    },
  });
  return order ? toOrderDiscountsDto(order) : null;
}
