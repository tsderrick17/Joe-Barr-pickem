"use client";

import { usePathname } from "next/navigation";
import PoolChat from "@/components/pool-chat";

// The chat is shared across player-facing pool pages. Login, rehearsal, and
// commissioner controls stay focused on their respective jobs.
export default function PoolChatDock() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/preview") || pathname.startsWith("/admin")) return null;
  return <div className="pool-chat-dock"><PoolChat /></div>;
}
