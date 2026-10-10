import type { Metadata } from "next";
import { preload } from "react-dom";
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

// The Bowl Pool's own lettering: varsity block capitals and an old-style serif.
// Bundled with the app (OFL-licensed @fontsource files), so a build or test run
// never depends on reaching Google Fonts.
const graduate = localFont({
  src: "../../node_modules/@fontsource/graduate/files/graduate-latin-400-normal.woff2",
  variable: "--font-graduate",
  display: "swap",
});
const cormorant = localFont({
  src: [
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff2", weight: "700", style: "normal" },
    { path: "../../node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-500-italic.woff2", weight: "500", style: "italic" },
  ],
  variable: "--font-cormorant",
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
  // The loading football's frames start downloading with the page, so the ball is already there when a loading screen shows.
  preload("/football-spin.webp", { as: "image", type: "image/webp", fetchPriority: "low" });
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
