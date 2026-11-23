export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { demoMode, logisticsSession } from "@/features/logistics/server";
export default async function DemoStorefront({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  if (!demoMode()) notFound();
  if (!(await logisticsSession())) redirect("/logistics");
  const { orderId } = await searchParams;
  const validId =
    orderId && /^[OM]-[0-9]+$/.test(orderId) ? orderId : "Unknown order";
  return (
    <main className="mx-auto max-w-2xl space-y-6 p-8">
      <p className="rounded-md border bg-muted p-4">
        LOCAL DEMO STUB — not the Storefront team’s implementation.
      </p>
      <h1 className="text-3xl font-semibold">Storefront / Order {validId}</h1>
      <p>
        This page demonstrates the handoff URL and session continuity only. It
        does not fetch or invent order details.
      </p>
      <p>
        Proposal: Storefront creates the order; Accounting forwards paid-order
        shipping data to Logistics. Accounting confirmation is pending.
      </p>
      <Link href="/logistics" className="underline">
        Return to Logistics
      </Link>
    </main>
  );
}
