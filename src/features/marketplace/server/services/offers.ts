import "server-only";
import { db } from "@/server/db";
import {
  Prisma,
  type OfferStatus as DbOfferStatus,
} from "@/generated/prisma/client";
import {
  DEFAULT_VARIANT_CODE,
  type CatalogPage,
  type Category,
  type Offer,
  type OfferStatus,
  type Product,
  type ProductStatus,
  type SellerStatus,
} from "../../types/marketplace";
import {
  CURRENCY,
  type CatalogQuery,
  type CreateOfferInput,
  type UpdateOfferInput,
} from "../../schemas/marketplace.schema";
import { requirePermission, type Actor } from "../access";
import { conflict, forbidden, invalid, notFound } from "../errors";
import type { ImageMeta } from "../repositories/image-store";
import {
  attributesOf,
  lower,
  newVariantCode,
  offerInclude,
  toOffer,
  toOfferState,
  upper,
} from "../repositories/mappers";
import { imageMetaFor } from "./images";
import { ownSeller } from "./sellers";
import {
  assertDistinctImages,
  assertPending,
  assertSellerCanChange,
  decodeCursor,
  encodeCursor,
  planNewItems,
  planOfferUpdate,
  type Measurements,
  type PlannedItem,
} from "./rules";

type Tx = Prisma.TransactionClient;

const offerNotFound = (offerId: string) =>
  notFound("OFFER_NOT_FOUND", `Offer ${offerId} does not exist.`);

/** Public: offer, shop and product active, with at least one active item. */
const publicOffer = {
  status: "ACTIVE",
  seller: { status: "ACTIVE" },
  product: { status: "ACTIVE" },
  items: { some: { active: true } },
} satisfies Prisma.OfferWhereInput;

const measurementColumns = (m: Partial<Measurements>) => ({
  lengthCm: m.lengthCm ?? null,
  widthCm: m.widthCm ?? null,
  heightCm: m.heightCm ?? null,
  weightGrams: m.weightGrams ?? null,
});

async function categoryId(tx: Tx, slug: string): Promise<string> {
  const category = await tx.category.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!category)
    throw invalid("Choose a category from the shared catalog.", {
      categorySlug: [`Unknown category "${slug}".`],
    });
  return category.id;
}

/** Translates a unique-key clash on `OfferImage.storageKey`. */
function imageInUse(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  )
    throw conflict(
      "IMAGE_IN_USE",
      "An image is already used by another offer.",
    );
  throw error;
}

/**
 * Creates or updates an offer item and its stock. A new item gets a new
 * product variant, except the default item, which reuses the product's
 * default variant (and its earlier, deactivated offer item) when present.
 */
async function saveItem(
  tx: Tx,
  offer: { id: string; productId: string },
  item: PlannedItem,
  measurements: Measurements,
): Promise<string> {
  if (item.id) {
    const row = await tx.offerItem.update({
      where: { id: item.id },
      data: {
        priceMinor: item.priceMinor,
        productVariant: {
          update: { label: item.label, ...measurementColumns(measurements) },
        },
        inventory: {
          upsert: {
            create: { onHand: item.stock },
            update: { onHand: item.stock },
          },
        },
      },
      select: { id: true },
    });
    return row.id;
  }
  const code = item.isDefault ? DEFAULT_VARIANT_CODE : newVariantCode();
  const variant = await tx.productVariant.upsert({
    where: { productId_code: { productId: offer.productId, code } },
    create: {
      productId: offer.productId,
      code,
      label: item.label,
      ...measurementColumns(measurements),
    },
    update: { label: item.label, ...measurementColumns(measurements) },
    select: { id: true },
  });
  const row = await tx.offerItem.upsert({
    where: {
      offerId_productVariantId: {
        offerId: offer.id,
        productVariantId: variant.id,
      },
    },
    create: {
      offerId: offer.id,
      productId: offer.productId,
      productVariantId: variant.id,
      priceMinor: item.priceMinor,
      currency: CURRENCY,
      inventory: { create: { onHand: item.stock } },
    },
    update: {
      active: true,
      priceMinor: item.priceMinor,
      inventory: {
        upsert: {
          create: { onHand: item.stock },
          update: { onHand: item.stock },
        },
      },
    },
    select: { id: true },
  });
  return row.id;
}

/**
 * Makes the offer's `OfferImage` rows match: offer images first, then each
 * item's own images, each list in order. Unused rows are deleted.
 */
async function syncImages(
  tx: Tx,
  offerId: string,
  offerImages: readonly string[],
  itemImages: readonly { offerItemId: string; imageKeys: readonly string[] }[],
  newMeta: Map<string, ImageMeta>,
) {
  const wanted = [
    ...offerImages.map((key, position) => ({
      key,
      position,
      offerItemId: null as string | null,
    })),
    ...itemImages.flatMap((item) =>
      item.imageKeys.map((key, position) => ({
        key,
        position,
        offerItemId: item.offerItemId as string | null,
      })),
    ),
  ];
  await tx.offerImage.deleteMany({
    where: { offerId, storageKey: { notIn: wanted.map((w) => w.key) } },
  });
  const existing = new Set(
    (
      await tx.offerImage.findMany({
        where: { offerId },
        select: { storageKey: true },
      })
    ).map((row) => row.storageKey),
  );
  for (const image of wanted) {
    if (existing.has(image.key)) {
      await tx.offerImage.update({
        where: { storageKey: image.key },
        data: { position: image.position, offerItemId: image.offerItemId },
      });
      continue;
    }
    const meta = newMeta.get(image.key);
    if (!meta)
      throw conflict(
        "CONCURRENT_UPDATE",
        "Another change happened at the same time. Try again.",
      );
    await tx.offerImage.create({
      data: {
        offerId,
        offerItemId: image.offerItemId,
        storageKey: image.key,
        mediaType: meta.mediaType,
        byteSize: meta.byteSize,
        position: image.position,
      },
    });
  }
}

/**
 * Lists a new product: a draft `Product` with its variants, the shop's
 * pending `Offer`, one `OfferItem` and stock balance per variant, and images.
 */
export async function createOffer(
  actor: Actor | null,
  sellerId: string,
  input: CreateOfferInput,
): Promise<Offer> {
  const seller = await ownSeller(actor, sellerId);
  assertSellerCanChange(lower<SellerStatus>(seller.status));
  const items = planNewItems(input);
  assertDistinctImages(input.imageKeys, items);
  const meta = await imageMetaFor(sellerId, [
    ...input.imageKeys,
    ...items.flatMap((item) => item.imageKeys),
  ]);
  const measurements = measurementColumns(input);
  try {
    const offer = await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          categoryId: await categoryId(tx, input.categorySlug),
          name: input.name,
          description: input.description,
          attributes: input.attributes,
          status: "DRAFT",
        },
        select: { id: true },
      });
      const offer = await tx.offer.create({
        data: { productId: product.id, sellerId, status: "PENDING" },
        select: { id: true, productId: true },
      });
      const itemImages = [];
      for (const item of items)
        itemImages.push({
          offerItemId: await saveItem(tx, offer, item, measurements),
          imageKeys: item.imageKeys,
        });
      await syncImages(tx, offer.id, input.imageKeys, itemImages, meta);
      return tx.offer.findUniqueOrThrow({
        where: { id: offer.id },
        include: offerInclude,
      });
    });
    return toOffer(offer);
  } catch (error) {
    imageInUse(error);
  }
}

export async function updateOffer(
  actor: Actor | null,
  offerId: string,
  input: UpdateOfferInput,
): Promise<Offer> {
  const user = requirePermission(actor, "marketplace:sell");
  // Image metadata comes from storage, so read it before the transaction.
  const before = await db.offer.findUnique({
    where: { id: offerId },
    select: { sellerId: true, images: { select: { storageKey: true } } },
  });
  if (!before) throw offerNotFound(offerId);
  const attached = new Set(before.images.map((image) => image.storageKey));
  const requested = [
    ...(input.imageKeys ?? []),
    ...(input.variations ?? []).flatMap((v) => v.imageKeys),
  ];
  const meta = await imageMetaFor(
    before.sellerId,
    requested.filter((key) => !attached.has(key)),
  );

  try {
    const offer = await db.$transaction(async (tx) => {
      const current = await tx.offer.findUnique({
        where: { id: offerId },
        include: offerInclude,
      });
      if (!current) throw offerNotFound(offerId);
      const member = await tx.sellerMember.findUnique({
        where: {
          sellerId_userId: { sellerId: current.sellerId, userId: user.userId },
        },
      });
      if (!member) throw forbidden("This shop belongs to another seller.");
      assertSellerCanChange(lower<SellerStatus>(current.seller.status));
      const plan = planOfferUpdate(toOfferState(current), input);

      if (plan.productChanged) {
        const shared = await tx.offer.count({
          where: {
            productId: current.productId,
            sellerId: { not: current.sellerId },
          },
        });
        if (shared > 0)
          throw conflict(
            "PRODUCT_SHARED",
            "Other shops sell this product, so its details cannot be changed here.",
          );
        await tx.product.update({
          where: { id: current.productId },
          data: {
            name: plan.name,
            description: plan.description,
            attributes: plan.attributes,
            ...(plan.categorySlug !== current.product.category.slug
              ? { categoryId: await categoryId(tx, plan.categorySlug) }
              : {}),
          },
        });
      }
      if (plan.deactivate.length)
        await tx.offerItem.updateMany({
          where: { id: { in: plan.deactivate }, offerId },
          data: { active: false },
        });
      const itemImages = [];
      for (const item of plan.items)
        itemImages.push({
          offerItemId: await saveItem(tx, current, item, plan),
          imageKeys: item.imageKeys,
        });
      await syncImages(tx, offerId, plan.imageKeys, itemImages, meta);
      // Always touch the offer so catalog readers polling updatedSince see the change.
      return tx.offer.update({
        where: { id: offerId },
        data: {
          status: upper<DbOfferStatus>(plan.status),
          statusReason: plan.statusReason,
          updatedAt: new Date(),
        },
        include: offerInclude,
      });
    });
    return toOffer(offer);
  } catch (error) {
    imageInUse(error);
  }
}

/**
 * Offers in any status: a seller lists their own shop, moderators list any
 * shop or status (the moderation queue is `status: "pending"`).
 */
export async function listOffers(
  actor: Actor | null,
  query: { sellerId?: string; status?: OfferStatus },
): Promise<Offer[]> {
  const caller = requirePermission(actor, "marketplace:sell");
  if (!caller.permissions.has("marketplace:moderate-offers")) {
    if (!query.sellerId)
      throw forbidden("You may only list the offers of your own shop.");
    await ownSeller(caller, query.sellerId);
  }
  const offers = await db.offer.findMany({
    where: {
      sellerId: query.sellerId,
      status: query.status ? upper<DbOfferStatus>(query.status) : undefined,
    },
    include: offerInclude,
    orderBy: { updatedAt: "desc" },
  });
  return offers.map(toOffer);
}

export async function getOffer(offerId: string): Promise<Offer> {
  const offer = await db.offer.findFirst({
    where: { id: offerId, ...publicOffer },
    include: offerInclude,
  });
  if (!offer) throw offerNotFound(offerId);
  return toOffer(offer);
}

/** An active catalog product with every public offer for it, cheapest first. */
export async function getProduct(productId: string): Promise<Product> {
  const product = await db.product.findFirst({
    where: { id: productId, status: "ACTIVE" },
    include: { category: true },
  });
  if (!product)
    throw notFound("PRODUCT_NOT_FOUND", `Product ${productId} does not exist.`);
  const offers = await db.offer.findMany({
    where: { productId, ...publicOffer },
    include: offerInclude,
  });
  return {
    productId: product.id,
    name: product.name,
    description: product.description,
    categorySlug: product.category.slug,
    attributes: attributesOf(product.attributes),
    status: lower<ProductStatus>(product.status),
    offers: offers
      .map((row) => ({
        ...toOffer(row),
        sellerDisplayName: row.seller.displayName,
      }))
      .sort((a, b) => a.priceMinor - b.priceMinor),
  };
}

/** Public offers of one active shop, by product name. */
export async function listSellerOffers(sellerId: string): Promise<Offer[]> {
  const seller = await db.seller.findUnique({ where: { id: sellerId } });
  if (!seller || seller.status !== "ACTIVE")
    throw notFound("SELLER_NOT_FOUND", `Seller ${sellerId} does not exist.`);
  const offers = await db.offer.findMany({
    where: { sellerId, ...publicOffer },
    include: offerInclude,
    orderBy: { product: { name: "asc" } },
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
  const where: Prisma.OfferWhereInput = {
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
  const rows = await db.offer.findMany({
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

/** Categories of the shared catalog, for the listing form. Read-only. */
export async function listCategories(): Promise<Category[]> {
  const rows = await db.category.findMany({
    select: { slug: true, name: true },
    orderBy: { name: "asc" },
  });
  return rows;
}

/**
 * Approving a pending offer also activates its draft product: Marketplace
 * created that product for this listing. A product another writer archived
 * stays archived, so the offer stays out of public reads.
 */
async function decideOffer(
  actor: Actor | null,
  offerId: string,
  status: "ACTIVE" | "REJECTED",
  reason: string | null,
) {
  requirePermission(actor, "marketplace:moderate-offers");
  const offer = await db.$transaction(async (tx) => {
    const { count } = await tx.offer.updateMany({
      where: { id: offerId, status: "PENDING" },
      data: { status, statusReason: reason },
    });
    const row = await tx.offer.findUnique({
      where: { id: offerId },
      include: offerInclude,
    });
    if (!row) throw offerNotFound(offerId);
    if (count === 0) assertPending("Offer", offerId, lower(row.status));
    if (status === "ACTIVE" && row.product.status === "DRAFT") {
      await tx.product.update({
        where: { id: row.productId },
        data: { status: "ACTIVE" },
      });
      return tx.offer.findUniqueOrThrow({
        where: { id: offerId },
        include: offerInclude,
      });
    }
    return row;
  });
  return toOffer(offer);
}

export const approveOffer = (actor: Actor | null, offerId: string) =>
  decideOffer(actor, offerId, "ACTIVE", null);

export const rejectOffer = (
  actor: Actor | null,
  offerId: string,
  reason: string,
) => decideOffer(actor, offerId, "REJECTED", reason);
