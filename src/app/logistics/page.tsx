export const dynamic = "force-dynamic";
import { LogisticsWorkspace } from "@/features/logistics";
import "@/features/logistics/tokens.css";
export default function LogisticsPage() {
  return (
    <LogisticsWorkspace
      storefrontUrl={process.env.NEXT_PUBLIC_LOGISTICS_STOREFRONT_URL ?? ""}
    />
  );
}
