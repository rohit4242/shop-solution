import { z } from "zod";
import { tokens } from "../utils/text";
export const idSchema = z.string().trim().min(1).max(128);
export const availabilitySchema = z.enum(["in_stock", "out_of_stock"]);
export const moneySchema = z
  .number()
  .int()
  .nonnegative()
  .max(Number.MAX_SAFE_INTEGER);
export const offerSchema = z.strictObject({
  offerId: idSchema,
  productId: idSchema,
  sellerId: idSchema,
  name: z.string().trim().min(1),
  description: z.string(),
  category: idSchema,
  attributes: z.record(z.string(), z.string()),
  imageUrls: z.array(z.url({ protocol: /^https?$/ })),
  priceMinor: moneySchema,
  currency: z.literal("EUR"),
  availability: availabilitySchema,
  status: z.enum(["active", "pending", "rejected", "blocked", "removed"]),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const catalogSchema = z
  .array(offerSchema)
  .max(10_000)
  .superRefine((offers, ctx) => {
    for (const key of ["offerId", "productId"] as const) {
      const seen = new Set<string>();
      offers.forEach((offer, index) => {
        if (seen.has(offer[key]))
          ctx.addIssue({
            code: "custom",
            message: `Duplicate ${key}`,
            path: [index, key],
          });
        seen.add(offer[key]);
      });
    }
  });
export const purchaseGroupsSchema = z
  .array(
    z.strictObject({
      purchaseId: idSchema,
      productIds: z.array(idSchema).min(1),
    }),
  )
  .superRefine((groups, ctx) => {
    const seen = new Set<string>();
    groups.forEach((group, i) => {
      if (seen.has(group.purchaseId))
        ctx.addIssue({
          code: "custom",
          message: "Duplicate purchaseId",
          path: [i, "purchaseId"],
        });
      seen.add(group.purchaseId);
    });
  });
export const discoveryItemSchema = offerSchema.pick({
  offerId: true,
  productId: true,
  sellerId: true,
  name: true,
  category: true,
  imageUrls: true,
  priceMinor: true,
  currency: true,
  availability: true,
});
const integerQuery = (min: number, max: number) =>
  z
    .string()
    .regex(/^\d+$/)
    .transform(Number)
    .pipe(z.number().int().min(min).max(max));
const query = z
  .string()
  .trim()
  .max(200)
  .refine((v) => tokens(v).length <= 20, "At most 20 terms are allowed");
const filters = {
  q: query.default(""),
  category: idSchema.optional(),
  sellerId: idSchema.optional(),
  availability: availabilitySchema.optional(),
  minPriceMinor: integerQuery(0, Number.MAX_SAFE_INTEGER).optional(),
  maxPriceMinor: integerQuery(0, Number.MAX_SAFE_INTEGER).optional(),
};
const orderedPrices = (v: { minPriceMinor?: number; maxPriceMinor?: number }) =>
  v.minPriceMinor === undefined ||
  v.maxPriceMinor === undefined ||
  v.minPriceMinor <= v.maxPriceMinor;
export const searchQuerySchema = z
  .strictObject({
    ...filters,
    sort: z
      .enum(["relevance", "price_asc", "price_desc", "name_asc"])
      .default("relevance"),
    page: integerQuery(1, Number.MAX_SAFE_INTEGER).default(1),
    pageSize: integerQuery(1, 100).default(20),
  })
  .refine(orderedPrices, "Minimum price must not exceed maximum price");
export const facetsQuerySchema = z
  .strictObject(filters)
  .refine(orderedPrices, "Minimum price must not exceed maximum price");
export const autocompleteQuerySchema = z.strictObject({
  q: query.refine((v) => v.length >= 2, "At least two characters are required"),
  category: idSchema.optional(),
  availability: availabilitySchema.optional(),
  limit: integerQuery(1, 10).default(5),
});
export const recommendationQuerySchema = z.strictObject({
  productId: idSchema,
  availability: availabilitySchema.optional(),
  limit: integerQuery(1, 20).default(5),
});
export const searchResponseSchema = z.strictObject({
  data: z.strictObject({
    items: z.array(discoveryItemSchema),
    total: z.number().int().nonnegative(),
    page: z.number().int().positive(),
    pageSize: z.number().int().min(1).max(100),
  }),
});
export const facetsResponseSchema = z.strictObject({
  data: z.strictObject({
    categories: z.array(
      z.strictObject({
        category: z.string(),
        count: z.number().int().positive(),
      }),
    ),
    sellers: z.array(
      z.strictObject({
        sellerId: z.string(),
        count: z.number().int().positive(),
      }),
    ),
    availability: z.array(
      z.strictObject({
        availability: availabilitySchema,
        count: z.number().int().positive(),
      }),
    ),
    priceRange: z
      .strictObject({ minPriceMinor: moneySchema, maxPriceMinor: moneySchema })
      .nullable(),
  }),
});
export const autocompleteResponseSchema = z.strictObject({
  data: z.strictObject({
    suggestions: z.array(
      z.strictObject({ productId: idSchema, name: z.string() }),
    ),
  }),
});
export const recommendationsResponseSchema = z.strictObject({
  data: z.strictObject({ items: z.array(discoveryItemSchema) }),
});
export const errorResponseSchema = z.strictObject({
  error: z.strictObject({ code: z.string(), message: z.string() }),
});
