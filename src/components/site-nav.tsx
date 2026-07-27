"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SiteNav() {
  const pathname = usePathname();
  const [isCommissioner, setIsCommissioner] = useState(false);

  useEffect(() => {
    async function loadNavigation() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) return;

      const { data: player } = await supabase
        .from("players")
        .select("is_commissioner")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      setIsCommissioner(player?.is_commissioner ?? false);
    }

    void loadNavigation();
  }, []);

  if (pathname === "/login") {
    return null;
  }

  function linkStyle(path: string) {
    return pathname === path
      ? "border-b-2 border-[#f5f0e6] pb-1 font-bold text-[#f5f0e6]"
      : "pb-1 text-[#e4ded2] hover:border-b-2 hover:border-[#e4ded2] hover:text-white";
  }

  return (
    <nav className="border-b-2 border-black bg-[#171719] text-[#f5f0e6]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-5 px-5 py-4 md:px-10">
        <Link
          className="font-serif text-lg font-bold leading-none text-[#f5f0e6] md:text-xl"
          href="/"
        >
          Best Bets Pick&apos;em
        </Link>

        <div className="flex items-center gap-4 text-sm md:gap-7 md:text-base">
          <Link className={linkStyle("/")} href="/">
            Pool
          </Link>

          <Link className={linkStyle("/board")} href="/board">
            The Board
          </Link>

          {isCommissioner ? (
            <Link className={linkStyle("/admin")} href="/admin">
              Commissioner
            </Link>
          ) : null}
        </div>
      </div>
    </nav>
  );
}