"use client";

import { usePathname } from "next/navigation";
import PoolChat from "@/components/pool-chat";

// The chat is shared across every signed-in pool page. Login and rehearsal are
// deliberately excluded so neither creates an unnecessary session request.
export default function PoolChatDock() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname.startsWith("/preview")) return null;
  return <div className="pool-chat-dock"><PoolChat /></div>;
}
