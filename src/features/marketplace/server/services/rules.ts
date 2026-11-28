import "server-only";
import type {
  OfferStatus,
  ProductStatus,
  SellerStatus,
} from "../../types/marketplace";
import type {
  CreateOfferInput,
  UpdateOfferInput,
} from "../../schemas/marketplace.schema";
import { MEASUREMENT_FIELDS } from "../../schemas/marketplace.schema";
import { conflict, invalid } from "../errors";

// Pure business rules, shared by every entry point and unit-tested directly.
// They work on contract (lowercase) statuses; mappers translate DB enums.

/** Public catalog reads need the offer, its shop and its product to be active. */
export const isPublic = (
  offer: OfferStatus,
  seller: SellerStatus,
  product: ProductStatus,
) => offer === "active" && seller === "active" && product === "active";

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

export type Measurements = Record<
  (typeof MEASUREMENT_FIELDS)[number],
  number | null
>;

/** An active offer item as the rules see it. */
export type ItemState = {
  id: string;
  label: string;
  isDefault: boolean;
  priceMinor: number;
  stock: number;
  /** Units reserved by checkouts (`InventoryBalance.held`). */
  held: number;
  imageKeys: string[];
};

export type OfferState = Measurements & {
  status: OfferStatus;
  name: string;
  description: string;
  categorySlug: string;
  attributes: Record<string, string>;
  imageKeys: string[];
  items: ItemState[];
};

/** An item the service should end up with. `id: null` creates (or revives) one. */
export type PlannedItem = {
  id: string | null;
  label: string;
  isDefault: boolean;
  priceMinor: number;
  stock: number;
  imageKeys: string[];
};

export type OfferPlan = Measurements & {
  name: string;
  description: string;
  categorySlug: string;
  attributes: Record<string, string>;
  imageKeys: string[];
  items: PlannedItem[];
  /** Offer items to deactivate: removed variations or the replaced default item. */
  deactivate: string[];
  /** Product facts (name, text, category, attributes, measurements) changed. */
  productChanged: boolean;
  status: OfferStatus;
  statusReason: string | null | undefined;
};

/** Label of the default variant of a product without variations. */
export const DEFAULT_LABEL = "Standard";

/** The planned items of a new offer: one default item, or one per variation. */
export function planNewItems(input: CreateOfferInput): PlannedItem[] {
  if (input.variations.length === 0)
    return [
      {
        id: null,
        label: DEFAULT_LABEL,
        isDefault: true,
        priceMinor: input.priceMinor ?? 0,
        stock: input.stock ?? 0,
        imageKeys: [],
      },
    ];
  return input.variations.map((v) => ({
    id: null,
    label: v.label,
    isDefault: false,
    priceMinor: v.priceMinor,
    stock: v.stock,
    imageKeys: v.imageKeys,
  }));
}

/** Every image key an offer uses must be distinct (one `OfferImage` row each). */
export function assertDistinctImages(
  offerImages: readonly string[],
  items: readonly { imageKeys: readonly string[] }[],
) {
  const all = [...offerImages, ...items.flatMap((item) => item.imageKeys)];
  if (new Set(all).size !== all.length)
    throw invalid("Each image can be used once per offer.", {
      imageKeys: ["Each image can be used once per offer."],
    });
}

/** Stock can never fall below what checkouts already hold. */
export function assertStockCoversHeld(
  items: readonly { id: string | null; stock: number }[],
  current: readonly ItemState[],
) {
  const held = new Map(current.map((item) => [item.id, item.held]));
  for (const item of items) {
    const reserved = item.id ? (held.get(item.id) ?? 0) : 0;
    if (item.stock < reserved)
      throw conflict(
        "STOCK_BELOW_HELD",
        `Stock cannot be lower than the ${reserved} units held by open checkouts.`,
      );
  }
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

/** What customers read about the items: which exist, labels and images. */
const itemContent = (items: readonly (ItemState | PlannedItem)[]) =>
  JSON.stringify(
    items.map((item) => [item.id, item.isDefault, item.label, item.imageKeys]),
  );

function planItems(
  current: OfferState,
  input: UpdateOfferInput,
): { items: PlannedItem[]; deactivate: string[] } {
  const hasVariations = current.items.some((item) => !item.isDefault);
  const keep = (item: ItemState): PlannedItem => ({
    id: item.id,
    label: item.label,
    isDefault: item.isDefault,
    priceMinor: item.priceMinor,
    stock: item.stock,
    imageKeys: item.imageKeys,
  });

  // Variations stay as they are (or the product keeps having none).
  if (
    input.variations === undefined ||
    (input.variations.length === 0 && !hasVariations)
  ) {
    if (hasVariations && input.priceMinor !== undefined)
      throw invalid("Each variation has its own price.", {
        priceMinor: ["Each variation has its own price."],
      });
    if (hasVariations && input.stock !== undefined)
      throw invalid("Stock is calculated from the variations.", {
        stock: ["Stock is calculated from the variations."],
      });
    return {
      items: current.items.map((item) =>
        item.isDefault
          ? {
              ...keep(item),
              priceMinor: input.priceMinor ?? item.priceMinor,
              stock: input.stock ?? item.stock,
            }
          : keep(item),
      ),
      deactivate: [],
    };
  }

  // Variations turned off: back to a single default item.
  if (input.variations.length === 0) {
    if (input.priceMinor === undefined || input.stock === undefined)
      throw invalid("Set price and stock when you turn variations off.", {
        priceMinor: ["Set price and stock when you turn variations off."],
      });
    return {
      items: [
        {
          id: null,
          label: DEFAULT_LABEL,
          isDefault: true,
          priceMinor: input.priceMinor,
          stock: input.stock,
          imageKeys: [],
        },
      ],
      deactivate: current.items.map((item) => item.id),
    };
  }

  // A new list of variations. Existing ones are referenced by offerItemId.
  const known = new Map(
    current.items.filter((i) => !i.isDefault).map((i) => [i.id, i]),
  );
  const seen = new Set<string>();
  const items = input.variations.map((v): PlannedItem => {
    if (v.offerItemId) {
      if (!known.has(v.offerItemId) || seen.has(v.offerItemId))
        throw invalid("Use each existing variation ID at most once.", {
          variations: ["Unknown or repeated variation ID."],
        });
      seen.add(v.offerItemId);
    }
    return {
      id: v.offerItemId ?? null,
      label: v.label,
      isDefault: false,
      priceMinor: v.priceMinor,
      stock: v.stock,
      imageKeys: v.imageKeys,
    };
  });
  return {
    items,
    deactivate: current.items
      .filter((item) => !seen.has(item.id))
      .map((i) => i.id),
  };
}

/**
 * Applies an update to an offer. Changing what customers read (text,
 * category, attributes, images, which variations exist, their labels or
 * images, measurements) sends an active offer back to review; price and
 * stock do not. Every edit of a rejected offer resubmits it. Blocked and
 * removed offers are locked.
 */
export function planOfferUpdate(
  current: OfferState,
  input: UpdateOfferInput,
): OfferPlan {
  if (current.status === "blocked" || current.status === "removed")
    throw conflict(
      "OFFER_LOCKED",
      `This offer is ${current.status} and cannot be changed.`,
    );

  const { items, deactivate } = planItems(current, input);
  const next = {
    name: input.name ?? current.name,
    description: input.description ?? current.description,
    categorySlug: input.categorySlug ?? current.categorySlug,
    attributes: input.attributes ?? current.attributes,
    imageKeys: input.imageKeys ?? current.imageKeys,
  };
  const measurements = Object.fromEntries(
    MEASUREMENT_FIELDS.map((key) => [
      key,
      input[key] === undefined ? current[key] : input[key],
    ]),
  ) as Measurements;
  assertDistinctImages(next.imageKeys, items);
  assertStockCoversHeld(items, current.items);

  const productChanged =
    next.name !== current.name ||
    next.description !== current.description ||
    next.categorySlug !== current.categorySlug ||
    !sameRecord(next.attributes, current.attributes) ||
    MEASUREMENT_FIELDS.some((key) => measurements[key] !== current[key]);
  const contentChanged =
    productChanged ||
    !sameList(next.imageKeys, current.imageKeys) ||
    itemContent(items) !== itemContent(current.items);

  const backToReview =
    current.status === "rejected" ||
    (current.status === "active" && contentChanged);

  return {
    ...next,
    ...measurements,
    items,
    deactivate,
    productChanged,
    status: backToReview ? "pending" : current.status,
    statusReason: backToReview ? null : undefined,
  };
}

/** Cheapest and dearest item price, and the stock total. */
export function totals(
  items: readonly { priceMinor: number; stock: number; available: number }[],
) {
  const prices = items.map((item) => item.priceMinor);
  return {
    priceMinor: prices.length ? Math.min(...prices) : 0,
    maximumPriceMinor: prices.length ? Math.max(...prices) : 0,
    stock: items.reduce((sum, item) => sum + item.stock, 0),
    available: items.reduce((sum, item) => sum + item.available, 0),
  };
}

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

/** The seller an image key was issued to (`mkt_<sellerId>_<random>`). */
export function sellerOfImageKey(imageKey: string): string | null {
  const match = /^mkt_([A-Za-z0-9_-]{1,64})_[a-f0-9]{32}$/.exec(imageKey);
  return match ? match[1] : null;
}

const CURSOR =
  /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\|([A-Za-z0-9_-]{1,64})$/;

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
