"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { supabase } from "@/lib/supabase";
import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { currentSeasonYear } from "@/lib/season";

const NAVIGATION_RETRY_DELAYS_MS = [800, 2000, 4000];

export default function SiteNav() {
  const pathname = usePathname();
  const router = useRouter();
  const navRef = useRef<HTMLElement | null>(null);
  const mobileNavRef = useRef<HTMLElement | null>(null);

  const [playerName, setPlayerName] = useState("");
  const [isCommissioner, setIsCommissioner] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isNightMode, setIsNightMode] = useState(false);
  const [isBowlPoolLaunched, setIsBowlPoolLaunched] = useState(false);

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
    if (pathname === "/login") return;

    let active = true;

    async function loadNavigation(attempt = 0) {
      try {
        const response = await fetchWithSession("/api/profile");
        if (response.status === 401) throw new SessionUnavailableError();
        if (!response.ok) throw new Error("Account navigation could not be loaded.");
        const player = await response.json() as { firstName?: string; isCommissioner?: boolean };

        if (active) {
          setPlayerName(player.firstName ?? "");
          setIsCommissioner(player.isCommissioner ?? false);
        }
      } catch (error) {
        if (error instanceof SessionUnavailableError) {
          if (active) {
            setPlayerName("");
            setIsCommissioner(false);
            router.replace("/login");
          }
          return;
        }

        // Preserve any already-verified identity through a temporary read
        // failure. A transient request must never make account controls blink
        // out while the rest of the signed-in page remains on screen. Retry a
        // few times so one slow or failed profile read cannot leave the
        // Commissioner link and account controls missing until the next page.
        if (active && attempt < NAVIGATION_RETRY_DELAYS_MS.length) {
          window.setTimeout(() => {
            if (active) void loadNavigation(attempt + 1);
          }, NAVIGATION_RETRY_DELAYS_MS[attempt]);
        }
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
  }, [pathname, router]);

  // The Slate's small receipt bar sits directly beneath the sticky player
  // navigation on phones. The account strip intentionally scrolls away.
  // Measure whichever navigation is actually visible (the desktop bar is
  // display:none on phones and would report 0, letting the receipt slide under
  // the phone nav), and re-measure after navigation because the bar is not
  // rendered on the sign-in page.
  useEffect(() => {
    const navs = [navRef.current, mobileNavRef.current].filter((nav): nav is HTMLElement => Boolean(nav));
    if (!navs.length) return;

    const syncHeight = () => {
      const height = Math.max(...navs.map((nav) => nav.getBoundingClientRect().height));
      if (height > 0) {
        document.documentElement.style.setProperty("--site-nav-height", `${Math.ceil(height)}px`);
      }
    };

    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    navs.forEach((nav) => observer.observe(nav));
    window.addEventListener("resize", syncHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncHeight);
    };
  }, [pathname]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIsBowlPoolLaunched(Date.now() >= Date.parse(bowlPoolLaunchAt(currentSeasonYear())));
    }, 0);
    return () => window.clearTimeout(timer);
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
      router.replace("/login");
    }
  }

  function toggleTheme() {
    const nextNightMode = !isNightMode;
    document.documentElement.dataset.theme = nextNightMode ? "night" : "day";
    window.localStorage.setItem("pickem-theme", nextNightMode ? "night" : "day");
    setIsNightMode(nextNightMode);
  }

  return <>
    <nav className="site-nav hidden border-b-2 border-black bg-[#171719] text-[#f5f0e6] md:block" ref={navRef}>
      <div className="site-nav-shell mx-auto max-w-6xl px-4 py-3 sm:px-5 sm:py-4 md:px-10">
        <Link
          className="site-nav-brand font-serif leading-none text-[#f5f0e6]"
          href="/"
        >
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#e4ded2] md:text-xs">
            Joe Barr Memorial
          </span>
          <span className="mt-1 block text-lg font-bold md:text-xl">
            Lead Pipe Locks
          </span>
        </Link>

        <div className="site-nav-links flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm sm:gap-x-4 md:gap-x-6 md:text-base">
          <Link aria-current={pathname === "/" ? "page" : undefined} className={linkStyle("/")} href="/">
            Standings
          </Link>

          <Link aria-current={pathname.startsWith("/board") ? "page" : undefined} className={linkStyle("/board")} href="/board">
            The Slate
          </Link>

          {isCommissioner || isBowlPoolLaunched ? (
            <Link aria-current={pathname.startsWith("/bowl-pool") ? "page" : undefined} className={linkStyle("/bowl-pool")} href="/bowl-pool">
              NCAA Bowls
            </Link>
          ) : null}

          {isCommissioner ? (
            <Link aria-current={pathname.startsWith("/admin") ? "page" : undefined} className={linkStyle("/admin")} href="/admin">
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
                <a aria-current={pathname.startsWith("/profile") ? "page" : undefined} className={linkStyle("/profile")} href="/profile">
                  Notifications
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
    <nav aria-label="Account navigation" className="mobile-account-nav relative border-b border-zinc-700 bg-[#171719] text-[#f5f0e6] md:hidden">
      <div className="mx-auto max-w-6xl px-3 py-2">
        <div className="flex items-center justify-between gap-3">
          <Link className="min-w-0 font-serif leading-none text-[#f5f0e6]" href="/">
            <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#e4ded2]">Joe Barr Memorial</span>
            <span className="mt-1 block text-base font-bold">Lead Pipe Locks</span>
          </Link>
          <button
            aria-label={isNightMode ? "Use light mode" : "Use dark mode"}
            aria-pressed={isNightMode}
            className="theme-toggle flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
            data-active={isNightMode}
            onClick={toggleTheme}
            title={isNightMode ? "Use light mode" : "Use dark mode"}
            type="button"
          >
            <span aria-hidden="true" className="theme-toggle-icon text-xs">{isNightMode ? "☀" : "☾"}</span>
          </button>
        </div>
        <div className="mt-1 min-h-[1rem] flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-[11px] text-[#e4ded2]">
          {playerName ? (
            <>
            {isCommissioner ? <Link className="whitespace-nowrap underline underline-offset-2 hover:text-white" href="/admin">Comish</Link> : null}
            <Link className="whitespace-nowrap underline underline-offset-2 hover:text-white" href="/profile">Notifications</Link>
            <button className="whitespace-nowrap font-bold text-white underline underline-offset-2 disabled:opacity-50" disabled={isSigningOut} onClick={signOut} type="button">{isSigningOut ? "Signing out..." : "Sign out"}</button>
            <span className="whitespace-nowrap text-[#f5f0e6]">{playerName}</span>
            </>
          ) : null}
          </div>
      </div>
    </nav>
    <nav aria-label="Primary navigation" className="mobile-primary-nav border-b-2 border-black bg-[#171719] text-[#f5f0e6] md:hidden" ref={mobileNavRef}>
      <div className="mx-auto flex max-w-6xl items-center justify-center gap-x-12 px-3 py-2 text-sm sm:gap-x-16">
        <Link aria-current={pathname === "/" ? "page" : undefined} className={linkStyle("/")} href="/">Standings</Link>
        <Link aria-current={pathname.startsWith("/board") ? "page" : undefined} className={linkStyle("/board")} href="/board">The Slate</Link>
        {isCommissioner || isBowlPoolLaunched ? <Link aria-current={pathname.startsWith("/bowl-pool") ? "page" : undefined} className={linkStyle("/bowl-pool")} href="/bowl-pool">NCAA Bowls</Link> : null}
      </div>
    </nav>
  </>;
}
