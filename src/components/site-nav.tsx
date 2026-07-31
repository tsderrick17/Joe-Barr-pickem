"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getFreshSession } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";

export default function SiteNav() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement | null>(null);

  const [playerName, setPlayerName] = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("pickem-theme");
    const nightMode = savedTheme === "night";
    document.documentElement.dataset.theme = nightMode ? "night" : "day";
    const frame = window.requestAnimationFrame(() => {
      setIsNightMode(nightMode);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

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

  // The Slate's small receipt bar sits directly beneath this navigation on
  // phones. Measure the real rendered height so account links or a wrapped
  // brand never cause the two sticky bars to overlap.
  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    const syncHeight = () => {
      document.documentElement.style.setProperty(
        "--site-nav-height",
        `${Math.ceil(nav.getBoundingClientRect().height)}px`,
      );
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(nav);
    window.addEventListener("resize", syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, []);

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

  function toggleTheme() {
    const nextNightMode = !isNightMode;
    document.documentElement.dataset.theme = nextNightMode ? "night" : "day";
    window.localStorage.setItem("pickem-theme", nextNightMode ? "night" : "day");
    setIsNightMode(nextNightMode);
  }

  return (
    <nav className="site-nav border-b-2 border-black bg-[#171719] text-[#f5f0e6]" ref={navRef}>
      <div className="site-nav-shell mx-auto max-w-6xl px-4 py-3 sm:px-5 sm:py-4 md:px-10">
        <Link
          className="site-nav-brand font-serif leading-none text-[#f5f0e6]"
          href="/"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#e4ded2] md:text-xs">
            Joe Barr Memorial
          </span>
          <span className="mt-1 block text-lg font-bold md:text-xl">
            Pick&apos;em
          </span>
        </Link>

        <div className="site-nav-links flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:gap-x-4 md:gap-x-6 md:text-base">
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

        </div>

        <div className="site-nav-account flex items-center justify-end gap-3">
          <button
            aria-label={isNightMode ? "Use light mode" : "Use dark mode"}
            aria-pressed={isNightMode}
            className="theme-toggle flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
            data-active={isNightMode}
            onClick={toggleTheme}
            title={isNightMode ? "Use light mode" : "Use dark mode"}
            type="button"
          >
            <span aria-hidden="true" className="theme-toggle-icon">{isNightMode ? "☀" : "☾"}</span>
          </button>

          {playerName ? (
            <div className="border-l border-zinc-500 pl-3 text-right text-sm sm:pl-4">
              <div className="flex items-center justify-end gap-3">
                <a className={linkStyle("/profile")} href="/profile">
                  Preferences
                </a>

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
