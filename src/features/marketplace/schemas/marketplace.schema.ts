import { z } from "zod";
import { CATEGORIES } from "../types/marketplace";

// Runtime validation of every Marketplace input. Mirrors api/openapi.yaml.

export const SELLER_ID = /^sel_[a-z0-9]+$/;
export const OFFER_ID = /^off_[a-z0-9]+$/;
export const PRODUCT_ID = /^prd_[a-z0-9]+$/;
export const SALE_ID = /^sal_[a-z0-9]+$/;
export const IMAGE_ID = /^img_[a-f0-9]{32}$/;
export const VARIATION_ID = /^var_[a-f0-9]{32}$/;
// Orders have no agreed owner yet; accept the formats other teams already use (O-…, ORD-…, ord_…).
export const ORDER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRICE_MINOR = 10_000_000;
export const MAX_STOCK = 100_000;

export const sellerIdSchema = z.string().regex(SELLER_ID, "Invalid seller ID.");
export const offerIdSchema = z.string().regex(OFFER_ID, "Invalid offer ID.");
export const productIdSchema = z
  .string()
  .regex(PRODUCT_ID, "Invalid product ID.");
export const saleIdSchema = z.string().regex(SALE_ID, "Invalid sale ID.");
export const imageIdSchema = z.string().regex(IMAGE_ID, "Invalid image ID.");

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const addressSchema = z.strictObject({
  street: text(1, 100),
  postalCode: text(1, 12),
  city: text(1, 60),
  country: z
    .string()
    .trim()
    .regex(/^[A-Z]{2}$/, "Use a two-letter country code like DE."),
});

const sellerFields = {
  displayName: text(2, 60),
  legalName: text(2, 100),
  contactEmail: z.string().trim().max(120).pipe(z.email()),
  address: addressSchema,
};

export const registerSellerSchema = z.strictObject(sellerFields);
export type RegisterSellerInput = z.infer<typeof registerSellerSchema>;

export const updateSellerSchema = z
  .strictObject(sellerFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to change.",
  });
export type UpdateSellerInput = z.infer<typeof updateSellerSchema>;

export const rejectSchema = z.strictObject({ reason: text(3, 300) });

const priceMinor = z.number().int().min(1).max(MAX_PRICE_MINOR);
const stock = z.number().int().min(0).max(MAX_STOCK);
const measurement = z.number().positive().finite();
const imageList = z
  .array(imageIdSchema)
  .max(10)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "An image can only appear once in each image list.",
  });

export const variationInputSchema = z.strictObject({
  variationId: z.string().regex(VARIATION_ID).nullish(),
  label: text(1, 80),
  priceMinor,
  stock,
  imageIds: imageList.default([]),
});
export type VariationInput = z.infer<typeof variationInputSchema>;

const offerContent = {
  name: text(2, 80),
  description: z.string().trim().max(1000),
  category: z.enum(CATEGORIES),
  attributes: z
    .record(z.string().min(1).max(40), z.string().max(200))
    .refine((value) => Object.keys(value).length <= 10, {
      message: "At most 10 attributes.",
    }),
  imageIds: imageList.min(1, "Add at least one image."),
};
const measurements = {
  lengthCm: measurement.nullish(),
  widthCm: measurement.nullish(),
  heightCm: measurement.nullish(),
  weightGrams: measurement.nullish(),
};
export const MEASUREMENT_FIELDS = [
  "lengthCm",
  "widthCm",
  "heightCm",
  "weightGrams",
] as const;

export const createOfferSchema = z
  .strictObject({
    ...offerContent,
    attributes: offerContent.attributes.default({}),
    priceMinor: priceMinor.nullish(),
    stock: stock.nullish(),
    variations: z.array(variationInputSchema).max(100).default([]),
    ...measurements,
  })
  .superRefine((value, ctx) => {
    if (value.variations.some((v) => v.variationId))
      ctx.addIssue({
        code: "custom",
        path: ["variations"],
        message: "New variations have no ID.",
      });
    if (value.variations.length > 0) {
      if (value.stock != null)
        ctx.addIssue({
          code: "custom",
          path: ["stock"],
          message: "Stock is calculated from the variations.",
        });
      return;
    }
    if (value.priceMinor == null)
      ctx.addIssue({
        code: "custom",
        path: ["priceMinor"],
        message: "Enter a price for a product without variations.",
      });
    if (value.stock == null)
      ctx.addIssue({
        code: "custom",
        path: ["stock"],
        message: "Enter stock for a product without variations.",
      });
  });
export type CreateOfferInput = z.infer<typeof createOfferSchema>;

export const updateOfferSchema = z
  .strictObject({
    name: offerContent.name.optional(),
    description: offerContent.description.optional(),
    category: offerContent.category.optional(),
    attributes: offerContent.attributes.optional(),
    imageIds: offerContent.imageIds.optional(),
    priceMinor: priceMinor.optional(),
    stock: stock.optional(),
    variations: z.array(variationInputSchema).max(100).optional(),
    ...measurements,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to change.",
  })
  .refine((value) => !(value.variations?.length && value.stock !== undefined), {
    path: ["stock"],
    message: "Stock is calculated from the variations.",
  });
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

export const recordSaleSchema = z.strictObject({
  orderId: z.string().regex(ORDER_ID, "Invalid order ID."),
  offerId: offerIdSchema,
  quantity: z.number().int().min(1).max(100),
});
export type RecordSaleInput = z.infer<typeof recordSaleSchema>;

export const sellerStatusSchema = z.enum([
  "pending",
  "active",
  "suspended",
  "terminated",
]);
export const offerStatusSchema = z.enum([
  "draft",
  "pending",
  "active",
  "rejected",
  "blocked",
  "removed",
]);
export const invoiceStatusSchema = z.enum(["pending", "invoiced", "refused"]);

export const listSellersQuerySchema = z.strictObject({
  status: sellerStatusSchema.optional(),
});
export const listOffersQuerySchema = z
  .strictObject({
    sellerId: sellerIdSchema.optional(),
    status: offerStatusSchema.optional(),
  })
  .refine((q) => q.sellerId !== undefined || q.status !== undefined, {
    message: "Give sellerId, status or both.",
  });
export const listSalesQuerySchema = z
  .strictObject({
    orderId: z.string().regex(ORDER_ID).optional(),
    sellerId: sellerIdSchema.optional(),
    invoiceStatus: invoiceStatusSchema.optional(),
  })
  .refine((q) => Object.values(q).some((v) => v !== undefined), {
    message: "Give orderId, sellerId, invoiceStatus or a combination.",
  });
export const catalogQuerySchema = z.strictObject({
  updatedSince: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z.string().max(200).optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
