import { z } from "zod";
import { money } from "../utils/money";

// Mirrors PromotionCreate / PromotionUpdate in docs/marketing/marketing.yaml (MAR-21).

const moneySchema = z
  .number()
  .min(0)
  .max(99999999.99)
  .refine(
    (value) => money(value).decimalPlaces() <= 2,
    "Must have at most 2 decimal places.",
  );

/** Trimmed, non-empty IDs, at most 100, duplicates removed (first occurrence kept). */
export const scopeIdsSchema = z
  .array(z.string().trim().min(1))
  .max(100)
  .transform((ids) => [...new Set(ids)]);

const fields = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(500),
    // TODO(MKT-21/MAR-25): free_shipping promotions need shipping in the cart; rejected until then.
    type: z.enum(["percent", "fixed"], {
      error: "Must be percent or fixed (free_shipping is not supported yet).",
    }),
    value: moneySchema,
    validFrom: z.iso.datetime({ offset: true }),
    validTo: z.iso.datetime({ offset: true }).optional(),
    productIds: scopeIdsSchema.optional(),
    categoryIds: scopeIdsSchema.optional(),
  })
  .strict();

export const promotionCreateSchema = fields
  .extend({
    validFrom: fields.shape.validFrom.default(() => new Date().toISOString()),
  })
  .superRefine((input, ctx) => {
    if (
      money(input.value).lte(0) ||
      (input.type === "percent" && money(input.value).gt(100))
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          input.type === "percent"
            ? "Percent value must be > 0 and <= 100."
            : "Fixed value must be > 0.",
      });
    }
    if (input.validTo && new Date(input.validTo) <= new Date(input.validFrom)) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "Must be after validFrom.",
      });
    }
  });

export const promotionUpdateSchema = fields
  .partial()
  .refine(
    (input) => Object.values(input).some((value) => value !== undefined),
    "At least one field is required.",
  );

export const promotionFilterSchema = z
  .object({
    active: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  })
  .strict();

// Shared-schema ids are cuids; treat them as opaque strings.
export const promotionIdSchema = z.string().trim().min(1).max(64);

export type CreatePromotionInput = z.output<typeof promotionCreateSchema>;
export type UpdatePromotionInput = z.output<typeof promotionUpdateSchema>;
export type PromotionFilter = z.output<typeof promotionFilterSchema>;
