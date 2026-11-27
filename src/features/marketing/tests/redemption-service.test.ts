/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Prisma,
  type MarketingDiscountCode as DiscountCode,
} from "@/generated/prisma/client";
import {
  recordRedemptionForOrder,
  type OrderPlacedData,
} from "../server/services/redemption-service";

vi.mock("server-only", () => ({}));

const now = new Date("2026-11-10T12:00:00.000Z");
const code: DiscountCode = {
  id: "code-1",
  code: "WELCOME10",
  type: "percent",
  value: new Prisma.Decimal("10"),
  currency: "EUR",
  validFrom: new Date("2026-11-01T00:00:00.000Z"),
  validTo: null,
  maxUses: null,
  maxUsesPerCustomer: null,
  minOrderTotal: null,
  active: true,
  campaignId: null,
  productIds: [],
  categoryIds: [],
  createdAt: now,
  updatedAt: now,
};
const order: OrderPlacedData = {
  orderId: "o-1",
  customerId: "c-1",
  items: [{ productId: "p-1", unitPrice: 29.95, quantity: 2 }],
  currency: "EUR",
  discountCode: "WELCOME10",
};

function p2002() {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
    code: "P2002",
    clientVersion: "7",
  });
}

describe("recordRedemptionForOrder", () => {
  let tx: any;
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    tx = {
      marketingDiscountCode: { findUnique: vi.fn().mockResolvedValue(code) },
      marketingRedemption: {
        findUnique: vi.fn().mockResolvedValue(null),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: "red-1" }),
      },
    };
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  const record = (data: Partial<OrderPlacedData> = {}) =>
    recordRedemptionForOrder(tx, { ...order, ...data }, now);

  it("creates one active redemption with the discount from calculateDiscount (10 % of 29.95 × 2 = 5.99)", async () => {
    expect(await record()).toEqual({ recorded: true, redemptionId: "red-1" });
    expect(tx.marketingRedemption.create).toHaveBeenCalledOnce();
    expect(tx.marketingRedemption.create.mock.calls[0][0].data).toEqual({
      codeId: "code-1",
      orderId: "o-1",
      customerId: "c-1",
      discountTotal: "5.99",
      status: "active",
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it("finds a lowercase code by its normalized value", async () => {
    await record({ discountCode: "  welcome10 " });
    expect(tx.marketingDiscountCode.findUnique).toHaveBeenCalledWith({
      where: { code: "WELCOME10" },
    });
    expect(tx.marketingRedemption.create).toHaveBeenCalledOnce();
  });

  it.each([[undefined], ["   "]])(
    "does nothing without a code (%j)",
    async (discountCode) => {
      expect(await record({ discountCode })).toEqual({
        recorded: false,
        reason: "no_code",
      });
      expect(tx.marketingDiscountCode.findUnique).not.toHaveBeenCalled();
      expect(tx.marketingRedemption.create).not.toHaveBeenCalled();
    },
  );

  it("warns and records nothing for an unknown code", async () => {
    tx.marketingDiscountCode.findUnique.mockResolvedValue(null);
    expect(await record()).toEqual({
      recorded: false,
      reason: "code_not_found",
    });
    expect(tx.marketingRedemption.create).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ orderId: "o-1", code: "WELCOME10" }),
    );
  });

  it("returns already_recorded without inserting when the order already has a redemption for this code", async () => {
    tx.marketingRedemption.findUnique.mockResolvedValue({ id: "red-0" });
    expect(await record()).toEqual({
      recorded: false,
      reason: "already_recorded",
    });
    expect(tx.marketingRedemption.findUnique).toHaveBeenCalledWith({
      where: { codeId_orderId: { codeId: "code-1", orderId: "o-1" } },
      select: { id: true },
    });
    expect(tx.marketingRedemption.create).not.toHaveBeenCalled();
  });

  it("returns already_recorded on P2002 from a concurrent delivery, without throwing", async () => {
    tx.marketingRedemption.create.mockRejectedValue(p2002());
    expect(await record()).toEqual({
      recorded: false,
      reason: "already_recorded",
    });
  });

  it("propagates unexpected errors so the receiver transaction rolls back", async () => {
    tx.marketingRedemption.create.mockRejectedValue(
      new Error("Database unavailable"),
    );
    await expect(record()).rejects.toThrow("Database unavailable");
  });

  it("stores customerId null for a guest and skips the per-customer count", async () => {
    tx.marketingDiscountCode.findUnique.mockResolvedValue({
      ...code,
      maxUsesPerCustomer: 1,
    });
    await record({ customerId: undefined });
    expect(
      tx.marketingRedemption.create.mock.calls[0][0].data.customerId,
    ).toBeNull();
    expect(tx.marketingRedemption.count).not.toHaveBeenCalled();
  });

  it.each([
    ["inactive", { active: false }, 0, "inactive_at_order_time"],
    [
      "expired",
      { validTo: new Date("2026-11-09T00:00:00.000Z") },
      0,
      "expired_at_order_time",
    ],
    ["over the total limit", { maxUses: 2 }, 2, "over_limit_at_order_time"],
    [
      "over the customer limit",
      { maxUsesPerCustomer: 1 },
      1,
      "customer_over_limit_at_order_time",
    ],
  ])(
    "still records a code that is %s at order time and logs a warning",
    async (_name, overrides, count, warning) => {
      tx.marketingDiscountCode.findUnique.mockResolvedValue({
        ...code,
        ...overrides,
      });
      tx.marketingRedemption.count.mockResolvedValue(count);

      expect(await record()).toEqual({
        recorded: true,
        redemptionId: "red-1",
        warning,
      });
      expect(tx.marketingRedemption.create).toHaveBeenCalledOnce();
      expect(warn).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ orderId: "o-1", warning }),
      );
    },
  );

  it("counts only for limits that are set", async () => {
    await record();
    expect(tx.marketingRedemption.count).not.toHaveBeenCalled();

    tx.marketingDiscountCode.findUnique.mockResolvedValue({
      ...code,
      maxUses: 5,
      maxUsesPerCustomer: 1,
    });
    await record({ orderId: "o-2" });
    expect(
      tx.marketingRedemption.count.mock.calls.map(([args]: any) => args.where),
    ).toEqual([
      { codeId: "code-1", status: "active" },
      { codeId: "code-1", status: "active", customerId: "c-1" },
    ]);
  });
});
