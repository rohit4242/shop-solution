import type { Offer } from "../types/marketplace";

// What the product form sends: the full desired state of an offer.
export type OfferDraft = {
  name: string;
  description: string;
  category: Offer["category"];
  imageIds: string[];
  priceMinor: number | null;
  stock: number | null;
  variations: {
    variationId?: string;
    label: string;
    priceMinor: number;
    stock: number;
    imageIds: string[];
  }[];
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightGrams: number | null;
};

const MEASUREMENTS = [
  "lengthCm",
  "widthCm",
  "heightCm",
  "weightGrams",
] as const;
const same = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Body for createOffer. */
export function createBody(draft: OfferDraft) {
  const hasVariations = draft.variations.length > 0;
  return {
    name: draft.name,
    description: draft.description,
    category: draft.category,
    imageIds: draft.imageIds,
    ...(hasVariations
      ? {
          variations: draft.variations.map((v) => ({
            label: v.label,
            priceMinor: v.priceMinor,
            stock: v.stock,
            imageIds: v.imageIds,
          })),
        }
      : { priceMinor: draft.priceMinor, stock: draft.stock }),
    ...Object.fromEntries(
      MEASUREMENTS.filter((key) => draft[key] !== null).map((key) => [
        key,
        draft[key],
      ]),
    ),
  };
}

/** Body for updateOffer: only what changed. Empty when nothing changed. */
export function changedFields(
  offer: Offer,
  draft: OfferDraft,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  if (draft.name !== offer.name) changes.name = draft.name;
  if (draft.description !== offer.description)
    changes.description = draft.description;
  if (draft.category !== offer.category) changes.category = draft.category;
  if (!same(draft.imageIds, offer.imageIds)) changes.imageIds = draft.imageIds;

  const before = offer.variations.map((v) => ({
    variationId: v.variationId,
    label: v.label,
    priceMinor: v.priceMinor,
    stock: v.stock,
    imageIds: v.imageIds,
  }));
  const after = draft.variations.map((v) => ({
    variationId: v.variationId,
    label: v.label,
    priceMinor: v.priceMinor,
    stock: v.stock,
    imageIds: v.imageIds,
  }));
  if (after.length > 0) {
    if (!same(after, before)) changes.variations = after;
  } else {
    if (before.length > 0) changes.variations = [];
    if (
      draft.priceMinor !== null &&
      (before.length > 0 || draft.priceMinor !== offer.priceMinor)
    )
      changes.priceMinor = draft.priceMinor;
    if (
      draft.stock !== null &&
      (before.length > 0 || draft.stock !== offer.stock)
    )
      changes.stock = draft.stock;
  }
  for (const key of MEASUREMENTS)
    if (draft[key] !== offer[key]) changes[key] = draft[key];
  return changes;
}
