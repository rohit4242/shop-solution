import { marketplaceRoutes } from "@/features/marketplace/server";

export const runtime = "nodejs";
export const { POST } = marketplaceRoutes.rejectSeller;
