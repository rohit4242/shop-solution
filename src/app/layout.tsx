import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Shop Solution",
  description: "Collaborative class shop project",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
