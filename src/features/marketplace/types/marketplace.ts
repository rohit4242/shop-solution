// Response shapes of the Marketplace contract (api/openapi.yaml). Client-safe.
// They are read from the canonical shop tables (prisma/schema.prisma):
// Seller + SellerMember, Product + ProductVariant, Offer + OfferItem,
// InventoryBalance, OfferImage and, for sales, OrderLine.

export type SellerStatus = "pending" | "active" | "suspended" | "terminated";
export type OfferStatus =
  "draft" | "pending" | "active" | "rejected" | "blocked" | "removed";
export type ProductStatus = "draft" | "active" | "archived";
export type OrderStatus = "placed" | "cancelled" | "completed";
export type Availability = "in_stock" | "out_of_stock";

/** Code of the single variant that a product without variations has. */
export const DEFAULT_VARIANT_CODE = "default";

export type Address = {
  street: string;
  postalCode: string;
  city: string;
  country: string;
};

/** Public view of a shop. */
export type Seller = {
  sellerId: string;
  displayName: string;
  status: SellerStatus;
  createdAt: string;
};

/** A shop with private details: only for its members and seller moderators. */
export type SellerAccount = Seller & {
  legalName: string;
  contactEmail: string;
  address: Address;
  statusReason: string | null;
};

/** A category from the shared catalog (`Category`). */
export type Category = { slug: string; name: string };

export type ListingImage = {
  /** `OfferImage.storageKey`. Send it back to keep the image when editing. */
  imageKey: string;
  imageUrl: string;
};

/** One sellable item of an offer (`OfferItem`) with its variant and stock. */
export type OfferItem = {
  offerItemId: string;
  productVariantId: string;
  variantCode: string;
  label: string;
  priceMinor: number;
  currency: string;
  /** `InventoryBalance.onHand`: what the seller has. */
  stock: number;
  /** `onHand − held`: what customers can still buy. */
  available: number;
  availability: Availability;
  images: ListingImage[];
  /** The item has no own images and shows the offer images. */
  inheritsImages: boolean;
};

export type Offer = {
  offerId: string;
  productId: string;
  sellerId: string;
  name: string;
  description: string;
  categorySlug: string;
  attributes: Record<string, string>;
  /** False when the only item is the product's default variant. */
  hasVariations: boolean;
  /** Active items only, in variant order. Always at least one. */
  items: OfferItem[];
  /** The cheapest item. */
  priceMinor: number;
  maximumPriceMinor: number;
  currency: string;
  /** Sum of item stock. */
  stock: number;
  availability: Availability;
  images: ListingImage[];
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightGrams: number | null;
  status: OfferStatus;
  statusReason: string | null;
  updatedAt: string;
};

/** A public offer in a product page, with the shop name. */
export type ProductOffer = Offer & { sellerDisplayName: string };

/** A catalog product and every public offer for it. */
export type Product = {
  productId: string;
  name: string;
  description: string;
  categorySlug: string;
  attributes: Record<string, string>;
  status: ProductStatus;
  offers: ProductOffer[];
};

/** One purchased order line of this shop's offers (read from `OrderLine`). */
export type SaleLine = {
  orderLineId: string;
  orderId: string;
  offerId: string;
  offerItemId: string;
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  currency: string;
  placedAt: string;
  orderStatus: OrderStatus;
  /** At least one confirmed payment exists for the order. */
  paid: boolean;
};

export type CatalogPage = { items: Offer[]; nextCursor: string | null };

export type MyShop = {
  seller: SellerAccount | null;
  /** Reason of the latest rejected registration when there is no current shop. */
  rejectedReason: string | null;
};

export type UploadedImage = ListingImage;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};
