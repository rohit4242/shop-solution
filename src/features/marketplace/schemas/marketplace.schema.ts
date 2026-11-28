import { z } from "zod";

// Runtime validation of every Marketplace input. Mirrors api/openapi.yaml.

// Canonical shop IDs are Prisma cuid() strings. Accept any short opaque ID so
// rows created by other writers (seeds, Admin & Identity) are addressable too.
export const ENTITY_ID = /^[A-Za-z0-9_-]{1,64}$/;
// Orders are created by the (unassigned) checkout owner; same opaque format.
export const ORDER_ID = ENTITY_ID;
export const CATEGORY_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
// OfferImage.storageKey issued by uploadListingImage: seller ID + 128 random bits.
export const IMAGE_KEY = /^mkt_[A-Za-z0-9_-]{1,64}_[a-f0-9]{32}$/;

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PRICE_MINOR = 10_000_000;
export const MAX_STOCK = 100_000;
export const MAX_IMAGES = 10;
export const MAX_VARIATIONS = 100;
/** Only EUR until Accounting agrees VAT and rounding for other currencies. */
export const CURRENCY = "EUR";

const id = (label: string) =>
  z.string().regex(ENTITY_ID, `Invalid ${label} ID.`);
export const sellerIdSchema = id("seller");
export const offerIdSchema = id("offer");
export const productIdSchema = id("product");
export const offerItemIdSchema = id("offer item");
export const imageKeySchema = z.string().regex(IMAGE_KEY, "Invalid image key.");

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
  .array(imageKeySchema)
  .max(MAX_IMAGES)
  .refine((keys) => new Set(keys).size === keys.length, {
    message: "An image can only appear once.",
  });

export const variationInputSchema = z.strictObject({
  /** Keep an existing item: its `offerItemId`. Omit for a new variation. */
  offerItemId: offerItemIdSchema.nullish(),
  label: text(1, 80),
  priceMinor,
  stock,
  imageKeys: imageList.default([]),
});
export type VariationInput = z.infer<typeof variationInputSchema>;

const offerContent = {
  name: text(2, 80),
  description: z.string().trim().max(1000),
  categorySlug: z
    .string()
    .regex(CATEGORY_SLUG, "Choose a category from the shared catalog."),
  attributes: z
    .record(z.string().min(1).max(40), z.string().max(200))
    .refine((value) => Object.keys(value).length <= 10, {
      message: "At most 10 attributes.",
    }),
  imageKeys: imageList.min(1, "Add at least one image."),
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
    variations: z.array(variationInputSchema).max(MAX_VARIATIONS).default([]),
    ...measurements,
  })
  .superRefine((value, ctx) => {
    if (value.variations.some((v) => v.offerItemId))
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
      if (value.priceMinor != null)
        ctx.addIssue({
          code: "custom",
          path: ["priceMinor"],
          message: "Each variation has its own price.",
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
    categorySlug: offerContent.categorySlug.optional(),
    attributes: offerContent.attributes.optional(),
    imageKeys: offerContent.imageKeys.optional(),
    priceMinor: priceMinor.optional(),
    stock: stock.optional(),
    variations: z.array(variationInputSchema).max(MAX_VARIATIONS).optional(),
    ...measurements,
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Send at least one field to change.",
  })
  .refine((value) => !(value.variations?.length && value.stock !== undefined), {
    path: ["stock"],
    message: "Stock is calculated from the variations.",
  })
  .refine(
    (value) => !(value.variations?.length && value.priceMinor !== undefined),
    { path: ["priceMinor"], message: "Each variation has its own price." },
  );
export type UpdateOfferInput = z.infer<typeof updateOfferSchema>;

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
export const catalogQuerySchema = z.strictObject({
  updatedSince: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z.string().max(200).optional(),
});
export type CatalogQuery = z.infer<typeof catalogQuerySchema>;
