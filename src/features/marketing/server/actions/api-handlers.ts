import "server-only";

import { connection } from "next/server";
import { z } from "zod";
import {
  promotionCreateSchema,
  promotionFilterSchema,
  promotionIdSchema,
  promotionUpdateSchema,
} from "../../schemas/promotion.schema";
import { validateRequestSchema } from "../../schemas/validate.schema";
import { fail, invalidInput, ok, readJsonBody } from "../../utils/http";
import { checkMarketingManager } from "../session";
import {
  createPromotion,
  deactivatePromotion,
  getPromotion,
  listPromotions,
  listPublicActivePromotions,
  PromotionNotFoundError,
  updatePromotion,
} from "../services/promotion-service";
import {
  isResetAuthorized,
  isResetEnabled,
  resetMarketingData,
} from "../services/reset-service";
import { validateDiscount } from "../services/validate-service";

// Thin HTTP entry points for src/app/api/v1/marketing/**: authenticate, authorize, validate,
// then call a service. Contract: src/features/marketing/api/openapi.yaml.

type IdContext = { params: Promise<{ id: string }> };

const AUTH_ERRORS = {
  401: () => fail(401, "unauthorized", "Login required."),
  403: () =>
    fail(403, "forbidden", "You need the marketing_manager permission."),
  503: () =>
    fail(
      503,
      "identity_unavailable",
      "Could not check your login. Try again in a moment.",
    ),
};

async function asManager(request: Request, handle: () => Promise<Response>) {
  const access = await checkMarketingManager(request);
  if (!access.ok) return AUTH_ERRORS[access.status]();
  try {
    return await handle();
  } catch (error) {
    if (error instanceof PromotionNotFoundError)
      return fail(404, "promotion_not_found", error.message);
    if (error instanceof z.ZodError) return invalidInput(error);
    throw error;
  }
}

async function promotionId(context: IdContext) {
  const { id } = await context.params;
  return promotionIdSchema.safeParse(id).success ? id : null;
}

const invalidId = () =>
  fail(400, "invalid_id", "The promotion ID is not valid.");

// POST /promotions
export function createPromotionHandler(request: Request) {
  return asManager(request, async () => {
    const input = promotionCreateSchema.safeParse(await readJsonBody(request));
    if (!input.success) return invalidInput(input.error);
    return ok(await createPromotion(input.data), 201);
  });
}

// GET /promotions
export function listPromotionsHandler(request: Request) {
  return asManager(request, async () => {
    const input = promotionFilterSchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    if (!input.success) return invalidInput(input.error);
    return ok(await listPromotions(input.data));
  });
}

// GET /promotions/{id}
export function getPromotionHandler(request: Request, context: IdContext) {
  return asManager(request, async () => {
    const id = await promotionId(context);
    return id ? ok(await getPromotion(id)) : invalidId();
  });
}

// PATCH /promotions/{id}
export function updatePromotionHandler(request: Request, context: IdContext) {
  return asManager(request, async () => {
    const id = await promotionId(context);
    if (!id) return invalidId();
    const input = promotionUpdateSchema.safeParse(await readJsonBody(request));
    if (!input.success) return invalidInput(input.error);
    return ok(await updatePromotion(id, input.data));
  });
}

// POST /promotions/{id}/deactivate (idempotent)
export function deactivatePromotionHandler(
  request: Request,
  context: IdContext,
) {
  return asManager(request, async () => {
    const id = await promotionId(context);
    return id ? ok(await deactivatePromotion(id)) : invalidId();
  });
}

// GET /promotions/active (public: Storefront shows these without a login)
export async function activePromotionsHandler() {
  // "Active now" reads the clock, so this runs per request, never in a prerender.
  await connection();
  return ok(await listPublicActivePromotions(new Date()));
}

// POST /discounts/validate (public: Storefront calls it at checkout)
export async function validateDiscountHandler(request: Request) {
  try {
    const input = validateRequestSchema.safeParse(await readJsonBody(request));
    if (!input.success) return invalidInput(input.error);
    return ok(await validateDiscount(input.data));
  } catch (error) {
    if (error instanceof z.ZodError) return invalidInput(error);
    throw error;
  }
}

// POST /reset (tests and the demo; off unless MARKETING_RESET_ENABLED=true)
export async function resetHandler(request: Request) {
  if (!isResetEnabled()) return fail(404, "not_found", "Not found.");
  if (!isResetAuthorized(request))
    return fail(401, "unauthorized", "A valid reset token is required.");
  return ok(await resetMarketingData());
}
