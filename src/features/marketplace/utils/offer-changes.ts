import type { Offer } from "../types/marketplace";

// What the product form sends: the full desired state of an offer.
export type OfferDraft = {
  name: string;
  description: string;
  categorySlug: string;
  imageKeys: string[];
  priceMinor: number | null;
  stock: number | null;
  variations: {
    offerItemId?: string;
    label: string;
    priceMinor: number;
    stock: number;
    imageKeys: string[];
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

/** The variations of an offer as the form edits them. Empty without variations. */
export const variationsOf = (offer: Offer): OfferDraft["variations"] =>
  offer.hasVariations
    ? offer.items.map((item) => ({
        offerItemId: item.offerItemId,
        label: item.label,
        priceMinor: item.priceMinor,
        stock: item.stock,
        imageKeys: item.inheritsImages
          ? []
          : item.images.map((image) => image.imageKey),
      }))
    : [];

/** Body for createOffer. */
export function createBody(draft: OfferDraft) {
  const hasVariations = draft.variations.length > 0;
  return {
    name: draft.name,
    description: draft.description,
    categorySlug: draft.categorySlug,
    imageKeys: draft.imageKeys,
    ...(hasVariations
      ? {
          variations: draft.variations.map((v) => ({
            label: v.label,
            priceMinor: v.priceMinor,
            stock: v.stock,
            imageKeys: v.imageKeys,
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
  if (draft.categorySlug !== offer.categorySlug)
    changes.categorySlug = draft.categorySlug;
  const imageKeys = offer.images.map((image) => image.imageKey);
  if (!same(draft.imageKeys, imageKeys)) changes.imageKeys = draft.imageKeys;

  const before = variationsOf(offer);
  const after = draft.variations.map((v) => ({
    offerItemId: v.offerItemId,
    label: v.label,
    priceMinor: v.priceMinor,
    stock: v.stock,
    imageKeys: v.imageKeys,
  }));
  if (after.length > 0) {
    if (!same(after, before)) changes.variations = after;
  } else {
    const base = offer.items[0];
    if (before.length > 0) changes.variations = [];
    if (
      draft.priceMinor !== null &&
      (before.length > 0 || draft.priceMinor !== base?.priceMinor)
    )
      changes.priceMinor = draft.priceMinor;
    if (
      draft.stock !== null &&
      (before.length > 0 || draft.stock !== base?.stock)
    )
      changes.stock = draft.stock;
  }
  for (const key of MEASUREMENTS)
    if (draft[key] !== offer[key]) changes[key] = draft[key];
  return changes;
}
