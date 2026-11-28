import "server-only";
import { db } from "@/server/db";
import type {
  OfferStatus,
  ProductStatus,
  SellerStatus,
  UploadedImage,
} from "../../types/marketplace";
import { MAX_IMAGE_BYTES } from "../../schemas/marketplace.schema";
import type { Actor } from "../access";
import { MarketplaceError, forbidden, invalid, notFound } from "../errors";
import { imageStore, type ImageMeta } from "../repositories/image-store";
import { imageUrl, lower, newImageKey } from "../repositories/mappers";
import { ownSeller } from "./sellers";
import {
  assertSellerCanChange,
  detectImageType,
  isPublic,
  sellerOfImageKey,
} from "./rules";

/**
 * Stores an image for one of the actor's shops and returns its key. The key
 * becomes an `OfferImage` row when an offer references it.
 */
export async function uploadListingImage(
  actor: Actor | null,
  sellerId: string,
  bytes: Uint8Array,
): Promise<UploadedImage> {
  const seller = await ownSeller(actor, sellerId);
  assertSellerCanChange(lower<SellerStatus>(seller.status));
  if (bytes.length > MAX_IMAGE_BYTES)
    throw new MarketplaceError(
      413,
      "IMAGE_TOO_LARGE",
      "Images must be at most 5 MiB.",
    );
  const mediaType = detectImageType(bytes);
  if (!mediaType)
    throw new MarketplaceError(
      415,
      "INVALID_IMAGE",
      "Upload a JPG, PNG or WEBP image.",
    );
  const imageKey = newImageKey(seller.id);
  await imageStore().put(imageKey, bytes, {
    mediaType,
    byteSize: bytes.length,
  });
  return { imageKey, imageUrl: imageUrl(imageKey) };
}

/**
 * Metadata of images an offer of `sellerId` wants to attach. Every key must
 * have been uploaded for this shop.
 */
export async function imageMetaFor(
  sellerId: string,
  keys: readonly string[],
): Promise<Map<string, ImageMeta>> {
  const result = new Map<string, ImageMeta>();
  for (const key of keys) {
    if (sellerOfImageKey(key) !== sellerId)
      throw forbidden("An image is unavailable to this seller.");
    const meta = await imageStore().head(key);
    if (!meta)
      throw invalid("An image was not uploaded. Upload it again.", {
        imageKeys: [`Unknown image ${key}.`],
      });
    result.set(key, meta);
  }
  return result;
}

/**
 * An image is visible to everyone once a public offer uses it. Otherwise only
 * to members of its shop, and attached images also to offer moderators.
 * Anything else answers 404 so image keys reveal nothing.
 */
export async function getListingImage(actor: Actor | null, imageKey: string) {
  const missing = notFound("IMAGE_NOT_FOUND", "Image not found.");
  const sellerId = sellerOfImageKey(imageKey);
  if (!sellerId) throw missing;
  const row = await db.offerImage.findUnique({
    where: { storageKey: imageKey },
    select: {
      offer: {
        select: {
          sellerId: true,
          status: true,
          seller: { select: { status: true } },
          product: { select: { status: true } },
        },
      },
    },
  });
  if (row && row.offer.sellerId !== sellerId) throw missing;
  const isPublicImage =
    row !== null &&
    isPublic(
      lower<OfferStatus>(row.offer.status),
      lower<SellerStatus>(row.offer.seller.status),
      lower<ProductStatus>(row.offer.product.status),
    );
  if (!isPublicImage) {
    const isModerator =
      row !== null &&
      actor?.permissions.has("marketplace:moderate-offers") === true;
    const isMember =
      actor !== null &&
      (await db.sellerMember.count({
        where: { sellerId, userId: actor.userId },
      })) > 0;
    if (!isModerator && !isMember) throw missing;
  }
  const image = await imageStore().get(imageKey);
  if (!image) throw missing;
  return { ...image, isPublic: isPublicImage };
}
