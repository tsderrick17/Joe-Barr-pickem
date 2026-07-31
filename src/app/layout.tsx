import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "@/components/site-nav";
import PoolChatDock from "@/components/pool-chat-dock";

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
      <body>
        <SiteNav />
        {children}
        <PoolChatDock />
      </body>
    </html>
  );
}
