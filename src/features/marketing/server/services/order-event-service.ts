import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { OrderEvent } from "../../schemas/order-event.schema";
import { recordOrderDiscount } from "./order-discount-service";
import { recordRedemptionForOrder } from "./redemption-service";

function isUniqueViolation(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

/**
 * Stores the event and handles it in one transaction. A resent event (same source + id) is accepted
 * again but handled only once. The order is never rejected: business problems are logged, not thrown.
 */
export async function receiveOrderEvent(event: OrderEvent, now = new Date()) {
  await db.$transaction(async (tx) => {
    const seen = await tx.marketingReceivedEvent.findUnique({
      where: { source_eventId: { source: event.source, eventId: event.id } },
      select: { id: true },
    });
    if (seen) return;
    try {
      await tx.marketingReceivedEvent.create({
        data: {
          source: event.source,
          eventId: event.id,
          type: event.type,
          payload: event as Prisma.InputJsonValue,
        },
      });
    } catch (error) {
      // Two deliveries raced past the check above; the other one handles the event.
      if (isUniqueViolation(error)) return;
      throw error;
    }

    const redemption = await recordRedemptionForOrder(tx, event.data, now);
    const orderDiscount = await recordOrderDiscount(tx, event.data, now);
    console.info("order.placed handled", {
      eventId: event.id,
      orderId: event.data.orderId,
      redemption,
      orderDiscount,
    });
  });
  return { id: event.id };
}
