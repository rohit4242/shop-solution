import { marketingMcpHandler } from "@/features/marketing/server";
export const runtime = "nodejs";
export const maxDuration = 30;
export {
  marketingMcpHandler as GET,
  marketingMcpHandler as POST,
  marketingMcpHandler as DELETE,
};
