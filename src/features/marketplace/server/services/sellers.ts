import "server-only";
import { db } from "@/server/db";
import type { MarketplaceSellerStatus } from "@/generated/prisma/client";
import type { MyShop, Seller, SellerAccount } from "../../types/marketplace";
import type {
  RegisterSellerInput,
  UpdateSellerInput,
} from "../../schemas/marketplace.schema";
import { requirePermission, type Actor } from "../access";
import { conflict, forbidden, notFound } from "../errors";
import { newId, toSeller, toSellerAccount } from "../repositories/mappers";
import { assertPending, assertSellerCanChange } from "./rules";

const sellerNotFound = (sellerId: string) =>
  notFound("SELLER_NOT_FOUND", `Seller ${sellerId} does not exist.`);

const addressColumns = (address: RegisterSellerInput["address"]) => ({
  addressStreet: address.street,
  addressPostalCode: address.postalCode,
  addressCity: address.city,
  addressCountry: address.country,
});

/** The seller row, checked to belong to the actor. Used by every owner operation. */
export async function ownSeller(actor: Actor | null, sellerId: string) {
  const owner = requirePermission(actor, "marketplace:sell");
  const seller = await db.marketplaceSeller.findUnique({
    where: { id: sellerId },
  });
  if (!seller) throw sellerNotFound(sellerId);
  if (seller.userId !== owner.userId)
    throw forbidden("This shop belongs to another seller.");
  return seller;
}

/** Opens a pending shop for the signed-in user (one current shop per user). */
export async function registerSeller(
  actor: Actor | null,
  input: RegisterSellerInput,
): Promise<SellerAccount> {
  const owner = requirePermission(actor, "marketplace:sell");
  const seller = await db.$transaction(
    async (tx) => {
      const existing = await tx.marketplaceSeller.findFirst({
        where: { userId: owner.userId, status: { not: "terminated" } },
      });
      if (existing) throw conflict("SELLER_EXISTS", "You already have a shop.");
      return tx.marketplaceSeller.create({
        data: {
          id: newId.seller(),
          userId: owner.userId,
          displayName: input.displayName,
          legalName: input.legalName,
          contactEmail: input.contactEmail,
          ...addressColumns(input.address),
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return toSellerAccount(seller);
}

/** The signed-in user's current shop, or why the last registration was rejected. */
export async function getMyShop(actor: Actor | null): Promise<MyShop> {
  const owner = requirePermission(actor, "marketplace:sell");
  const shops = await db.marketplaceSeller.findMany({
    where: { userId: owner.userId },
    orderBy: { createdAt: "desc" },
  });
  const current = shops.find((s) => s.status !== "terminated");
  return {
    seller: current ? toSellerAccount(current) : null,
    rejectedReason: current ? null : (shops[0]?.statusReason ?? null),
  };
}

/** Public view of an active shop. */
export async function getSeller(sellerId: string): Promise<Seller> {
  const seller = await db.marketplaceSeller.findUnique({
    where: { id: sellerId },
  });
  if (!seller || seller.status !== "active") throw sellerNotFound(sellerId);
  return toSeller(seller);
}

export async function updateSeller(
  actor: Actor | null,
  sellerId: string,
  input: UpdateSellerInput,
): Promise<SellerAccount> {
  const seller = await ownSeller(actor, sellerId);
  assertSellerCanChange(seller.status);
  const updated = await db.marketplaceSeller.update({
    where: { id: sellerId },
    data: {
      displayName: input.displayName,
      legalName: input.legalName,
      contactEmail: input.contactEmail,
      ...(input.address ? addressColumns(input.address) : {}),
    },
  });
  return toSellerAccount(updated);
}

/** Moderation queue: shops with private details, newest first. */
export async function listSellers(
  actor: Actor | null,
  status?: MarketplaceSellerStatus,
): Promise<SellerAccount[]> {
  requirePermission(actor, "marketplace:verify-sellers");
  const sellers = await db.marketplaceSeller.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
  });
  return sellers.map(toSellerAccount);
}

async function decideSeller(
  actor: Actor | null,
  sellerId: string,
  status: "active" | "terminated",
  reason: string | null,
) {
  requirePermission(actor, "marketplace:verify-sellers");
  const { count } = await db.marketplaceSeller.updateMany({
    where: { id: sellerId, status: "pending" },
    data: { status, statusReason: reason },
  });
  const seller = await db.marketplaceSeller.findUnique({
    where: { id: sellerId },
  });
  if (!seller) throw sellerNotFound(sellerId);
  if (count === 0) assertPending("Seller", sellerId, seller.status);
  return toSellerAccount(seller);
}

export const approveSeller = (actor: Actor | null, sellerId: string) =>
  decideSeller(actor, sellerId, "active", null);

export const rejectSeller = (
  actor: Actor | null,
  sellerId: string,
  reason: string,
) => decideSeller(actor, sellerId, "terminated", reason);
