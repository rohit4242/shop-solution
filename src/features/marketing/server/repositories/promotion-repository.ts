import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { toRulePromotion } from "../services/discount-rule-mapper";

/**
 * Promotions that are active and inside their window at `now` (validTo inclusive), newest validFrom
 * first. Read-only; loaded once per validate call. The pure rules (isPromotionLive) check the window again.
 * Pass the transaction client when called inside the order.placed transaction.
 */
export function findActivePromotionRecords(
  now: Date,
  client: Prisma.TransactionClient = db,
) {
  return client.marketingPromotion.findMany({
    where: {
      active: true,
      validFrom: { lte: now },
      OR: [{ validTo: null }, { validTo: { gte: now } }],
    },
    orderBy: [{ validFrom: "desc" }, { id: "asc" }],
  });
}

export async function listActivePromotions(
  now: Date,
  client: Prisma.TransactionClient = db,
) {
  return (await findActivePromotionRecords(now, client)).map(toRulePromotion);
}
