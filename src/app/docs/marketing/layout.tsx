import { DocsLayout } from "@/features/marketing/server";
export const metadata = {
  title: {
    default: "Marketing Docs",
    template: "%s | Marketing Docs",
  },
  description:
    "Developer reference for Marketing's promotions and discount validation.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>;
}
