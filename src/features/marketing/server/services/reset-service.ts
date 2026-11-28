import "server-only";

import { timingSafeEqual } from "node:crypto";
import { db } from "@/server/db";
import { MARKETING_CONSUMER } from "./order-event-service";

/**
 * POST /reset: removes Marketing's data, so each system test and agent run starts from the same state.
 * Marketing has no seed data; tests create what their step needs.
 *
 * The tables are shared now, so reset only touches what Marketing owns: promotions, their scope rows,
 * discount codes and Marketing's event receipts. A promotion or code that an order already used stays,
 * because checkout's `order_discount` rows point at it (and invoices depend on them); it is deactivated
 * instead, so it no longer applies. Orders, catalog and other teams' data are never touched.
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
  const unused = { applications: { none: {} } };
  const [receipts, codes, promotions, keptCodes, keptPromotions] =
    await db.$transaction([
      db.eventReceipt.deleteMany({ where: { consumer: MARKETING_CONSUMER } }),
      db.discountCode.deleteMany({ where: unused }),
      // Scope rows (promotion_product / promotion_category) go with their promotion (cascade).
      db.promotion.deleteMany({ where: { ...unused, codes: { none: {} } } }),
      db.discountCode.updateMany({ data: { active: false } }),
      db.promotion.updateMany({ data: { active: false } }),
    ]);
  return {
    deleted: {
      promotions: promotions.count,
      discountCodes: codes.count,
      eventReceipts: receipts.count,
    },
    // Used by an order, so kept for the invoice but switched off.
    deactivated: {
      promotions: keptPromotions.count,
      discountCodes: keptCodes.count,
    },
  };
}
