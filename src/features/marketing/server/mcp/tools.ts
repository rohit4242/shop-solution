import "server-only";

import { z } from "zod";
import {
  promotionCreateSchema,
  promotionIdSchema,
  promotionUpdateSchema,
} from "../../schemas/promotion.schema";
import { validateRequestSchema } from "../../schemas/validate.schema";
import { getOrderDiscounts } from "../services/order-discount-service";
import {
  createPromotion,
  deactivatePromotion,
  listPromotions,
  listPublicActivePromotions,
  PromotionNotFoundError,
  updatePromotion,
} from "../services/promotion-service";
import { validateDiscount } from "../services/validate-service";

// Marketing's MCP tools for agents (lecture 8 homework). They call the same services as the HTTP API,
// so the same rules apply. Deliberately missing: reset and delete. An agent can deactivate a
// promotion, never wipe data. Money is EUR with 2 decimals (59.90), not cents.

type ToolResult = {
  content: { type: "text"; text: string }[];
  isError?: boolean;
};

const result = (data: unknown): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ data }) }],
});
const failure = (
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ToolResult => ({
  content: [
    {
      type: "text",
      text: JSON.stringify({
        error: { code, message, ...(fieldErrors && { fieldErrors }) },
      }),
    },
  ],
  isError: true,
});

function fieldErrors(error: z.ZodError) {
  const errors: Record<string, string[]> = {};
  for (const issue of error.issues)
    (errors[issue.path.join(".") || "_"] ??= []).push(issue.message);
  return errors;
}

async function guarded(run: () => Promise<ToolResult>): Promise<ToolResult> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof PromotionNotFoundError)
      return failure("promotion_not_found", error.message);
    if (error instanceof z.ZodError)
      return failure(
        "invalid_input",
        "The input is not valid.",
        fieldErrors(error),
      );
    console.error("Marketing MCP tool failed", error);
    return failure(
      "internal_error",
      "The tool failed. Nothing may have been saved; check with list_promotions.",
    );
  }
}

const cartItem = z.object({
  productId: z.string().min(1).describe('Catalog product id, e.g. "M1"'),
  categoryId: z.string().min(1).optional(),
  unitPrice: z.number().min(0).describe("Price of one unit in EUR, e.g. 59.90"),
  quantity: z.number().int().min(1),
});

export const marketingTools = {
  list_active_promotions: {
    description:
      "List promotions that apply at checkout right now (active and inside their period), newest first. Read-only.",
    schema: z.strictObject({}),
    readOnly: true,
    run: () =>
      guarded(async () => result(await listPublicActivePromotions(new Date()))),
  },
  list_promotions: {
    description:
      "List all promotions, including inactive and future ones, with promotionId, active flag and period. Optional filter active=true/false. Read-only.",
    schema: z.strictObject({ active: z.boolean().optional() }),
    readOnly: true,
    run: ({ active }: { active?: boolean }) =>
      guarded(async () =>
        result(await listPromotions(active === undefined ? {} : { active })),
      ),
  },
  create_promotion: {
    description:
      'Create an automatic promotion (no code needed at checkout). type "percent" (value 10 = 10 %) or "fixed" (EUR off). ' +
      "productIds/categoryIds (catalog ids; unknown ids are rejected) restrict it to those items; both empty = whole cart. validFrom/validTo are ISO 8601 date-times " +
      'with time zone, e.g. "2026-12-31T23:59:59+01:00"; validFrom defaults to now. Only the biggest discount applies per cart, ' +
      "promotions never stack. Returns the created promotion.",
    schema: z.strictObject({
      name: z.string().min(1).max(100),
      description: z.string().min(1).max(500),
      type: z.enum(["percent", "fixed"]),
      value: z.number().positive(),
      productIds: z.array(z.string().min(1)).max(100).optional(),
      categoryIds: z.array(z.string().min(1)).max(100).optional(),
      validFrom: z
        .string()
        .optional()
        .describe("ISO 8601 with offset; omit for now"),
      validTo: z
        .string()
        .optional()
        .describe("ISO 8601 with offset; omit for no end"),
    }),
    readOnly: false,
    run: (input: unknown) =>
      guarded(async () =>
        result(await createPromotion(promotionCreateSchema.parse(input))),
      ),
  },
  // Added after the agent runs of 27 Nov: without it, "change the value" meant deactivate + create,
  // and agents dropped the period (the new promotion had no end date). Updating keeps every unsent field.
  update_promotion: {
    description:
      "Change an existing promotion in place by promotionId (from list_promotions). Send only the fields to change, e.g. " +
      "{ promotionId, value: 10 }; every other field (period, products, name) stays as it is. Prefer this over creating a " +
      "new promotion when the user asks to change, raise or extend one. Returns the updated promotion.",
    schema: z.strictObject({
      promotionId: promotionIdSchema,
      name: z.string().min(1).max(100).optional(),
      description: z.string().min(1).max(500).optional(),
      type: z.enum(["percent", "fixed"]).optional(),
      value: z.number().positive().optional(),
      productIds: z.array(z.string().min(1)).max(100).optional(),
      categoryIds: z.array(z.string().min(1)).max(100).optional(),
      validFrom: z.string().optional().describe("ISO 8601 with offset"),
      validTo: z.string().optional().describe("ISO 8601 with offset"),
    }),
    readOnly: false,
    run: ({
      promotionId,
      ...patch
    }: { promotionId: string } & Record<string, unknown>) =>
      guarded(async () =>
        result(
          await updatePromotion(
            promotionId,
            promotionUpdateSchema.parse(patch),
          ),
        ),
      ),
  },
  deactivate_promotion: {
    description:
      "Deactivate a promotion by promotionId (from list_promotions). It stops applying immediately; promotions are never deleted. Idempotent.",
    schema: z.strictObject({ promotionId: promotionIdSchema }),
    readOnly: false,
    run: ({ promotionId }: { promotionId: string }) =>
      guarded(async () => result(await deactivatePromotion(promotionId))),
  },
  check_cart_discount: {
    description:
      "Compute the discount a cart gets at checkout right now, exactly as Storefront would see it: discountTotal, a discount per item and " +
      'appliedBy ("promotion", "code" or null). Read-only; nothing is ordered or recorded.',
    schema: z.strictObject({
      currency: z
        .string()
        .regex(/^[A-Z]{3}$/)
        .default("EUR"),
      items: z.array(cartItem).min(1),
      code: z
        .string()
        .optional()
        .describe("Discount code the customer typed, if any"),
    }),
    readOnly: true,
    run: (input: unknown) =>
      guarded(async () =>
        result(await validateDiscount(validateRequestSchema.parse(input))),
      ),
  },
  get_order_discount: {
    description:
      "The discount checkout stored with a placed order (what Accounting puts on the invoice), per item. Returns order_discount_not_found when the order does not exist or got no discount. Read-only.",
    schema: z.strictObject({ orderId: z.string().min(1) }),
    readOnly: true,
    run: ({ orderId }: { orderId: string }) =>
      guarded(async () => {
        const discounts = await getOrderDiscounts(orderId);
        return discounts
          ? result(discounts)
          : failure(
              "order_discount_not_found",
              "No discount was applied to this order.",
            );
      }),
  },
} as const;

export type MarketingToolName = keyof typeof marketingTools;
