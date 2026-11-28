import { describe, it, expect, vi, beforeEach } from "vitest";
import { validateDiscount } from "../server/services/validate-service";
import * as redemptionRepo from "../server/repositories/redemption-repository";
import type { ValidateRequest } from "../schemas/validate.schema";
import { codeRow } from "./fixtures";

vi.mock("@/server/db", () => ({
  db: {
    discountCode: {
      findUnique: vi.fn(),
    },
    // MAR-21: validate also loads active promotions; none here.
    promotion: { findMany: vi.fn(async () => []) },
  },
}));

vi.mock("../server/repositories/redemption-repository");

import { db } from "@/server/db";

describe("validateDiscount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns valid: true with no discount when code is undefined", async () => {
    const request: ValidateRequest = {
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request);

    expect(result).toEqual({
      valid: true,
      discountTotal: 0,
      currency: "EUR",
      campaignId: null,
      appliedBy: null,
      promotionId: null,
      items: [{ productId: "p-1", discount: 0 }],
    });
  });

  it("queries usage counts for both limits when code has limits", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const codeId = "code-123";

    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: codeId,
        code: "LIMIT5",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: 5,
        maxUsesPerCustomer: 2,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );

    vi.mocked(redemptionRepo.countActiveRedemptions)
      .mockResolvedValueOnce(0) // total count
      .mockResolvedValueOnce(0); // customer count

    const request: ValidateRequest = {
      code: "limit5",
      customerId: "c-1",
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request, now);

    expect(
      vi.mocked(redemptionRepo.countActiveRedemptions),
    ).toHaveBeenCalledTimes(2);
    expect(result.valid).toBe(true);
  });

  it("queries only total count when code has no per-customer limit", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const codeId = "code-123";

    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: codeId,
        code: "TOTAL_ONLY",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: 5,
        maxUsesPerCustomer: null,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );

    vi.mocked(redemptionRepo.countActiveRedemptions).mockResolvedValueOnce(1);

    const request: ValidateRequest = {
      code: "TOTAL_ONLY",
      customerId: "c-1",
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request, now);

    expect(
      vi.mocked(redemptionRepo.countActiveRedemptions),
    ).toHaveBeenCalledTimes(1);
    expect(result.valid).toBe(true);
  });

  it("does not query customer count for guests", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const codeId = "code-123";

    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: codeId,
        code: "GUEST_TEST",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: 5,
        maxUsesPerCustomer: 2,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );

    vi.mocked(redemptionRepo.countActiveRedemptions).mockResolvedValueOnce(0);

    const request: ValidateRequest = {
      code: "GUEST_TEST",
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request, now);

    expect(
      vi.mocked(redemptionRepo.countActiveRedemptions),
    ).toHaveBeenCalledTimes(1);
    expect(
      vi.mocked(redemptionRepo.countActiveRedemptions),
    ).toHaveBeenCalledWith(expect.anything(), { codeId });
    expect(result.valid).toBe(true);
  });

  it("returns usage_limit_reached when total limit is exceeded", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const codeId = "code-123";

    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: codeId,
        code: "LIMITED",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: 2,
        maxUsesPerCustomer: null,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );

    vi.mocked(redemptionRepo.countActiveRedemptions).mockResolvedValueOnce(2);

    const request: ValidateRequest = {
      code: "LIMITED",
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request, now);

    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reasonCode: "usage_limit_reached" });
    expect(result.discountTotal).toBe(0);
  });

  it("returns customer_limit_reached when per-customer limit is exceeded", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    const codeId = "code-123";

    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: codeId,
        code: "PERUSER",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: 100,
        maxUsesPerCustomer: 1,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );

    vi.mocked(redemptionRepo.countActiveRedemptions)
      .mockResolvedValueOnce(0) // total
      .mockResolvedValueOnce(1); // customer

    const request: ValidateRequest = {
      code: "PERUSER",
      customerId: "c-1",
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request, now);

    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reasonCode: "customer_limit_reached" });
    expect(result.discountTotal).toBe(0);
  });

  it("runs no count query when both limits are null", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: "code-123",
        code: "NOLIMIT",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: null,
        maxUsesPerCustomer: null,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );

    const result = await validateDiscount(
      {
        code: "NOLIMIT",
        customerId: "c-1",
        currency: "EUR",
        items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
      },
      now,
    );

    expect(
      vi.mocked(redemptionRepo.countActiveRedemptions),
    ).not.toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });

  it("passes the code and customer to the counts", async () => {
    const now = new Date("2026-11-10T12:00:00.000Z");
    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(
      codeRow({
        id: "code-123",
        code: "LIMIT5",
        type: "percent",
        value: "10",
        currency: "EUR",
        validFrom: now,
        validTo: null,
        maxUses: 5,
        maxUsesPerCustomer: 2,
        minOrderTotal: null,
        active: true,
        campaignId: null,
      }),
    );
    vi.mocked(redemptionRepo.countActiveRedemptions).mockResolvedValue(0);

    await validateDiscount(
      {
        code: "LIMIT5",
        customerId: "c-1",
        currency: "EUR",
        items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
      },
      now,
    );

    expect(
      vi
        .mocked(redemptionRepo.countActiveRedemptions)
        .mock.calls.map(([, params]) => params),
    ).toEqual([
      { codeId: "code-123" },
      { codeId: "code-123", customerId: "c-1" },
    ]);
  });

  it("does not query counts when code not found", async () => {
    vi.mocked(db.discountCode.findUnique).mockResolvedValueOnce(null);

    const request: ValidateRequest = {
      code: "NOTFOUND",
      currency: "EUR",
      items: [{ productId: "p-1", unitPrice: 100, quantity: 1 }],
    };

    const result = await validateDiscount(request);

    expect(
      vi.mocked(redemptionRepo.countActiveRedemptions),
    ).not.toHaveBeenCalled();
    expect(result.valid).toBe(false);
    expect(result).toMatchObject({ reasonCode: "code_not_found" });
  });
});
