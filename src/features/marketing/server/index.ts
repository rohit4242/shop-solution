import "server-only";

// Marketing's public server API. Other modules import only from here.
export {
  activePromotionsHandler,
  createPromotionHandler,
  deactivatePromotionHandler,
  getPromotionHandler,
  listPromotionsHandler,
  resetHandler,
  updatePromotionHandler,
  validateDiscountHandler,
} from "./actions/api-handlers";
export { listPublicActivePromotions } from "./services/promotion-service";
export { validateDiscount } from "./services/validate-service";
export { PromotionsScreen } from "../components/promotions-screen";
export { marketingMcpHandler } from "./mcp/handler";
export { DocsLayout } from "../components/docs/docs-layout";
export { DocsContent } from "../components/docs/docs-content";
export { docPages } from "../docs/navigation";
export { openApiYamlResponse } from "./docs";
