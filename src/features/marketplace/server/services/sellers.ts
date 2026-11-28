import "server-only";
import { db } from "@/server/db";
import type { SellerStatus as DbSellerStatus } from "@/generated/prisma/client";
import type {
  MyShop,
  Seller,
  SellerAccount,
  SellerStatus,
} from "../../types/marketplace";
import type {
  RegisterSellerInput,
  UpdateSellerInput,
} from "../../schemas/marketplace.schema";
import { requirePermission, type Actor } from "../access";
import { conflict, forbidden, notFound } from "../errors";
import {
  lower,
  toSeller,
  toSellerAccount,
  upper,
} from "../repositories/mappers";
import { assertPending, assertSellerCanChange } from "./rules";

/** `SellerMember.role` of the user who opened the shop. */
export const OWNER_ROLE = "owner";

const sellerNotFound = (sellerId: string) =>
  notFound("SELLER_NOT_FOUND", `Seller ${sellerId} does not exist.`);

const addressColumns = (address: RegisterSellerInput["address"]) => ({
  street: address.street,
  postalCode: address.postalCode,
  city: address.city,
  country: address.country,
});

/**
 * The seller row, checked to have the actor as a member. Used by every
 * seller operation. A browser-supplied seller ID is only a lookup key.
 */
export async function ownSeller(actor: Actor | null, sellerId: string) {
  const user = requirePermission(actor, "marketplace:sell");
  const seller = await db.seller.findUnique({
    where: { id: sellerId },
    include: { members: { where: { userId: user.userId } } },
  });
  if (!seller) throw sellerNotFound(sellerId);
  if (seller.members.length === 0)
    throw forbidden("This shop belongs to another seller.");
  return seller;
}

/** Opens a pending shop for the signed-in user (one current shop per user). */
export async function registerSeller(
  actor: Actor | null,
  input: RegisterSellerInput,
): Promise<SellerAccount> {
  const user = requirePermission(actor, "marketplace:sell");
  const seller = await db.$transaction(
    async (tx) => {
      const existing = await tx.sellerMember.findFirst({
        where: {
          userId: user.userId,
          seller: { status: { not: "TERMINATED" } },
        },
      });
      if (existing) throw conflict("SELLER_EXISTS", "You already have a shop.");
      return tx.seller.create({
        data: {
          displayName: input.displayName,
          legalName: input.legalName,
          contactEmail: input.contactEmail,
          ...addressColumns(input.address),
          members: { create: { userId: user.userId, role: OWNER_ROLE } },
        },
      });
    },
    { isolationLevel: "Serializable" },
  );
  return toSellerAccount(seller);
}

/** The signed-in user's current shop, or why the last registration was rejected. */
export async function getMyShop(actor: Actor | null): Promise<MyShop> {
  const user = requirePermission(actor, "marketplace:sell");
  const shops = await db.seller.findMany({
    where: { members: { some: { userId: user.userId } } },
    orderBy: { createdAt: "desc" },
  });
  const current = shops.find((s) => s.status !== "TERMINATED");
  return {
    seller: current ? toSellerAccount(current) : null,
    rejectedReason: current ? null : (shops[0]?.statusReason ?? null),
  };
}

/** Public view of an active shop. */
export async function getSeller(sellerId: string): Promise<Seller> {
  const seller = await db.seller.findUnique({ where: { id: sellerId } });
  if (!seller || seller.status !== "ACTIVE") throw sellerNotFound(sellerId);
  return toSeller(seller);
}

export async function updateSeller(
  actor: Actor | null,
  sellerId: string,
  input: UpdateSellerInput,
): Promise<SellerAccount> {
  const seller = await ownSeller(actor, sellerId);
  assertSellerCanChange(lower<SellerStatus>(seller.status));
  const updated = await db.seller.update({
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
  status?: SellerStatus,
): Promise<SellerAccount[]> {
  requirePermission(actor, "marketplace:verify-sellers");
  const sellers = await db.seller.findMany({
    where: status ? { status: upper<DbSellerStatus>(status) } : {},
    orderBy: { createdAt: "desc" },
  });
  return sellers.map(toSellerAccount);
}

async function decideSeller(
  actor: Actor | null,
  sellerId: string,
  status: "ACTIVE" | "TERMINATED",
  reason: string | null,
) {
  requirePermission(actor, "marketplace:verify-sellers");
  const { count } = await db.seller.updateMany({
    where: { id: sellerId, status: "PENDING" },
    data: { status, statusReason: reason },
  });
  const seller = await db.seller.findUnique({ where: { id: sellerId } });
  if (!seller) throw sellerNotFound(sellerId);
  if (count === 0) assertPending("Seller", sellerId, lower(seller.status));
  return toSellerAccount(seller);
}

export const approveSeller = (actor: Actor | null, sellerId: string) =>
  decideSeller(actor, sellerId, "ACTIVE", null);

export const rejectSeller = (
  actor: Actor | null,
  sellerId: string,
  reason: string,
) => decideSeller(actor, sellerId, "TERMINATED", reason);
