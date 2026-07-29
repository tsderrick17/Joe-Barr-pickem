"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getFreshSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

export default function SiteNav() {
  const pathname = usePathname();

  const [playerName, setPlayerName] = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadNavigation() {
      const session = await getFreshSession();

      if (!session) {
        if (active) {
          setPlayerName("");
          setIsCommissioner(false);
        }
        return;
      }

      const { data: player, error } = await supabase
        .from("players")
        .select("first_name, is_commissioner")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (active) {
        setPlayerName(error ? "" : player?.first_name ?? "");
        setIsCommissioner(error ? false : player?.is_commissioner ?? false);
      }
    }

    void loadNavigation();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      window.setTimeout(() => {
        if (active) {
          void loadNavigation();
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
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

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: "local" });
      }
    } finally {
      setPlayerName("");
      setIsCommissioner(false);
      setIsSigningOut(false);
      window.location.assign("/login");
    }
  }

  return (
    <nav className="border-b-2 border-black bg-[#171719] text-[#f5f0e6]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-3 px-4 py-3 sm:px-5 sm:py-4 md:px-10">
        <Link
          className="font-serif leading-none text-[#f5f0e6]"
          href="/"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#e4ded2] md:text-xs">
            Joe Barr Memorial
          </span>
          <span className="mt-1 block text-lg font-bold md:text-xl">
            Pick&apos;em
          </span>
        </Link>

        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm sm:gap-x-4 md:gap-x-7 md:text-base">
          <Link className={linkStyle("/")} href="/">
            Standings
          </Link>

          <Link className={linkStyle("/board")} href="/board">
            The Slate
          </Link>

          <Link className={linkStyle("/survivor")} href="/survivor">
            Survivor Wire
          </Link>

          {isCommissioner ? (
            <Link className={linkStyle("/admin")} href="/admin">
              Commissioner
            </Link>
          ) : null}

          {playerName ? (
            <div className="border-l border-zinc-500 pl-3 text-right text-sm sm:pl-4">
              <div className="flex items-center justify-end gap-3">
                <Link className={linkStyle("/profile")} href="/profile">
                  Preferences
                </Link>

                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={signOut}
                  className="font-bold text-white underline disabled:opacity-50"
                >
                  {isSigningOut ? "Signing out..." : "Sign out"}
                </button>
              </div>
              <span className="mt-1 block text-xs text-[#e4ded2]">
                Signed in as <strong className="text-sm text-white">{playerName}</strong>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  );
}
