import { mcpHandler } from "@/features/search-recommendations/server";
export const runtime = "nodejs";
export const maxDuration = 30;
export { mcpHandler as GET, mcpHandler as POST, mcpHandler as DELETE };
