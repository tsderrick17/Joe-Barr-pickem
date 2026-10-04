import type { Metadata } from "next";
import { Cormorant_Garamond, Graduate } from "next/font/google";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import PoolChatDock from "@/components/pool-chat-dock";

const architectsDaughter = localFont({
  src: "../../public/fonts/architects-daughter.ttf",
  variable: "--font-architects-daughter",
  display: "swap",
});

// The Bowl Pool's own lettering: varsity block capitals and an old-style italic.
const graduate = Graduate({ subsets: ["latin"], weight: "400", variable: "--font-graduate", display: "swap" });
const cormorant = Cormorant_Garamond({ subsets: ["latin"], weight: ["500", "700"], style: ["normal", "italic"], variable: "--font-cormorant", display: "swap" });

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
      <body className={`${architectsDaughter.variable} ${graduate.variable} ${cormorant.variable}`}>
        <SiteNav />
        {children}
        <PoolChatDock />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
