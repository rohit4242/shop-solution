import "server-only";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import type { InvoiceStatus, SaleLine } from "../../types/marketplace";
import type { RecordSaleInput } from "../../schemas/marketplace.schema";
import { requirePermission, type Actor } from "../access";
import { MarketplaceError, conflict, forbidden, notFound } from "../errors";
import { newId, toSaleLine } from "../repositories/mappers";
import { sendToAccounting } from "./accounting";
import { isPublic } from "./rules";

/**
 * Records one offer sold in one paid order, decreases stock and hands the line
 * to Accounting. The caller is trusted (the order owner, authenticated by the
 * route or calling in-process). A failed hand-off never fails the sale.
 */
export async function recordSale(input: RecordSaleInput): Promise<SaleLine> {
  let created;
  try {
    created = await db.$transaction(async (tx) => {
      const offer = await tx.marketplaceOffer.findUnique({
        where: { id: input.offerId },
        include: { seller: true, _count: { select: { variations: true } } },
      });
      if (!offer)
        throw notFound(
          "OFFER_NOT_FOUND",
          `Offer ${input.offerId} does not exist.`,
        );
      if (!isPublic(offer.status, offer.seller.status))
        throw conflict(
          "OFFER_NOT_AVAILABLE",
          `Offer ${offer.id} cannot be sold: offer is ${offer.status}, seller is ${offer.seller.status}.`,
        );
      if (offer._count.variations > 0)
        throw conflict(
          "OFFER_NOT_AVAILABLE",
          "This offer requires variation-level checkout.",
        );
      // Conditional decrement: two concurrent sales can never oversell.
      const { count } = await tx.marketplaceOffer.updateMany({
        where: { id: offer.id, stock: { gte: input.quantity } },
        data: { stock: { decrement: input.quantity } },
      });
      if (count === 0)
        throw conflict(
          "INSUFFICIENT_STOCK",
          `Offer ${offer.id} has ${offer.stock} in stock, ${input.quantity} requested.`,
        );
      return tx.marketplaceSaleLine.create({
        data: {
          id: newId.sale(),
          orderId: input.orderId,
          offerId: offer.id,
          sellerId: offer.sellerId,
          quantity: input.quantity,
          unitPriceMinor: offer.priceMinor,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw conflict(
        "DUPLICATE_SALE",
        `Offer ${input.offerId} was already sold in order ${input.orderId}.`,
      );
    throw error;
  }
  const line = toSaleLine(created);
  const result = await sendToAccounting(line);
  const updated = await db.marketplaceSaleLine.update({
    where: { id: line.saleId },
    data: {
      invoiceStatus: result.invoiceStatus,
      invoiceId: result.invoiceId,
      invoiceError: result.invoiceError,
    },
  });
  return toSaleLine(updated);
}

/**
 * Sends a pending or refused line to Accounting again. Callers: the shop
 * owner (dashboard "Send again") or a service caller (`asService`).
 */
export async function retryAccountingHandoff(
  caller: { actor: Actor | null; asService: boolean },
  saleId: string,
): Promise<SaleLine> {
  const row = await db.marketplaceSaleLine.findUnique({
    where: { id: saleId },
    include: { seller: true },
  });
  if (!caller.asService) {
    const owner = requirePermission(caller.actor, "marketplace:sell");
    if (row && row.seller.userId !== owner.userId)
      throw forbidden("This sale belongs to another seller.");
  }
  if (!row) throw notFound("SALE_NOT_FOUND", `Sale ${saleId} does not exist.`);
  if (row.invoiceStatus === "invoiced")
    throw conflict(
      "ALREADY_INVOICED",
      `Sale ${saleId} already has invoice ${row.invoiceId}.`,
    );
  const result = await sendToAccounting(toSaleLine(row));
  const updated = await db.marketplaceSaleLine.update({
    where: { id: saleId },
    data: {
      invoiceStatus: result.invoiceStatus,
      invoiceId: result.invoiceId,
      invoiceError: result.invoiceError,
    },
  });
  if ("unreachable" in result)
    throw new MarketplaceError(
      503,
      "ACCOUNTING_UNAVAILABLE",
      `Accounting is not available; sale ${saleId} stays pending. Try again later.`,
    );
  if (result.invoiceStatus === "refused")
    throw conflict(
      "INVOICE_REFUSED",
      `Accounting refused sale ${saleId}: ${result.invoiceError}`,
    );
  return toSaleLine(updated);
}

/**
 * Sale lines, newest first. A seller sees only their own shop's lines; a
 * service caller (Accounting, the order owner) may filter freely.
 */
export async function listSales(
  caller: { actor: Actor | null; asService: boolean },
  query: { orderId?: string; sellerId?: string; invoiceStatus?: InvoiceStatus },
): Promise<SaleLine[]> {
  if (!caller.asService) {
    const owner = requirePermission(caller.actor, "marketplace:sell");
    if (!query.sellerId)
      throw forbidden("You may only list the sales of your own shop.");
    const seller = await db.marketplaceSeller.findUnique({
      where: { id: query.sellerId },
    });
    if (!seller)
      throw notFound(
        "SELLER_NOT_FOUND",
        `Seller ${query.sellerId} does not exist.`,
      );
    if (seller.userId !== owner.userId)
      throw forbidden("This shop belongs to another seller.");
  }
  const rows = await db.marketplaceSaleLine.findMany({
    where: query,
    orderBy: [{ soldAt: "desc" }, { id: "desc" }],
  });
  return rows.map(toSaleLine);
}
