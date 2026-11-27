import { z } from "zod";

// CloudEvents 1.0 envelope with the order.placed payload (docs/marketing/marketing.yaml, POST /events).
// Unknown item fields are stripped, so a new Storefront field never breaks the event.
const orderItemSchema = z.object({
  productId: z.string().min(1),
  offerId: z.string().min(1).optional(),
  sellerId: z.string().min(1).optional(),
  // Kept, so a category-scoped code or promotion records what validate showed.
  categoryId: z.string().min(1).optional(),
  unitPrice: z.number().finite().nonnegative(),
  quantity: z.number().int().positive(),
});

const orderPlacedDataSchema = z.object({
  orderId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  items: z.array(orderItemSchema).min(1),
  total: z.number().finite().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  discountCode: z.string().min(1).optional(),
  attributionToken: z.string().min(1).optional(),
});

export const orderEventSchema = z.object({
  specversion: z.literal("1.0"),
  // Only order.placed in shop-solution so far; order.cancelled follows in a later PR.
  type: z.literal("order.placed"),
  source: z.literal("/storefront"),
  id: z.string().min(1),
  time: z.iso.datetime({ offset: true }).optional(),
  data: orderPlacedDataSchema,
});

export type OrderEvent = z.infer<typeof orderEventSchema>;
export type OrderPlacedData = OrderEvent["data"];
