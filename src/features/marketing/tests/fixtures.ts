import type {
  DiscountCode,
  DiscountType,
  Promotion,
} from "@/generated/prisma/client";
import { toBasisPoints, toMinor } from "../utils/money";

// Rows of the shared shop schema (prisma/schema.prisma) for mocked-database tests, built from the
// decimal values the tests think in: { type: "percent", value: "10" } → percentBasisPoints 1000.

export type PromotionRow = Promotion & {
  products: { productId: string }[];
  categories: { categoryId: string }[];
};
export type CodeRow = DiscountCode & { promotion: PromotionRow };

type Friendly = {
  type?: "percent" | "fixed" | "free_shipping";
  value?: string | number;
  currency?: string | null;
  validFrom?: Date;
  validTo?: Date | null;
  productIds?: string[];
  categoryIds?: string[];
};

const TYPES: Record<NonNullable<Friendly["type"]>, DiscountType> = {
  percent: "PERCENT",
  fixed: "FIXED",
  free_shipping: "FREE_SHIPPING",
};

export function promotionRow(
  options: Friendly & Partial<Omit<Promotion, "type" | "currency">> = {},
): PromotionRow {
  const {
    type = "percent",
    value = "10",
    currency,
    validFrom = new Date("2026-11-01T00:00:00.000Z"),
    validTo = null,
    productIds = [],
    categoryIds = [],
    ...columns
  } = options;
  return {
    id: "promo-auto10",
    campaignId: null,
    name: "AUTO10",
    description: "10 % off everything",
    type: TYPES[type],
    percentBasisPoints: type === "percent" ? toBasisPoints(value) : null,
    fixedMinor: type === "fixed" ? toMinor(value) : null,
    currency:
      currency === undefined ? (type === "fixed" ? "EUR" : null) : currency,
    automatic: true,
    active: true,
    startsAt: validFrom,
    endsAt: validTo,
    products: productIds.map((productId) => ({ productId })),
    categories: categoryIds.map((categoryId) => ({ categoryId })),
    ...columns,
  };
}

/** A code with its own promotion (automatic = false), like a row loaded with `include: { promotion }`. */
export function codeRow(
  options: Friendly & {
    id?: string;
    code?: string;
    active?: boolean;
    promotionActive?: boolean;
    maxUses?: number | null;
    maxUsesPerCustomer?: number | null;
    minOrderTotal?: string | number | null;
    campaignId?: string | null;
  } = {},
): CodeRow {
  const {
    id = "code-save",
    code = "SAVE",
    active = true,
    promotionActive = true,
    maxUses = null,
    maxUsesPerCustomer = null,
    minOrderTotal = null,
    campaignId = null,
    type = "percent",
    value = "5",
    currency = type === "percent" ? "EUR" : undefined,
    ...friendly
  } = options;
  const promotion = promotionRow({
    ...friendly,
    type,
    value,
    currency,
    id: `promo-for-${id}`,
    name: code,
    automatic: false,
    active: promotionActive,
    campaignId,
  });
  return {
    id,
    promotionId: promotion.id,
    code,
    maxUses,
    maxUsesPerCustomer,
    minOrderTotalMinor: minOrderTotal === null ? null : toMinor(minOrderTotal),
    active,
    promotion,
  };
}
