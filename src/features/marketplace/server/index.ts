import "server-only";

// Public server interface of Marketplace. Other features import only from here.
// Contract: ../README.md and ../api/openapi.yaml.

// Public reads (no session) — Storefront, Search & Recommendations, Analytics.
export {
  getOffer,
  getProduct,
  listCatalogOffers,
  listSellerOffers,
} from "./services/offers";
export { getSeller } from "./services/sellers";

// Sales — the order owner calls recordSale when an order is paid.
export {
  recordSale,
  listSales,
  retryAccountingHandoff,
} from "./services/sales";

// Seller and moderation operations take the Actor of the current session.
export {
  approveSeller,
  getMyShop,
  listSellers,
  registerSeller,
  rejectSeller,
  updateSeller,
} from "./services/sellers";
export {
  approveOffer,
  createOffer,
  listOffers,
  rejectOffer,
  updateOffer,
} from "./services/offers";
export { getListingImage, uploadListingImage } from "./services/images";
export { readActor, type Actor, type Permission } from "./access";
export { MarketplaceError } from "./errors";
export { marketplaceRoutes } from "./api-handlers";
