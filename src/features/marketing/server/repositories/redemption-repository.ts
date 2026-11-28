import "server-only";

import type { Prisma } from "@/generated/prisma/client";

// A code's use is an applied, non-reversed order discount with that code (docs/commerce/README.md:
// "derive code use from applied, non-reversed discounts"). Checkout writes those rows; Marketing only
// counts them. Without customerId this counts all customers.
export function countActiveRedemptions(
  client: Prisma.TransactionClient,
  { codeId, customerId }: { codeId: string; customerId?: string },
) {
  return client.orderDiscount.count({
    where: {
      codeId,
      reversedAt: null,
      ...(customerId && { order: { customerId } }),
    },
  });
}
