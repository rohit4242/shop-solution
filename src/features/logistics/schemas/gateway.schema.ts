import { z } from "zod";
import { statuses } from "../types/shipment";
export const createSchema = z
  .object({
    orderId: z.string().regex(/^(O|M|ORD)-[0-9]+$/),
    customerId: z.string().min(1),
    paymentStatus: z.literal("PAID"),
    shippingAddress: z
      .object({
        recipientName: z.string().min(1),
        street: z.string().min(1),
        postalCode: z.string().min(1),
        city: z.string().min(1),
        country: z.string().regex(/^[A-Z]{2}$/),
      })
      .strict(),
    shippingMethod: z.enum(["STANDARD", "EXPRESS"]),
  })
  .strict();
export const updateSchema = z
  .object({
    status: z.enum(statuses),
    occurredAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
      .refine(
        (s) => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString() === s,
      ),
  })
  .strict();
export const filterSchema = z
  .object({
    orderId: z
      .string()
      .regex(/^(O|M|ORD)-[0-9]+$/)
      .optional(),
    customerId: z.string().min(1).optional(),
    status: z.enum(statuses).optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  })
  .strict();
