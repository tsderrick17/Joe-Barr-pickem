"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import PoolChat from "@/components/pool-chat";
import { fetchWithSession } from "@/lib/auth-session";

// The chat is shared across player-facing pool pages. Login, rehearsal, and
// commissioner controls stay focused on their respective jobs.
export default function PoolChatDock() {
  const pathname = usePathname();
  const [showChat, setShowChat] = useState<boolean | null>(null);

  useEffect(() => {
    let current = true;
    void (async () => {
      try {
        const response = await fetchWithSession("/api/profile");
        const data = await response.json() as { showPoolChat?: boolean };
        if (current && response.ok) setShowChat(data.showPoolChat !== false);
      } catch {
        if (current) setShowChat(true);
      }
    })();
    return () => { current = false; };
  }, []);

  async function restoreChat() {
    const response = await fetchWithSession("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showPoolChat: true }),
    });
    if (response.ok) setShowChat(true);
  }

  if (pathname === "/login" || pathname.startsWith("/preview") || pathname.startsWith("/admin")) return null;
  if (showChat === null) return null;
  if (!showChat) return <div className="pool-chat-dock"><div className="mx-auto flex max-w-5xl justify-end"><button className="pool-display-toggle" onClick={() => void restoreChat()} type="button">Show pool chat</button></div></div>;
  return <div className="pool-chat-dock"><PoolChat /></div>;
}
