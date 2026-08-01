import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import PoolChatDock from "@/components/pool-chat-dock";
import { SpeedInsights } from "@vercel/speed-insights/next";

const architectsDaughter = localFont({
  src: "../../public/fonts/architects-daughter.ttf",
  variable: "--font-architects-daughter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lead Pipe Locks",
  description: "Joe Barr Memorial Pick'em",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={architectsDaughter.variable}>
        <SiteNav />
        {children}
        <PoolChatDock />
        <SpeedInsights />
      </body>
    </html>
  );
}
