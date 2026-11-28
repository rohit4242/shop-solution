import "server-only";
import { randomBytes } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  DEFAULT_VARIANT_CODE,
  type ListingImage,
  type Offer,
  type OfferItem,
  type OfferStatus,
  type OrderStatus,
  type ProductStatus,
  type SaleLine,
  type Seller,
  type SellerAccount,
  type SellerStatus,
} from "../../types/marketplace";
import { totals, type OfferState } from "../services/rules";

// Canonical shop rows → Marketplace contract shapes. The only place that
// knows both. Database enums are uppercase; the contract uses lowercase.

export const lower = <T extends string>(value: string) =>
  value.toLowerCase() as T;
export const upper = <T extends string>(value: string) =>
  value.toUpperCase() as T;

export const newImageKey = (sellerId: string) =>
  `mkt_${sellerId}_${randomBytes(16).toString("hex")}`;
export const newVariantCode = () => "v_" + randomBytes(6).toString("hex");

export const imageUrl = (imageKey: string) =>
  `/api/v1/marketplace/images/${imageKey}`;

/** What every offer read loads. Inactive offer items are history, not listing. */
export const offerInclude = {
  product: { include: { category: true } },
  seller: true,
  images: { where: { offerItemId: null }, orderBy: { position: "asc" } },
  items: {
    where: { active: true },
    orderBy: { id: "asc" },
    include: {
      productVariant: true,
      inventory: true,
      images: { orderBy: { position: "asc" } },
    },
  },
} satisfies Prisma.OfferInclude;

export type OfferRow = Prisma.OfferGetPayload<{
  include: typeof offerInclude;
}>;
type ItemRow = OfferRow["items"][number];
type SellerRow = Prisma.SellerGetPayload<object>;

export function toSeller(row: SellerRow): Seller {
  return {
    sellerId: row.id,
    displayName: row.displayName,
    status: lower<SellerStatus>(row.status),
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSellerAccount(row: SellerRow): SellerAccount {
  return {
    ...toSeller(row),
    legalName: row.legalName,
    contactEmail: row.contactEmail,
    address: {
      street: row.street,
      postalCode: row.postalCode,
      city: row.city,
      country: row.country,
    },
    statusReason: row.statusReason,
  };
}

export const attributesOf = (value: unknown): Record<string, string> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      )
    : {};

const toImage = (row: { storageKey: string }): ListingImage => ({
  imageKey: row.storageKey,
  imageUrl: imageUrl(row.storageKey),
});

const isDefaultItem = (item: ItemRow) =>
  item.productVariant.code === DEFAULT_VARIANT_CODE;

function toItem(item: ItemRow, offerImages: ListingImage[]): OfferItem {
  const stock = item.inventory?.onHand ?? 0;
  const available = Math.max(0, stock - (item.inventory?.held ?? 0));
  const own = item.images.map(toImage);
  return {
    offerItemId: item.id,
    productVariantId: item.productVariantId,
    variantCode: item.productVariant.code,
    label: item.productVariant.label,
    priceMinor: item.priceMinor,
    currency: item.currency,
    stock,
    available,
    availability: available > 0 ? "in_stock" : "out_of_stock",
    images: own.length ? own : offerImages,
    inheritsImages: own.length === 0,
  };
}

/** Measurements live on the variants; the offer shows the first item's. */
const measurementsOf = (row: OfferRow) => {
  const variant = row.items[0]?.productVariant;
  return {
    lengthCm: variant?.lengthCm ?? null,
    widthCm: variant?.widthCm ?? null,
    heightCm: variant?.heightCm ?? null,
    weightGrams: variant?.weightGrams ?? null,
  };
};

export function toOffer(row: OfferRow): Offer {
  const images = row.images.map(toImage);
  const items = row.items.map((item) => toItem(item, images));
  const sum = totals(items);
  return {
    offerId: row.id,
    productId: row.productId,
    sellerId: row.sellerId,
    name: row.product.name,
    description: row.product.description,
    categorySlug: row.product.category.slug,
    attributes: attributesOf(row.product.attributes),
    hasVariations: !(row.items.length === 1 && isDefaultItem(row.items[0])),
    items,
    priceMinor: sum.priceMinor,
    maximumPriceMinor: sum.maximumPriceMinor,
    currency: items[0]?.currency ?? "EUR",
    stock: sum.stock,
    availability: sum.available > 0 ? "in_stock" : "out_of_stock",
    images,
    ...measurementsOf(row),
    status: lower<OfferStatus>(row.status),
    statusReason: row.statusReason,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const productStatusOf = (row: OfferRow) =>
  lower<ProductStatus>(row.product.status);

export function toOfferState(row: OfferRow): OfferState {
  return {
    status: lower<OfferStatus>(row.status),
    name: row.product.name,
    description: row.product.description,
    categorySlug: row.product.category.slug,
    attributes: attributesOf(row.product.attributes),
    imageKeys: row.images.map((image) => image.storageKey),
    ...measurementsOf(row),
    items: row.items.map((item) => ({
      id: item.id,
      label: item.productVariant.label,
      isDefault: isDefaultItem(item),
      priceMinor: item.priceMinor,
      stock: item.inventory?.onHand ?? 0,
      held: item.inventory?.held ?? 0,
      imageKeys: item.images.map((image) => image.storageKey),
    })),
  };
}

/** Order line with what a seller's sales view needs. */
export const saleInclude = {
  order: {
    select: {
      status: true,
      currency: true,
      placedAt: true,
      payments: { where: { status: "CONFIRMED" }, select: { id: true } },
    },
  },
  offerItem: { select: { offerId: true } },
} satisfies Prisma.OrderLineInclude;

export type SaleRow = Prisma.OrderLineGetPayload<{
  include: typeof saleInclude;
}>;

export function toSaleLine(row: SaleRow): SaleLine {
  return {
    orderLineId: row.id,
    orderId: row.orderId,
    offerId: row.offerItem.offerId,
    offerItemId: row.offerItemId,
    productName: row.productName,
    variantLabel: row.variantLabel,
    quantity: row.quantity,
    unitPriceMinor: row.unitPriceMinor,
    totalMinor: row.totalMinor,
    currency: row.order.currency,
    placedAt: row.order.placedAt.toISOString(),
    orderStatus: lower<OrderStatus>(row.order.status),
    paid: row.order.payments.length > 0,
  };
}
