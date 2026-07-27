import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";

export const metadata: Metadata = {
  title: "Joe Barr Memorial Best Bets Pick'em",
  description: "Honor the tradition. Eliminate the paperwork.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}

