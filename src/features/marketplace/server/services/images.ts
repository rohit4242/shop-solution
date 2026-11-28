import "server-only";
import { db } from "@/server/db";
import type { UploadedImage } from "../../types/marketplace";
import { MAX_IMAGE_BYTES } from "../../schemas/marketplace.schema";
import type { Actor } from "../access";
import { MarketplaceError, notFound } from "../errors";
import { imageUrl, newId } from "../repositories/mappers";
import { ownSeller } from "./sellers";
import { assertSellerCanChange, detectImageType, isPublic } from "./rules";

export async function uploadListingImage(
  actor: Actor | null,
  sellerId: string,
  bytes: Uint8Array,
): Promise<UploadedImage> {
  const seller = await ownSeller(actor, sellerId);
  assertSellerCanChange(seller.status);
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
  const image = await db.marketplaceListingImage.create({
    data: {
      id: newId.image(),
      sellerId,
      mediaType,
      byteSize: bytes.length,
      data: Buffer.from(bytes),
    },
    select: { id: true },
  });
  return { imageId: image.id, imageUrl: imageUrl(image.id) };
}

/**
 * An image is visible to everyone once a public offer uses it; before that
 * only to its shop owner and to offer moderators (for offers using it).
 * Anything else answers 404 so image IDs reveal nothing.
 */
export async function getListingImage(actor: Actor | null, imageId: string) {
  const missing = notFound("IMAGE_NOT_FOUND", "Image not found.");
  const image = await db.marketplaceListingImage.findUnique({
    where: { id: imageId },
    include: { seller: true },
  });
  if (!image) throw missing;
  const users = await db.marketplaceOffer.findMany({
    where: {
      sellerId: image.sellerId,
      OR: [
        { imageIds: { has: imageId } },
        { variations: { some: { imageIds: { has: imageId } } } },
      ],
    },
    select: { status: true },
  });
  const isPublicImage = users.some((o) =>
    isPublic(o.status, image.seller.status),
  );
  const isOwner = actor?.userId === image.seller.userId;
  const isModerator =
    actor?.permissions.has("marketplace:moderate-offers") === true &&
    users.length > 0;
  if (!isPublicImage && !isOwner && !isModerator) throw missing;
  return {
    mediaType: image.mediaType,
    data: new Uint8Array(image.data),
    isPublic: isPublicImage,
  };
}
