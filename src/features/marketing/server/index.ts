import "server-only";

// Marketing's public server API. Other modules import only from here.
export {
  activePromotionsHandler,
  createPromotionHandler,
  deactivatePromotionHandler,
  getPromotionHandler,
  listPromotionsHandler,
  orderDiscountsHandler,
  receiveEventHandler,
  resetHandler,
  updatePromotionHandler,
  validateDiscountHandler,
} from "./actions/api-handlers";
export { getOrderDiscounts } from "./services/order-discount-service";
export { listPublicActivePromotions } from "./services/promotion-service";
export { validateDiscount } from "./services/validate-service";
export { PromotionsScreen } from "../components/promotions-screen";
export { marketingMcpHandler } from "./mcp/handler";
