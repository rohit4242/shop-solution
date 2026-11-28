import { DocsContent } from "@/features/marketing/server";
export default function Page() {
  return (
    <>
      <p className="mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Developer documentation
      </p>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight sm:text-4xl">
        Marketing
      </h1>
      <DocsContent slug="" />
    </>
  );
}
