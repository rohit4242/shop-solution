import "server-only";
import { randomBytes } from "node:crypto";
import type {
  MarketplaceOffer,
  MarketplaceOfferVariation,
  MarketplaceSaleLine,
  MarketplaceSeller,
} from "@/generated/prisma/client";
import type {
  Category,
  Offer,
  SaleLine,
  Seller,
  SellerAccount,
} from "../../types/marketplace";
import { totals, type OfferState } from "../services/rules";

// Database rows → contract shapes. The only place that knows both.

export const newId = {
  seller: () => "sel_" + randomBytes(8).toString("hex"),
  offer: () => randomBytes(8).toString("hex"), // shared suffix of off_… and prd_…
  variation: () => "var_" + randomBytes(16).toString("hex"),
  image: () => "img_" + randomBytes(16).toString("hex"),
  sale: () => "sal_" + randomBytes(8).toString("hex"),
};

export const imageUrl = (imageId: string) =>
  `/api/v1/marketplace/images/${imageId}`;

export type OfferRow = MarketplaceOffer & {
  variations: MarketplaceOfferVariation[];
};

/** Includes for loading an offer with what its contract shape needs. */
export const offerInclude = {
  variations: { orderBy: { position: "asc" } },
} as const;

export function toSeller(row: MarketplaceSeller): Seller {
  return {
    sellerId: row.id,
    displayName: row.displayName,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toSellerAccount(row: MarketplaceSeller): SellerAccount {
  return {
    ...toSeller(row),
    userId: row.userId,
    legalName: row.legalName,
    contactEmail: row.contactEmail,
    address: {
      street: row.addressStreet,
      postalCode: row.addressPostalCode,
      city: row.addressCity,
      country: row.addressCountry,
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

export function toOfferState(row: OfferRow): OfferState {
  return {
    status: row.status,
    name: row.name,
    description: row.description,
    category: row.category,
    attributes: attributesOf(row.attributes),
    imageIds: row.imageIds,
    priceMinor: row.priceMinor,
    stock: row.stock,
    lengthCm: row.lengthCm,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    weightGrams: row.weightGrams,
    variations: row.variations.map((v) => ({
      id: v.id,
      label: v.label,
      priceMinor: v.priceMinor,
      stock: v.stock,
      imageIds: v.imageIds,
    })),
  };
}

export function toOffer(row: OfferRow): Offer {
  const prices = row.variations.map((v) => v.priceMinor);
  const { priceMinor } = totals(row.variations, row);
  const imageUrls = row.imageIds.map(imageUrl);
  return {
    offerId: row.id,
    productId: row.productId,
    sellerId: row.sellerId,
    name: row.name,
    description: row.description,
    category: row.category as Category,
    attributes: attributesOf(row.attributes),
    priceMinor,
    startingPriceMinor: priceMinor,
    maximumPriceMinor: prices.length ? Math.max(...prices) : row.priceMinor,
    currency: "EUR",
    stock: row.stock,
    availability: row.stock > 0 ? "in_stock" : "out_of_stock",
    imageIds: row.imageIds,
    imageUrls,
    variations: row.variations.map((v) => ({
      variationId: v.id,
      label: v.label,
      priceMinor: v.priceMinor,
      currency: "EUR",
      stock: v.stock,
      availability: v.stock > 0 ? "in_stock" : "out_of_stock",
      imageIds: v.imageIds,
      imageUrls: v.imageIds.length ? v.imageIds.map(imageUrl) : imageUrls,
      inheritsImages: v.imageIds.length === 0,
    })),
    lengthCm: row.lengthCm,
    widthCm: row.widthCm,
    heightCm: row.heightCm,
    weightGrams: row.weightGrams,
    status: row.status,
    statusReason: row.statusReason,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toSaleLine(row: MarketplaceSaleLine): SaleLine {
  return {
    saleId: row.id,
    orderId: row.orderId,
    offerId: row.offerId,
    sellerId: row.sellerId,
    quantity: row.quantity,
    unitPriceMinor: row.unitPriceMinor,
    grossMinor: row.unitPriceMinor * row.quantity,
    currency: "EUR",
    soldAt: row.soldAt.toISOString(),
    invoiceStatus: row.invoiceStatus,
    invoiceId: row.invoiceId,
    invoiceError: row.invoiceError,
  };
}
