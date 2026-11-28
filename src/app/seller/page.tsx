import type { Metadata } from "next";
import { headers } from "next/headers";
import { SellerWorkspace } from "@/features/marketplace";
import { readActor } from "@/features/marketplace/server";

export const metadata: Metadata = { title: "Your shop · Marketplace" };
export const dynamic = "force-dynamic";

export default async function SellerPage() {
  const actor = await readActor(await headers());
  return (
    <main id="main" className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <SellerWorkspace signedIn={actor !== null} />
    </main>
  );
}
