import type { Metadata } from "next";
import { headers } from "next/headers";
import { SellerWorkspace } from "@/features/marketplace";
import { readActor } from "@/features/marketplace/server";
import { ProjectHeader } from "@/shared/components/project-header";

export const metadata: Metadata = { title: "Your shop · Marketplace" };
export const dynamic = "force-dynamic";

export default async function SellerPage() {
  const actor = await readActor(await headers());
  return (
    <>
      <ProjectHeader />
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <SellerWorkspace signedIn={actor !== null} />
      </main>
    </>
  );
}
