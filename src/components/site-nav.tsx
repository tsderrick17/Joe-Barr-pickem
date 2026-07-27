"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [playerName, setPlayerName] = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    async function loadNavigation() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setPlayerName("");
        setIsCommissioner(false);
        return;
      }

      const { data: player } = await supabase
        .from("players")
        .select("first_name, is_commissioner")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      setPlayerName(player?.first_name ?? "");
      setIsCommissioner(player?.is_commissioner ?? false);
    }

    void loadNavigation();
  }, [pathname]);

  if (pathname === "/login") {
    return null;
  }

  function linkStyle(path: string) {
    const isActive =
      path === "/"
        ? pathname === "/"
        : pathname.startsWith(path);

    return isActive
      ? "border-b-2 border-[#f5f0e6] pb-1 font-bold text-[#f5f0e6]"
      : "pb-1 text-[#e4ded2] hover:border-b-2 hover:border-[#e4ded2] hover:text-white";
  }

  async function signOut() {
    setIsSigningOut(true);

    await supabase.auth.signOut();

    setPlayerName("");
    setIsCommissioner(false);
    setIsSigningOut(false);

    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="border-b-2 border-black bg-[#171719] text-[#f5f0e6]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-4 px-5 py-4 md:px-10">
        <Link
          className="font-serif text-lg font-bold leading-none text-[#f5f0e6] md:text-xl"
          href="/"
        >
          Best Bets Pick&apos;em
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-3 text-sm md:gap-x-7 md:text-base">
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

          {playerName ? (
            <div className="flex items-center gap-3 border-l border-zinc-500 pl-4 text-sm">
              <span className="text-[#e4ded2]">
                Signed in as{" "}
                <strong className="text-white">{playerName}</strong>
              </span>

              <button
                type="button"
                disabled={isSigningOut}
                onClick={signOut}
                className="font-bold text-white underline disabled:opacity-50"
              >
                {isSigningOut ? "Signing out..." : "Sign out"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}