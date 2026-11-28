import { z } from "zod";
import { money } from "../utils/money";

// Mirrors PromotionCreate / PromotionUpdate in src/features/marketing/api/openapi.yaml (MAR-21).

// Messages are shown next to the form field (DESIGN.md: plain words that say how to fix it).
const moneySchema = z
  .number({ error: "Enter the discount as a number, for example 10." })
  .min(0, "Enter 0 or more.")
  .max(99999999.99, "Enter a smaller amount.")
  .refine(
    (value) => money(value).decimalPlaces() <= 2,
    "Use at most 2 decimal places, for example 5.99.",
  );

/** Trimmed, non-empty IDs, at most 100, duplicates removed (first occurrence kept). */
export const scopeIdsSchema = z
  .array(z.string().trim().min(1))
  .max(100)
  .transform((ids) => [...new Set(ids)]);

const fields = z
  .object({
    name: z
      .string({ error: "Enter a name." })
      .trim()
      .min(1, "Enter a name.")
      .max(100, "Use at most 100 characters."),
    description: z
      .string({ error: "Enter a description customers will see." })
      .trim()
      .min(1, "Enter a description customers will see.")
      .max(500, "Use at most 500 characters."),
    // TODO(MKT-21/MAR-25): free_shipping promotions need shipping in the cart; rejected until then.
    type: z.enum(["percent", "fixed"], {
      error: "Must be percent or fixed (free_shipping is not supported yet).",
    }),
    value: moneySchema,
    validFrom: z.iso.datetime({
      offset: true,
      error: "Enter a date and time with a time zone.",
    }),
    validTo: z.iso
      .datetime({
        offset: true,
        error: "Enter a date and time with a time zone.",
      })
      .optional(),
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
            ? "Enter a percentage above 0 and at most 100."
            : "Enter an amount above 0.",
      });
    }
    if (input.validTo && new Date(input.validTo) <= new Date(input.validFrom)) {
      ctx.addIssue({
        code: "custom",
        path: ["validTo"],
        message: "The end must be after the start.",
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
