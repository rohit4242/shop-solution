import { notFound } from "next/navigation";
import {
  DocsContent,
  docPages,
} from "@/features/search-recommendations/server";
export function generateStaticParams() {
  return docPages
    .filter((p) => p.slug && p.slug !== "playground")
    .map(({ slug }) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return { title: docPages.find((p) => p.slug === slug)?.title ?? "Not found" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = docPages.find((p) => p.slug === slug);
  if (!page) notFound();
  return (
    <>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {page.group}
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        {page.title}
      </h1>
      <DocsContent slug={slug} />
    </>
  );
}
