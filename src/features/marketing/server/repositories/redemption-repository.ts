import "server-only";

import type { Prisma } from "@/generated/prisma/client";

// Only active redemptions count toward limits; reversed ones (MKT-23) free the use again.
// Without customerId this counts all customers and guests.
export function countActiveRedemptions(
  client: Prisma.TransactionClient,
  { codeId, customerId }: { codeId: string; customerId?: string },
) {
  return client.marketingRedemption.count({
    where: { codeId, status: "active", ...(customerId && { customerId }) },
  });
}
