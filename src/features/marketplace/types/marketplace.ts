// Response shapes of the Marketplace contract (api/openapi.yaml). Client-safe.

export const CATEGORIES = [
  "electronics",
  "clothing",
  "shoes",
  "home_kitchen",
  "sports_outdoors",
  "beauty_personal_care",
  "books_stationery",
  "toys_games",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  electronics: "Electronics",
  clothing: "Clothing",
  shoes: "Shoes",
  home_kitchen: "Home & Kitchen",
  sports_outdoors: "Sports & Outdoors",
  beauty_personal_care: "Beauty & Personal Care",
  books_stationery: "Books & Stationery",
  toys_games: "Toys & Games",
  other: "Other",
};

export type SellerStatus = "pending" | "active" | "suspended" | "terminated";
export type OfferStatus =
  "draft" | "pending" | "active" | "rejected" | "blocked" | "removed";
export type InvoiceStatus = "pending" | "invoiced" | "refused";
export type Availability = "in_stock" | "out_of_stock";

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

/** A shop with private details: only for its owner and moderators. */
export type SellerAccount = Seller & {
  userId: string;
  legalName: string;
  contactEmail: string;
  address: Address;
  statusReason: string | null;
};

export type Variation = {
  variationId: string;
  label: string;
  priceMinor: number;
  currency: "EUR";
  stock: number;
  availability: Availability;
  imageIds: string[];
  imageUrls: string[];
  inheritsImages: boolean;
};

export type Offer = {
  offerId: string;
  productId: string;
  sellerId: string;
  name: string;
  description: string;
  category: Category;
  attributes: Record<string, string>;
  priceMinor: number;
  startingPriceMinor: number;
  maximumPriceMinor: number;
  currency: "EUR";
  stock: number;
  availability: Availability;
  imageIds: string[];
  imageUrls: string[];
  variations: Variation[];
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  weightGrams: number | null;
  status: OfferStatus;
  statusReason: string | null;
  updatedAt: string;
};

export type Product = Offer & { sellerDisplayName: string };

export type SaleLine = {
  saleId: string;
  orderId: string;
  offerId: string;
  sellerId: string;
  quantity: number;
  unitPriceMinor: number;
  grossMinor: number;
  currency: "EUR";
  soldAt: string;
  invoiceStatus: InvoiceStatus;
  invoiceId: string | null;
  invoiceError: string | null;
};

export type CatalogPage = { items: Offer[]; nextCursor: string | null };

export type MyShop = {
  seller: SellerAccount | null;
  /** Reason of the latest rejected registration when there is no current shop. */
  rejectedReason: string | null;
};

export type UploadedImage = { imageId: string; imageUrl: string };

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
};
