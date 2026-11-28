import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { toRulePromotion } from "../services/discount-rule-mapper";

/** Scope relations every promotion read needs (shared tables promotion_product / promotion_category). */
export const promotionInclude = {
  products: { select: { productId: true }, orderBy: { productId: "asc" } },
  categories: { select: { categoryId: true }, orderBy: { categoryId: "asc" } },
} as const satisfies Prisma.PromotionInclude;

/**
 * Automatic promotions (no code needed) that are active and inside their window at `now` (endsAt
 * inclusive), newest start first. A promotion that only backs discount codes (automatic = false) never
 * applies on its own. The pure rules (isPromotionLive) check the window again.
 */
export function findActivePromotionRecords(
  now: Date,
  client: Prisma.TransactionClient = db,
) {
  return client.promotion.findMany({
    where: {
      automatic: true,
      active: true,
      startsAt: { lte: now },
      OR: [{ endsAt: null }, { endsAt: { gte: now } }],
    },
    include: promotionInclude,
    orderBy: [{ startsAt: "desc" }, { id: "asc" }],
  });
}

export async function listActivePromotions(
  now: Date,
  client: Prisma.TransactionClient = db,
) {
  return (await findActivePromotionRecords(now, client)).map(toRulePromotion);
}
