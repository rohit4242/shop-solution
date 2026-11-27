import { z } from "zod";
import { money } from "../utils/money";

// Unknown fields inside an item are stripped, not rejected: Storefront's final items[] is still
// open, and a new field there must not break checkout. Unknown top-level fields are rejected.
const cartItemSchema = z.object({
  productId: z.string().min(1),
  offerId: z.string().optional(),
  sellerId: z.string().optional(),
  // MAR-21: must be listed, or the stripping above would silently drop it and category scopes never match.
  categoryId: z.string().min(1).optional(),
  unitPrice: z
    .number()
    .min(0)
    .refine(
      (value) => money(value).decimalPlaces() <= 2,
      "Must have at most 2 decimal places.",
    ),
  quantity: z.number().int().min(1),
});

export const validateRequestSchema = z
  .object({
    code: z
      .string()
      .trim()
      .transform((code) => code || undefined)
      .optional(),
    customerId: z.string().optional(),
    attributionToken: z.string().optional(),
    currency: z.string().regex(/^[A-Z]{3}$/),
    items: z.array(cartItemSchema).min(1),
  })
  .strict();

export type ValidateRequest = z.output<typeof validateRequestSchema>;
