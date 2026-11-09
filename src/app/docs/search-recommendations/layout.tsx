import { DocsLayout } from "@/features/search-recommendations/server";
export const metadata = {
  title: {
    default: "Search & Recommendations Docs",
    template: "%s | Search & Recommendations Docs",
  },
  description:
    "Developer reference for our mock-backed search and recommendation APIs.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return <DocsLayout>{children}</DocsLayout>;
}
