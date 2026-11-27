import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma, type MarketingPromotion } from "@/generated/prisma/client";
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

// HTTP behaviour of the operations in docs/marketing/marketing.yaml: auth, validation, errors.

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  connection: vi.fn(async () => undefined),
}));
vi.mock("../server/session", () => ({ checkMarketingManager: vi.fn() }));
vi.mock("@/server/db", () => ({
  db: {
    marketingPromotion: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    marketingDiscountCode: { findUnique: vi.fn(), deleteMany: vi.fn() },
    marketingRedemption: { count: vi.fn(), deleteMany: vi.fn() },
    marketingOrderDiscount: { findUnique: vi.fn(), deleteMany: vi.fn() },
    marketingReceivedEvent: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

const ID = "7d7f5a3e-1c1b-4c55-9a51-2f4f6f0d9a10";
const at = new Date("2026-12-01T00:00:00.000Z");
const record: MarketingPromotion = {
  id: ID,
  name: "M1 10 %",
  description: "10 % off M1",
  type: "percent",
  value: new Prisma.Decimal("10"),
  productIds: ["M1"],
  categoryIds: [],
  validFrom: at,
  validTo: null,
  active: true,
  createdAt: at,
  updatedAt: at,
};
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
});

describe("back-office promotions", () => {
  it("creates a promotion (201) for a marketing manager", async () => {
    vi.mocked(db.marketingPromotion.create).mockResolvedValue(record);
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
      expect(db.marketingPromotion.create).not.toHaveBeenCalled();
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
    vi.mocked(db.marketingPromotion.findUnique).mockResolvedValue(null);
    const { status, body: res } = await json(
      await getPromotionHandler(req("GET", `/promotions/${ID}`), ctx()),
    );
    expect(status).toBe(404);
    expect(res.error.code).toBe("promotion_not_found");
  });

  it("answers 400 invalid_id for an id that is not a UUID", async () => {
    const { status, body: res } = await json(
      await deactivatePromotionHandler(
        req("POST", "/promotions/x/deactivate"),
        ctx("x"),
      ),
    );
    expect(status).toBe(400);
    expect(res.error.code).toBe("invalid_id");
  });

  it("deactivates a promotion", async () => {
    vi.mocked(db.marketingPromotion.update).mockResolvedValue({
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
    vi.mocked(db.marketingPromotion.findMany).mockResolvedValue([record]);
    const { status } = await json(
      await listPromotionsHandler(req("GET", "/promotions?active=true")),
    );
    expect(status).toBe(200);
    expect(db.marketingPromotion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { active: true } }),
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
    vi.mocked(db.marketingOrderDiscount.findUnique).mockResolvedValue(null);
    const response = await orderDiscountsHandler(
      req("GET", "/orders/o-1/discounts"),
      { params: Promise.resolve({ orderId: "o-1" }) },
    );
    expect((await json(response)).body.error.code).toBe(
      "order_discount_not_found",
    );
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

  it("empties every Marketing table and reports the counts", async () => {
    vi.stubEnv("MARKETING_RESET_ENABLED", "true");
    vi.stubEnv("MARKETING_RESET_TOKEN", "secret-token");
    vi.mocked(db.$transaction).mockResolvedValue([
      { count: 1 },
      { count: 0 },
      { count: 0 },
      { count: 2 },
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
    expect(res.data.deleted).toEqual({
      orderDiscounts: 1,
      redemptions: 0,
      discountCodes: 0,
      promotions: 2,
      receivedEvents: 1,
    });
  });
});
