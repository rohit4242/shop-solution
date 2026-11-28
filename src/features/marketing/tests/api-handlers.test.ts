import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  createPromotionHandler,
  deactivatePromotionHandler,
  getPromotionHandler,
  listPromotionsHandler,
  orderDiscountsHandler,
  receiveEventHandler,
  resetHandler,
  validateDiscountHandler,
} from "../server";
import { checkMarketingManager } from "../server/session";
import { promotionRow } from "./fixtures";

// HTTP behaviour of the operations in docs/marketing/marketing.yaml: auth, validation, errors.

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock("../server/session", () => ({ checkMarketingManager: vi.fn() }));
vi.mock("@/server/db", () => ({
  db: {
    promotion: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    product: { findMany: vi.fn() },
    category: { findMany: vi.fn() },
    discountCode: {
      findUnique: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    orderDiscount: { count: vi.fn() },
    order: { findUnique: vi.fn() },
    eventReceipt: { createMany: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const ID = "promo-m1";
const at = new Date("2026-12-01T00:00:00.000Z");
const record = promotionRow({
  id: ID,
  name: "M1 10 %",
  description: "10 % off M1",
  value: "10",
  productIds: ["M1"],
  validFrom: at,
});
const body = {
  name: "M1 10 %",
  description: "10 % off M1",
  type: "percent",
  value: 10,
  productIds: ["M1"],
  validFrom: at.toISOString(),
};

const req = (
  method: string,
  path: string,
  payload?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(`http://localhost/api/v1/marketing${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body:
      payload === undefined
        ? undefined
        : typeof payload === "string"
          ? payload
          : JSON.stringify(payload),
  });
const ctx = (id = ID) => ({ params: Promise.resolve({ id }) });
const json = async (response: Response) => ({
  status: response.status,
  body: await response.json(),
});

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(checkMarketingManager).mockResolvedValue({ ok: true });
  vi.mocked(db.product.findMany).mockResolvedValue([{ id: "M1" }] as never);
});

describe("back-office promotions", () => {
  it("creates a promotion (201) for a marketing manager", async () => {
    vi.mocked(db.promotion.create).mockResolvedValue(record);
    const { status, body: res } = await json(
      await createPromotionHandler(req("POST", "/promotions", body)),
    );
    expect(status).toBe(201);
    expect(res.data).toMatchObject({
      promotionId: ID,
      value: 10,
      productIds: ["M1"],
      active: true,
    });
    // Stored in the shared format: basis points, an automatic promotion, M1 as a promotion_product row.
    expect(vi.mocked(db.promotion.create).mock.calls[0][0].data).toMatchObject({
      type: "PERCENT",
      percentBasisPoints: 1000,
      fixedMinor: null,
      automatic: true,
      products: { create: [{ productId: "M1" }] },
    });
  });

  it("stores a fixed promotion in minor units (EUR 5.50 → 550)", async () => {
    vi.mocked(db.promotion.create).mockResolvedValue(
      promotionRow({ type: "fixed", value: "5.5" }),
    );
    await createPromotionHandler(
      req("POST", "/promotions", { ...body, type: "fixed", value: 5.5 }),
    );
    expect(vi.mocked(db.promotion.create).mock.calls[0][0].data).toMatchObject({
      type: "FIXED",
      fixedMinor: 550,
      percentBasisPoints: null,
      currency: "EUR",
    });
  });

  it("rejects a product id that is not in the catalog with 400 and writes nothing", async () => {
    vi.mocked(db.product.findMany).mockResolvedValue([]);
    const { status, body: res } = await json(
      await createPromotionHandler(req("POST", "/promotions", body)),
    );
    expect(status).toBe(400);
    expect(res.error.fieldErrors.productIds[0]).toContain("M1");
    expect(db.promotion.create).not.toHaveBeenCalled();
  });

  it.each([
    [401, "unauthorized"],
    [403, "forbidden"],
    [503, "identity_unavailable"],
  ] as const)(
    "answers %i %s and writes nothing when the login check fails",
    async (code, errorCode) => {
      vi.mocked(checkMarketingManager).mockResolvedValue({
        ok: false,
        status: code,
      });
      const { status, body: res } = await json(
        await createPromotionHandler(req("POST", "/promotions", body)),
      );
      expect(status).toBe(code);
      expect(res.error.code).toBe(errorCode);
      expect(db.promotion.create).not.toHaveBeenCalled();
    },
  );

  it("rejects a missing field with 400 and the field name", async () => {
    const { status, body: res } = await json(
      await createPromotionHandler(
        req("POST", "/promotions", { ...body, name: undefined }),
      ),
    );
    expect(status).toBe(400);
    expect(res.error.fieldErrors).toHaveProperty("name");
  });

  it("rejects malformed JSON with 400", async () => {
    const { status, body: res } = await json(
      await createPromotionHandler(req("POST", "/promotions", "{not json")),
    );
    expect(status).toBe(400);
    expect(res.error.code).toBe("invalid_input");
  });

  it("answers 404 promotion_not_found for an unknown id", async () => {
    vi.mocked(db.promotion.findFirst).mockResolvedValue(null);
    const { status, body: res } = await json(
      await getPromotionHandler(req("GET", `/promotions/${ID}`), ctx()),
    );
    expect(status).toBe(404);
    expect(res.error.code).toBe("promotion_not_found");
  });

  it("answers 400 invalid_id for an empty id", async () => {
    const { status, body: res } = await json(
      await deactivatePromotionHandler(
        req("POST", "/promotions/%20/deactivate"),
        ctx(" "),
      ),
    );
    expect(status).toBe(400);
    expect(res.error.code).toBe("invalid_id");
  });

  it("deactivates a promotion", async () => {
    vi.mocked(db.promotion.findFirst).mockResolvedValue(record);
    vi.mocked(db.promotion.update).mockResolvedValue({
      ...record,
      active: false,
    });
    const { status, body: res } = await json(
      await deactivatePromotionHandler(
        req("POST", `/promotions/${ID}/deactivate`),
        ctx(),
      ),
    );
    expect(status).toBe(200);
    expect(res.data.active).toBe(false);
  });

  it("lists promotions filtered by active", async () => {
    vi.mocked(db.promotion.findMany).mockResolvedValue([record]);
    const { status } = await json(
      await listPromotionsHandler(req("GET", "/promotions?active=true")),
    );
    expect(status).toBe(200);
    // Only automatic promotions; promotions behind discount codes are not listed here.
    expect(db.promotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { automatic: true, active: true } }),
    );
  });
});

describe("public operations", () => {
  it("validate rejects an empty cart with 400", async () => {
    const { status } = await json(
      await validateDiscountHandler(
        req("POST", "/discounts/validate", { currency: "EUR", items: [] }),
      ),
    );
    expect(status).toBe(400);
    expect(checkMarketingManager).not.toHaveBeenCalled();
  });

  it("order discounts answers 404 when the order got no discount", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null);
    const response = await orderDiscountsHandler(
      req("GET", "/orders/o-1/discounts"),
      { params: Promise.resolve({ orderId: "o-1" }) },
    );
    expect((await json(response)).body.error.code).toBe(
      "order_discount_not_found",
    );
  });

  it("events accepts order.placed (202) and acknowledges a resend without error", async () => {
    const event = {
      specversion: "1.0",
      type: "order.placed",
      source: "/storefront",
      id: "e-1",
      data: {
        orderId: "o-1",
        items: [{ productId: "M1", unitPrice: 59.9, quantity: 1 }],
        total: 53.91,
        currency: "EUR",
      },
    };
    vi.mocked(db.eventReceipt.createMany)
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    for (let delivery = 0; delivery < 2; delivery += 1) {
      const response = await receiveEventHandler(req("POST", "/events", event));
      expect(response.status).toBe(202);
      expect((await response.json()).data).toEqual({ id: "e-1" });
    }
    expect(vi.mocked(db.eventReceipt.createMany).mock.calls[0][0]).toEqual({
      data: [{ consumer: "marketing", source: "/storefront", eventId: "e-1" }],
      skipDuplicates: true,
    });
  });

  it("events rejects order.cancelled (not handled in shop-solution yet) with 400", async () => {
    const event = {
      specversion: "1.0",
      type: "order.cancelled",
      source: "/storefront",
      id: "e-1",
      data: { orderId: "o-1" },
    };
    expect(
      (await receiveEventHandler(req("POST", "/events", event))).status,
    ).toBe(400);
  });
});

describe("POST /reset", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is 404 unless MARKETING_RESET_ENABLED=true", async () => {
    vi.stubEnv("MARKETING_RESET_ENABLED", "");
    expect((await resetHandler(req("POST", "/reset"))).status).toBe(404);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("needs the token when MARKETING_RESET_TOKEN is set", async () => {
    vi.stubEnv("MARKETING_RESET_ENABLED", "true");
    vi.stubEnv("MARKETING_RESET_TOKEN", "secret-token");
    expect(
      (
        await resetHandler(
          req("POST", "/reset", undefined, { authorization: "Bearer wrong" }),
        )
      ).status,
    ).toBe(401);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("removes Marketing's data, keeps what orders use (deactivated), and reports the counts", async () => {
    vi.stubEnv("MARKETING_RESET_ENABLED", "true");
    vi.stubEnv("MARKETING_RESET_TOKEN", "secret-token");
    vi.mocked(db.$transaction).mockResolvedValue([
      { count: 1 },
      { count: 0 },
      { count: 2 },
      { count: 0 },
      { count: 1 },
    ] as never);
    const { status, body: res } = await json(
      await resetHandler(
        req("POST", "/reset", undefined, {
          authorization: "Bearer secret-token",
        }),
      ),
    );
    expect(status).toBe(200);
    expect(res.data).toEqual({
      deleted: { promotions: 2, discountCodes: 0, eventReceipts: 1 },
      deactivated: { promotions: 1, discountCodes: 0 },
    });
    // Only Marketing's own receipts, and only rows no order points at, are deleted.
    expect(db.eventReceipt.deleteMany).toHaveBeenCalledWith({
      where: { consumer: "marketing" },
    });
    expect(db.promotion.deleteMany).toHaveBeenCalledWith({
      where: { applications: { none: {} }, codes: { none: {} } },
    });
    expect(db.discountCode.deleteMany).toHaveBeenCalledWith({
      where: { applications: { none: {} } },
    });
  });
});
