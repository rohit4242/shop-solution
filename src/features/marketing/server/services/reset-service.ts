import "server-only";

import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";

/**
 * POST /reset: empties every Marketing table, so each system test and agent run starts from the
 * same state. Marketing has no seed data; tests create what their step needs. Other modules' tables
 * are never touched.
 */
export function isResetEnabled() {
  return process.env.MARKETING_RESET_ENABLED === "true";
}

/** With MARKETING_RESET_TOKEN set, the caller must send `Authorization: Bearer <token>`. */
export function isResetAuthorized(request: Request) {
  const expected = process.env.MARKETING_RESET_TOKEN?.trim();
  if (!expected) return true;
  const sent =
    request.headers
      .get("authorization")
      ?.match(/^Bearer\s+(.+)$/i)?.[1]
      ?.trim() ?? "";
  const a = Buffer.from(sent);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function resetMarketingData() {
  const [orderDiscounts, redemptions, codes, promotions, events] =
    await db.$transaction([
      db.marketingOrderDiscount.deleteMany(),
      db.marketingRedemption.deleteMany(),
      db.marketingDiscountCode.deleteMany(),
      db.marketingPromotion.deleteMany(),
      db.marketingReceivedEvent.deleteMany(),
    ]);
  return {
    deleted: {
      orderDiscounts: orderDiscounts.count,
      redemptions: redemptions.count,
      discountCodes: codes.count,
      promotions: promotions.count,
      receivedEvents: events.count,
    },
  };
}
