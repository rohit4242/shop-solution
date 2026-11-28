import "server-only";

import { db } from "@/server/db";
import type { OrderEvent } from "../../schemas/order-event.schema";

/** Consumer name in the shared `event_receipt` table. */
export const MARKETING_CONSUMER = "marketing";

/**
 * Acknowledges an order event once (POST /events). The shared `event_receipt` table remembers
 * (consumer, source, id), so a resent event is accepted again but counted only once.
 *
 * Checkout stores the applied discount with the order itself (shared `order_discount`), and code use is
 * derived from those rows, so Marketing writes no discount or redemption here. The receipt is what
 * later campaign attribution will build on. The order is never rejected.
 */
export async function receiveOrderEvent(event: OrderEvent) {
  const { count } = await db.eventReceipt.createMany({
    data: [
      { consumer: MARKETING_CONSUMER, source: event.source, eventId: event.id },
    ],
    skipDuplicates: true,
  });
  const duplicate = count === 0;
  console.info("order event received", {
    eventId: event.id,
    type: event.type,
    orderId: event.data.orderId,
    duplicate,
  });
  return { id: event.id, duplicate };
}
