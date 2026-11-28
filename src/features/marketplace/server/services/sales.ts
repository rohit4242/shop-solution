import "server-only";
import { db } from "@/server/db";
import type { SaleLine } from "../../types/marketplace";
import type { Actor } from "../access";
import { saleInclude, toSaleLine } from "../repositories/mappers";
import { ownSeller } from "./sellers";

/**
 * A shop's sales, newest order first. Derived from the canonical `OrderLine`
 * rows of this shop's offer items (docs/commerce/README.md): Marketplace
 * records no sale of its own. Orders, payments and stock decrements are
 * written by the checkout owner, which the class has not assigned yet.
 */
export async function listSales(
  actor: Actor | null,
  sellerId: string,
): Promise<SaleLine[]> {
  await ownSeller(actor, sellerId);
  const rows = await db.orderLine.findMany({
    where: { offerItem: { offer: { sellerId } } },
    include: saleInclude,
    orderBy: [{ order: { placedAt: "desc" } }, { id: "desc" }],
  });
  return rows.map(toSaleLine);
}
