import "server-only";
import { db } from "@/server/db";
import type {
  MarketplaceCategory,
  MarketplaceOfferStatus,
  Prisma,
} from "@/generated/prisma/client";
import type { CatalogPage, Offer, Product } from "../../types/marketplace";
import type {
  CatalogQuery,
  CreateOfferInput,
  UpdateOfferInput,
} from "../../schemas/marketplace.schema";
import { requirePermission, type Actor } from "../access";
import { forbidden, notFound } from "../errors";
import {
  newId,
  offerInclude,
  toOffer,
  toOfferState,
} from "../repositories/mappers";
import { ownSeller } from "./sellers";
import {
  assertPending,
  assertSellerCanChange,
  decodeCursor,
  encodeCursor,
  offerImageIds,
  planOfferUpdate,
  totals,
} from "./rules";

const offerNotFound = (offerId: string) =>
  notFound("OFFER_NOT_FOUND", `Offer ${offerId} does not exist.`);

/** Public: offer active and its shop active. */
const publicOffer = {
  status: "active",
  seller: { status: "active" },
} satisfies Prisma.MarketplaceOfferWhereInput;

/** Every referenced image must be one this seller uploaded. */
async function assertOwnImages(
  tx: Prisma.TransactionClient,
  sellerId: string,
  imageIds: string[],
) {
  if (imageIds.length === 0) return;
  const owned = await tx.marketplaceListingImage.count({
    where: { id: { in: imageIds }, sellerId },
  });
  if (owned !== imageIds.length)
    throw forbidden("An image is unavailable to this seller.");
}

export async function createOffer(
  actor: Actor | null,
  sellerId: string,
  input: CreateOfferInput,
): Promise<Offer> {
  const seller = await ownSeller(actor, sellerId);
  assertSellerCanChange(seller.status);
  const variations = input.variations.map((v) => ({
    id: newId.variation(),
    label: v.label,
    priceMinor: v.priceMinor,
    stock: v.stock,
    imageIds: v.imageIds,
  }));
  const { priceMinor, stock } = totals(variations, {
    priceMinor: input.priceMinor ?? 0,
    stock: input.stock ?? 0,
  });
  const suffix = newId.offer();
  const offer = await db.$transaction(async (tx) => {
    await assertOwnImages(
      tx,
      sellerId,
      offerImageIds({ ...input, variations }),
    );
    return tx.marketplaceOffer.create({
      data: {
        id: "off_" + suffix,
        productId: "prd_" + suffix,
        sellerId,
        name: input.name,
        description: input.description,
        category: input.category,
        attributes: input.attributes,
        imageIds: input.imageIds,
        priceMinor,
        stock,
        lengthCm: input.lengthCm ?? null,
        widthCm: input.widthCm ?? null,
        heightCm: input.heightCm ?? null,
        weightGrams: input.weightGrams ?? null,
        variations: {
          create: variations.map((v, position) => ({ ...v, position })),
        },
      },
      include: offerInclude,
    });
  });
  return toOffer(offer);
}

export async function updateOffer(
  actor: Actor | null,
  offerId: string,
  input: UpdateOfferInput,
): Promise<Offer> {
  const owner = requirePermission(actor, "marketplace:sell");
  const offer = await db.$transaction(async (tx) => {
    const current = await tx.marketplaceOffer.findUnique({
      where: { id: offerId },
      include: { ...offerInclude, seller: true },
    });
    if (!current) throw offerNotFound(offerId);
    if (current.seller.userId !== owner.userId)
      throw forbidden("This shop belongs to another seller.");
    assertSellerCanChange(current.seller.status);
    const plan = planOfferUpdate(toOfferState(current), input, newId.variation);
    await assertOwnImages(tx, current.sellerId, offerImageIds(plan));
    if (input.variations !== undefined) {
      await tx.marketplaceOfferVariation.deleteMany({ where: { offerId } });
    }
    return tx.marketplaceOffer.update({
      where: { id: offerId },
      data: {
        name: plan.name,
        description: plan.description,
        category: plan.category as MarketplaceCategory,
        attributes: plan.attributes,
        imageIds: plan.imageIds,
        priceMinor: plan.priceMinor,
        stock: plan.stock,
        lengthCm: plan.lengthCm,
        widthCm: plan.widthCm,
        heightCm: plan.heightCm,
        weightGrams: plan.weightGrams,
        status: plan.status,
        statusReason: plan.statusReason,
        ...(input.variations !== undefined
          ? {
              variations: {
                create: plan.variations.map((v, position) => ({
                  ...v,
                  position,
                })),
              },
            }
          : {}),
      },
      include: offerInclude,
    });
  });
  return toOffer(offer);
}

/**
 * Offers in any status: a seller lists their own shop, moderators list any
 * shop or status (the moderation queue is `status: "pending"`).
 */
export async function listOffers(
  actor: Actor | null,
  query: { sellerId?: string; status?: MarketplaceOfferStatus },
): Promise<Offer[]> {
  const caller = requirePermission(actor, "marketplace:sell");
  if (!caller.permissions.has("marketplace:moderate-offers")) {
    if (!query.sellerId)
      throw forbidden("You may only list the offers of your own shop.");
    await ownSeller(caller, query.sellerId);
  }
  const offers = await db.marketplaceOffer.findMany({
    where: { sellerId: query.sellerId, status: query.status },
    include: offerInclude,
    orderBy: { updatedAt: "desc" },
  });
  return offers.map(toOffer);
}

export async function getOffer(offerId: string): Promise<Offer> {
  const offer = await db.marketplaceOffer.findFirst({
    where: { id: offerId, ...publicOffer },
    include: offerInclude,
  });
  if (!offer) throw offerNotFound(offerId);
  return toOffer(offer);
}

export async function getProduct(productId: string): Promise<Product> {
  const offer = await db.marketplaceOffer.findFirst({
    where: { productId, ...publicOffer },
    include: { ...offerInclude, seller: true },
  });
  if (!offer)
    throw notFound("PRODUCT_NOT_FOUND", `Product ${productId} does not exist.`);
  return { ...toOffer(offer), sellerDisplayName: offer.seller.displayName };
}

/** Public offers of one active shop, by name. */
export async function listSellerOffers(sellerId: string): Promise<Offer[]> {
  const seller = await db.marketplaceSeller.findUnique({
    where: { id: sellerId },
  });
  if (!seller || seller.status !== "active")
    throw notFound("SELLER_NOT_FOUND", `Seller ${sellerId} does not exist.`);
  const offers = await db.marketplaceOffer.findMany({
    where: { sellerId, ...publicOffer },
    include: offerInclude,
    orderBy: { name: "asc" },
  });
  return offers.map(toOffer);
}

/**
 * Catalog feed for Search and Storefront: every public offer, oldest change
 * first (updatedAt, then offerId), with an opaque cursor.
 */
export async function listCatalogOffers(
  query: CatalogQuery,
): Promise<CatalogPage> {
  const after = query.cursor ? decodeCursor(query.cursor) : null;
  const where: Prisma.MarketplaceOfferWhereInput = {
    ...publicOffer,
    AND: [
      query.updatedSince
        ? { updatedAt: { gt: new Date(query.updatedSince) } }
        : {},
      after
        ? {
            OR: [
              { updatedAt: { gt: after.updatedAt } },
              { updatedAt: after.updatedAt, id: { gt: after.offerId } },
            ],
          }
        : {},
    ],
  };
  const rows = await db.marketplaceOffer.findMany({
    where,
    include: offerInclude,
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: query.limit + 1,
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  return {
    items: page.map(toOffer),
    nextCursor:
      rows.length > query.limit && last
        ? encodeCursor(last.updatedAt, last.id)
        : null,
  };
}

async function decideOffer(
  actor: Actor | null,
  offerId: string,
  status: "active" | "rejected",
  reason: string | null,
) {
  requirePermission(actor, "marketplace:moderate-offers");
  const { count } = await db.marketplaceOffer.updateMany({
    where: { id: offerId, status: "pending" },
    data: { status, statusReason: reason },
  });
  const offer = await db.marketplaceOffer.findUnique({
    where: { id: offerId },
    include: offerInclude,
  });
  if (!offer) throw offerNotFound(offerId);
  if (count === 0) assertPending("Offer", offerId, offer.status);
  return toOffer(offer);
}

export const approveOffer = (actor: Actor | null, offerId: string) =>
  decideOffer(actor, offerId, "active", null);

export const rejectOffer = (
  actor: Actor | null,
  offerId: string,
  reason: string,
) => decideOffer(actor, offerId, "rejected", reason);
