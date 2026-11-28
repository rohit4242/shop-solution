import "server-only";
import type { OfferStatus, SellerStatus } from "../../types/marketplace";
import type { UpdateOfferInput } from "../../schemas/marketplace.schema";
import { MEASUREMENT_FIELDS } from "../../schemas/marketplace.schema";
import { conflict, invalid } from "../errors";

// Pure business rules, shared by every entry point and unit-tested directly.

export const isPublic = (offer: OfferStatus, seller: SellerStatus) =>
  offer === "active" && seller === "active";

/** Suspended and terminated shops cannot change details or list products. */
export function assertSellerCanChange(status: SellerStatus) {
  if (status === "suspended" || status === "terminated")
    throw conflict(
      "SELLER_NOT_ALLOWED",
      `This shop is ${status} and cannot be changed or list products.`,
    );
}

export function assertPending(
  kind: "Seller" | "Offer",
  id: string,
  status: string,
) {
  if (status !== "pending")
    throw conflict(
      "INVALID_STATUS_CHANGE",
      `${kind} ${id} is ${status}, not pending.`,
    );
}

export type VariationRecord = {
  id: string;
  label: string;
  priceMinor: number;
  stock: number;
  imageIds: string[];
};

export type Measurements = Record<
  (typeof MEASUREMENT_FIELDS)[number],
  number | null
>;

export type OfferState = Measurements & {
  status: OfferStatus;
  name: string;
  description: string;
  category: string;
  attributes: Record<string, string>;
  imageIds: string[];
  priceMinor: number;
  stock: number;
  variations: VariationRecord[];
};

export type OfferPlan = Omit<OfferState, "status"> & {
  status: OfferStatus;
  statusReason: string | null | undefined;
};

/** Price and stock of an offer: the cheapest variation and the variation total, if any. */
export function totals(
  variations: Pick<VariationRecord, "priceMinor" | "stock">[],
  base: { priceMinor: number; stock: number },
) {
  if (variations.length === 0) return base;
  return {
    priceMinor: Math.min(...variations.map((v) => v.priceMinor)),
    stock: variations.reduce((sum, v) => sum + v.stock, 0),
  };
}

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const sameRecord = (a: Record<string, string>, b: Record<string, string>) => {
  const keys = Object.keys(a);
  return (
    keys.length === Object.keys(b).length &&
    keys.every((key) => Object.hasOwn(b, key) && a[key] === b[key])
  );
};

const variationContent = (variations: VariationRecord[]) =>
  JSON.stringify(
    variations
      .map((v) => [v.id, v.label, v.imageIds] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );

/**
 * Applies an update to an offer. Changing what customers read (text, category,
 * attributes, images, variation labels or images, measurements) sends an
 * active offer back to review; price and stock do not. Every edit of a
 * rejected offer resubmits it. Blocked and removed offers are locked.
 */
export function planOfferUpdate(
  current: OfferState,
  input: UpdateOfferInput,
  newVariationId: () => string,
): OfferPlan {
  if (current.status === "blocked" || current.status === "removed")
    throw conflict(
      "OFFER_LOCKED",
      `This offer is ${current.status} and cannot be changed.`,
    );

  let variations = current.variations;
  if (input.variations !== undefined) {
    const known = new Set(current.variations.map((v) => v.id));
    const seen = new Set<string>();
    variations = input.variations.map((v) => {
      if (
        v.variationId &&
        (!known.has(v.variationId) || seen.has(v.variationId))
      )
        throw invalid("Use each existing variation ID at most once.", {
          variations: ["Unknown or repeated variation ID."],
        });
      const id = v.variationId ?? newVariationId();
      seen.add(id);
      return {
        id,
        label: v.label,
        priceMinor: v.priceMinor,
        stock: v.stock,
        imageIds: v.imageIds,
      };
    });
  }
  if (variations.length > 0 && input.stock !== undefined)
    throw invalid("Stock is calculated from the variations.", {
      stock: ["Stock is calculated from the variations."],
    });
  if (
    current.variations.length > 0 &&
    variations.length === 0 &&
    input.stock === undefined
  )
    throw invalid("Set the product stock when you turn variations off.", {
      stock: ["Set the product stock when you turn variations off."],
    });

  const next = {
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    category: input.category ?? current.category,
    attributes: input.attributes ?? current.attributes,
    imageIds: input.imageIds ?? current.imageIds,
  };
  const measurements = Object.fromEntries(
    MEASUREMENT_FIELDS.map((key) => [
      key,
      input[key] === undefined ? current[key] : input[key],
    ]),
  ) as Measurements;

  const contentChanged =
    next.name !== current.name ||
    next.description !== current.description ||
    next.category !== current.category ||
    !sameRecord(next.attributes, current.attributes) ||
    !sameList(next.imageIds, current.imageIds) ||
    variationContent(variations) !== variationContent(current.variations) ||
    MEASUREMENT_FIELDS.some((key) => measurements[key] !== current[key]);

  const backToReview =
    current.status === "rejected" ||
    (current.status === "active" && contentChanged);

  const fallbackPrice =
    input.priceMinor ??
    (current.variations.length > 0
      ? totals(current.variations, current).priceMinor
      : current.priceMinor);
  const { priceMinor, stock } = totals(variations, {
    priceMinor: fallbackPrice,
    stock: input.stock ?? current.stock,
  });

  return {
    ...next,
    ...measurements,
    variations,
    priceMinor,
    stock,
    status: backToReview ? "pending" : current.status,
    statusReason: backToReview ? null : undefined,
  };
}

/** Every image an offer references, offer images first. */
export const offerImageIds = (offer: {
  imageIds: string[];
  variations: { imageIds: string[] }[];
}) => [
  ...new Set([
    ...offer.imageIds,
    ...offer.variations.flatMap((v) => v.imageIds),
  ]),
];

/** Detects JPG, PNG and WEBP from their file signatures. */
export function detectImageType(bytes: Uint8Array): string | null {
  const starts = (signature: number[], offset = 0) =>
    signature.every((byte, index) => bytes[offset + index] === byte);
  if (bytes.length < 12) return null;
  if (starts([0xff, 0xd8, 0xff])) return "image/jpeg";
  if (starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return "image/png";
  if (starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8))
    return "image/webp";
  return null;
}

const CURSOR =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\|(off_[a-z0-9]+)$/;

export const encodeCursor = (updatedAt: Date, offerId: string) =>
  Buffer.from(`${updatedAt.toISOString()}|${offerId}`).toString("base64url");

export function decodeCursor(cursor: string): {
  updatedAt: Date;
  offerId: string;
} {
  const match = CURSOR.exec(Buffer.from(cursor, "base64url").toString());
  const updatedAt = match ? new Date(match[1]) : null;
  if (!match || !updatedAt || Number.isNaN(updatedAt.getTime()))
    throw invalid("Use nextCursor from the previous page unchanged.", {
      cursor: ["Use nextCursor from the previous page unchanged."],
    });
  return { updatedAt, offerId: match[2] };
}
