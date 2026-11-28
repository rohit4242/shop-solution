import "server-only";

import { z } from "zod";
import { Prisma, type Promotion } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { toBasisPoints, toJson, toMinor } from "../../utils/money";
import {
  findActivePromotionRecords,
  promotionInclude,
} from "../repositories/promotion-repository";
import {
  promotionCreateSchema,
  type CreatePromotionInput,
  type PromotionFilter,
  type UpdatePromotionInput,
} from "../../schemas/promotion.schema";
import {
  promotionValue,
  toRuleType,
  type PromotionWithScope,
} from "./discount-rule-mapper";

// Back-office promotions (MAR-21) on the shared shop tables `promotion`, `promotion_product` and
// `promotion_category`. Only automatic promotions (no code needed) are managed here. Promotions are
// deactivated, never deleted. The wire format stays decimal (value 10 = 10 %, 5.50 = EUR 5.50 off);
// the database stores basis points and minor units.

export class PromotionNotFoundError extends Error {
  constructor() {
    super("Promotion not found.");
  }
}

type PromotionRecord = PromotionWithScope & Pick<Promotion, "description">;

/** Promotion in docs/marketing/marketing.yaml (public, GET /promotions/active). */
export function toPublicPromotionDto(record: PromotionRecord) {
  return {
    promotionId: record.id,
    name: record.name,
    description: record.description ?? "",
    type: toRuleType(record.type),
    value: toJson(promotionValue(record)),
    productIds: (record.products ?? []).map((p) => p.productId),
    categoryIds: (record.categories ?? []).map((c) => c.categoryId),
    validFrom: record.startsAt.toISOString(),
    validTo: record.endsAt?.toISOString() ?? null,
  };
}

/** PromotionAdmin: the public shape plus the active flag. */
export function toPromotionDto(record: PromotionRecord) {
  return { ...toPublicPromotionDto(record), active: record.active };
}

async function mapPrismaErrors<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      throw new PromotionNotFoundError();
    }
    throw error;
  }
}

/**
 * Promotion targets are rows of the shared catalog now (foreign keys), so an unknown id is a field
 * error the caller can fix, not a database error.
 */
async function assertScopeExists(
  productIds: string[] | undefined,
  categoryIds: string[] | undefined,
) {
  const issues: z.core.$ZodIssue[] = [];
  if (productIds?.length) {
    const found = new Set(
      (
        await db.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true },
        })
      ).map((p) => p.id),
    );
    const missing = productIds.filter((id) => !found.has(id));
    if (missing.length)
      issues.push({
        code: "custom",
        path: ["productIds"],
        message: `Unknown product id: ${missing.join(", ")}.`,
        input: productIds,
      });
  }
  if (categoryIds?.length) {
    const found = new Set(
      (
        await db.category.findMany({
          where: { id: { in: categoryIds } },
          select: { id: true },
        })
      ).map((c) => c.id),
    );
    const missing = categoryIds.filter((id) => !found.has(id));
    if (missing.length)
      issues.push({
        code: "custom",
        path: ["categoryIds"],
        message: `Unknown category id: ${missing.join(", ")}.`,
        input: categoryIds,
      });
  }
  if (issues.length) throw new z.ZodError(issues);
}

/** The value columns for a type: exactly one of percentBasisPoints / fixedMinor is set. */
function valueColumns(type: "percent" | "fixed", value: number) {
  return type === "percent"
    ? {
        type: "PERCENT" as const,
        percentBasisPoints: toBasisPoints(value),
        fixedMinor: null,
        currency: null,
      }
    : {
        type: "FIXED" as const,
        percentBasisPoints: null,
        fixedMinor: toMinor(value),
        // The API has no currency field yet; fixed promotions are EUR (see promotionDiscount).
        currency: "EUR",
      };
}

const scopeRows = <K extends string>(key: K, ids: string[]) =>
  ids.map((id) => ({ [key]: id }) as Record<K, string>);

export async function createPromotion(input: CreatePromotionInput) {
  await assertScopeExists(input.productIds, input.categoryIds);
  const record = await db.promotion.create({
    data: {
      name: input.name,
      description: input.description,
      ...valueColumns(input.type, input.value),
      automatic: true,
      startsAt: new Date(input.validFrom),
      endsAt: input.validTo === undefined ? null : new Date(input.validTo),
      products: { create: scopeRows("productId", input.productIds ?? []) },
      categories: { create: scopeRows("categoryId", input.categoryIds ?? []) },
    },
    include: promotionInclude,
  });
  return toPromotionDto(record);
}

export async function listPromotions(filter: PromotionFilter) {
  const records = await db.promotion.findMany({
    where: { automatic: true, ...filter },
    include: promotionInclude,
    orderBy: [{ startsAt: "desc" }, { id: "desc" }],
  });
  return records.map(toPromotionDto);
}

async function findPromotion(id: string) {
  const record = await db.promotion.findFirst({
    where: { id, automatic: true },
    include: promotionInclude,
  });
  if (!record) throw new PromotionNotFoundError();
  return record;
}

export async function getPromotion(id: string) {
  return toPromotionDto(await findPromotion(id));
}

export async function updatePromotion(id: string, patch: UpdatePromotionInput) {
  const existing = toPromotionDto(await findPromotion(id));
  // Cross-field rules (value per type, validTo after validFrom) apply to the merged record.
  const merged = promotionCreateSchema.safeParse({
    name: existing.name,
    description: existing.description,
    type: existing.type,
    value: existing.value,
    validFrom: existing.validFrom,
    validTo: existing.validTo ?? undefined,
    productIds: existing.productIds,
    categoryIds: existing.categoryIds,
    ...patch,
  });
  if (!merged.success) throw merged.error;
  const next = merged.data;
  await assertScopeExists(patch.productIds, patch.categoryIds);

  const record = await mapPrismaErrors(() =>
    db.promotion.update({
      where: { id },
      data: {
        name: patch.name,
        description: patch.description,
        // Type and value are written together, so the other value column is always cleared.
        ...(patch.type !== undefined || patch.value !== undefined
          ? valueColumns(next.type, next.value)
          : {}),
        startsAt:
          patch.validFrom === undefined ? undefined : new Date(patch.validFrom),
        endsAt:
          patch.validTo === undefined ? undefined : new Date(patch.validTo),
        // A sent list replaces the scope; an omitted list keeps it.
        products: patch.productIds && {
          deleteMany: {},
          create: scopeRows("productId", patch.productIds),
        },
        categories: patch.categoryIds && {
          deleteMany: {},
          create: scopeRows("categoryId", patch.categoryIds),
        },
      },
      include: promotionInclude,
    }),
  );
  return toPromotionDto(record);
}

export async function deactivatePromotion(id: string) {
  await findPromotion(id);
  const record = await mapPrismaErrors(() =>
    db.promotion.update({
      where: { id },
      data: { active: false },
      include: promotionInclude,
    }),
  );
  return toPromotionDto(record);
}

/** GET /promotions/active: live now, newest start first. */
export async function listPublicActivePromotions(now: Date) {
  return (await findActivePromotionRecords(now)).map(toPublicPromotionDto);
}
