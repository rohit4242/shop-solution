import "server-only";

import {
  Prisma,
  type MarketingPromotion as Promotion,
} from "@/generated/prisma/client";
import { db } from "@/server/db";
import { money, toJson } from "../../utils/money";
import { findActivePromotionRecords } from "../repositories/promotion-repository";
import {
  promotionCreateSchema,
  type CreatePromotionInput,
  type PromotionFilter,
  type UpdatePromotionInput,
} from "../../schemas/promotion.schema";

// Back-office promotions (MAR-21), same structure as discount-code.service.ts. Promotions are
// deactivated, never deleted, and never create redemptions.

export class PromotionNotFoundError extends Error {
  constructor() {
    super("Promotion not found.");
  }
}

/** Promotion in docs/marketing/marketing.yaml (public, GET /promotions/active). */
export function toPublicPromotionDto(record: Promotion) {
  return {
    promotionId: record.id,
    name: record.name,
    description: record.description,
    type: record.type,
    value: toJson(record.value.toString()),
    productIds: record.productIds ?? [],
    categoryIds: record.categoryIds ?? [],
    validFrom: record.validFrom.toISOString(),
    validTo: record.validTo?.toISOString() ?? null,
  };
}

/** PromotionAdmin: the public shape plus active and timestamps. */
export function toPromotionDto(record: Promotion) {
  return {
    ...toPublicPromotionDto(record),
    active: record.active,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
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

const decimal = (value: number) => new Prisma.Decimal(money(value).toString());

export async function createPromotion(input: CreatePromotionInput) {
  const record = await db.marketingPromotion.create({
    data: {
      name: input.name,
      description: input.description,
      type: input.type,
      value: decimal(input.value),
      validFrom: new Date(input.validFrom),
      validTo:
        input.validTo === undefined ? undefined : new Date(input.validTo),
      productIds: input.productIds ?? [],
      categoryIds: input.categoryIds ?? [],
    },
  });
  return toPromotionDto(record);
}

export async function listPromotions(filter: PromotionFilter) {
  const records = await db.marketingPromotion.findMany({
    where: filter,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  return records.map(toPromotionDto);
}

export async function getPromotion(id: string) {
  const record = await db.marketingPromotion.findUnique({ where: { id } });
  if (!record) throw new PromotionNotFoundError();
  return toPromotionDto(record);
}

export async function updatePromotion(id: string, patch: UpdatePromotionInput) {
  const existing = await getPromotion(id);
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

  const record = await mapPrismaErrors(() =>
    db.marketingPromotion.update({
      where: { id },
      data: {
        ...patch,
        value: patch.value === undefined ? undefined : decimal(patch.value),
        validFrom:
          patch.validFrom === undefined ? undefined : new Date(patch.validFrom),
        validTo:
          patch.validTo === undefined ? undefined : new Date(patch.validTo),
      },
    }),
  );
  return toPromotionDto(record);
}

export async function deactivatePromotion(id: string) {
  const record = await mapPrismaErrors(() =>
    db.marketingPromotion.update({ where: { id }, data: { active: false } }),
  );
  return toPromotionDto(record);
}

/** GET /promotions/active: live now, newest validFrom first. */
export async function listPublicActivePromotions(now: Date) {
  return (await findActivePromotionRecords(now)).map(toPublicPromotionDto);
}
