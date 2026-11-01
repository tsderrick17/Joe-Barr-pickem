import type { Metadata } from "next";
import localFont from "next/font/local";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import { AddToHomeScreen } from "@/components/add-to-home-screen";
import AppBadge from "@/components/app-badge";
import TurnOnNotifications from "@/components/turn-on-notifications";
import PoolChatDock from "@/components/pool-chat-dock";
import PullToRefresh from "@/components/pull-to-refresh";
import { navTabsScript } from "@/lib/nav-tabs";
import { earlyReadScript, sessionStorageKey } from "@/lib/early-read.js";
import FootballWarmup from "@/components/football-warmup";

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
  // Added to an iPhone's home screen it opens full-screen; a solid black status bar keeps the page clear of the notch.
  appleWebApp: { capable: true, title: "Lead Pipe Locks", statusBarStyle: "black" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Decides the optional header tabs before the first paint, so they never slide in later (see nav-tabs.ts). */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: navTabsScript() }} />
        {/* Starts the Standings' or the Slate's first data read before the page's code has arrived (see early-read.js). */}
        <script dangerouslySetInnerHTML={{ __html: earlyReadScript(sessionStorageKey(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "")) }} />
      </head>
      <body className={`${architectsDaughter.variable} ${graduate.variable} ${cormorant.variable}`}>
        <FootballWarmup />
        <PullToRefresh />
        <SiteNav />
        <AddToHomeScreen variant="banner" />
        <TurnOnNotifications />
        <AppBadge />
        {children}
        <PoolChatDock />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
