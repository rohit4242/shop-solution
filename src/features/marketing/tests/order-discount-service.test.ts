import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/server/db";
import {
  getOrderDiscounts,
  toOrderDiscountsDto,
  type OrderDiscountRows,
} from "../server/services/order-discount-service";

// Story steps k and o: checkout stores the applied discount with the order in the shared tables
// order_discount / order_discount_allocation (in minor units); Accounting's invoice reads it back through
// GET /orders/{orderId}/discounts in the decimal wire format.

vi.mock("@/server/db", () => ({ db: { order: { findUnique: vi.fn() } } }));

const PROMO_ID = "promo-m1";

const order = (
  overrides: Partial<OrderDiscountRows> = {},
): OrderDiscountRows => ({
  id: "o-1002",
  currency: "EUR",
  lines: [
    { id: "line-1", offerItem: { productId: "M1", offerId: "offer-m1" } },
    { id: "line-2", offerItem: { productId: "M2", offerId: "offer-m2" } },
  ],
  discounts: [
    {
      promotionId: PROMO_ID,
      codeId: null,
      code: null,
      // 10 % of EUR 59.90 = 5.99 = 599 minor units (the integration fixture of the shared plan).
      appliedMinor: 599,
      allocations: [{ orderLineId: "line-1", amountMinor: 599 }],
    },
  ],
  ...overrides,
});

beforeEach(() => vi.resetAllMocks());

describe("GET /orders/{orderId}/discounts shape", () => {
  it("step k: the promotion discount of M1 comes back as 5.99, other lines 0", () => {
    expect(toOrderDiscountsDto(order())).toEqual({
      orderId: "o-1002",
      currency: "EUR",
      appliedBy: "promotion",
      code: null,
      promotionId: PROMO_ID,
      discountTotal: 5.99,
      items: [
        {
          productId: "M1",
          offerId: "offer-m1",
          discount: 5.99,
          fundedBy: "platform",
        },
        {
          productId: "M2",
          offerId: "offer-m2",
          discount: 0,
          fundedBy: "platform",
        },
      ],
    });
  });

  it("a code discount says appliedBy code, the code, and no promotionId", () => {
    const dto = toOrderDiscountsDto(
      order({
        discounts: [
          {
            promotionId: "promo-for-code",
            codeId: "code-1",
            code: { code: "SAVE10" },
            appliedMinor: 1000,
            allocations: [
              { orderLineId: "line-1", amountMinor: 749 },
              { orderLineId: "line-2", amountMinor: 251 },
            ],
          },
        ],
      }),
    );
    expect(dto).toMatchObject({
      appliedBy: "code",
      code: "SAVE10",
      promotionId: null,
      discountTotal: 10,
    });
    expect(dto?.items.map((item) => item.discount)).toEqual([7.49, 2.51]);
  });

  it("step o: an order without a discount (the step-f order) gives null → 404", () => {
    expect(toOrderDiscountsDto(order({ discounts: [] }))).toBeNull();
  });

  it("reads only non-reversed discounts of that order", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(order() as never);
    expect(await getOrderDiscounts("o-1002")).toMatchObject({
      discountTotal: 5.99,
    });
    const query = vi.mocked(db.order.findUnique).mock.calls[0][0];
    expect(query.where).toEqual({ id: "o-1002" });
    expect(query.select?.discounts).toMatchObject({
      where: { reversedAt: null },
    });
  });

  it("returns null for an unknown order", async () => {
    vi.mocked(db.order.findUnique).mockResolvedValue(null);
    expect(await getOrderDiscounts("o-unknown")).toBeNull();
  });
});
