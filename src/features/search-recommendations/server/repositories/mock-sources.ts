import "server-only";
import type {
  MarketplaceOffer,
  OfferSource,
  PurchaseSource,
} from "../../types/discovery";
const names = [
  [
    "Wireless Mouse",
    "Quiet Mouse",
    "Gaming Mouse",
    "USB Keyboard",
    "Desk Speaker",
    "Travel Charger",
  ],
  [
    "Café Cup",
    "Coffee Mug",
    "Tea Cup",
    "Glass Bottle",
    "Dinner Plate",
    "Kitchen Bowl",
  ],
  [
    "Cotton Shirt",
    "Linen Shirt",
    "Wool Scarf",
    "Summer Hat",
    "Walking Socks",
    "Rain Jacket",
  ],
  [
    "Trail Backpack",
    "City Backpack",
    "Hiking Bottle",
    "Camping Light",
    "Yoga Mat",
    "Running Belt",
  ],
];
export function createMockOffers(): MarketplaceOffer[] {
  return names.flatMap((group, categoryIndex) =>
    group.map((name, i) => {
      const n = categoryIndex * 6 + i + 1;
      return {
        offerId: `off_${n}`,
        productId: `prd_${n}`,
        sellerId: `sel_${(n % 3) + 1}`,
        name,
        description: `${name} for everyday use. Lightweight and practical.`,
        category: ["Electronics", "Home", "Clothing", "Outdoors"][
          categoryIndex
        ],
        attributes: {
          color: i % 2 ? "white" : "black",
          material: categoryIndex === 1 ? "ceramic" : "mixed",
        },
        imageUrls: [],
        priceMinor: n === 24 ? 0 : 1999 + (i % 3) * 1000,
        currency: "EUR",
        availability: i === 1 ? "out_of_stock" : "in_stock",
        status:
          n === 6
            ? "pending"
            : n === 12
              ? "rejected"
              : n === 18
                ? "blocked"
                : n === 23
                  ? "removed"
                  : "active",
        updatedAt: "2026-10-26T12:00:00Z",
      };
    }),
  );
}
export const mockOfferSource: OfferSource = {
  async loadOffers() {
    return createMockOffers();
  },
};
export const mockPurchaseSource: PurchaseSource = {
  async loadPurchaseGroups() {
    return [
      { purchaseId: "synthetic_1", productIds: ["prd_1", "prd_2", "prd_4"] },
      { purchaseId: "synthetic_2", productIds: ["prd_1", "prd_2"] },
      { purchaseId: "synthetic_3", productIds: ["prd_7", "prd_8"] },
    ];
  },
};
