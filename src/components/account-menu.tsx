"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void> };
// Chrome (Android, desktop) offers its own install dialog once per page; keep it for the menu instead of a browser banner.
let installPrompt: InstallPrompt | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => { event.preventDefault(); installPrompt = event as InstallPrompt; });
}
const runningAsApp = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
const isAppleTouch = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

/**
 * The signed-in player's menu: tap your name for Notifications (and the Commissioner desk on a phone) and Sign out.
 * Sign out asks once before it happens, so a stray tap never logs anyone out. Commissioners also get Add to Home Screen
 * (a trial before players do): Chrome's own install dialog where it has one, otherwise the steps for that phone.
 */
export default function AccountMenu({ playerName, isCommissioner, showCommissionerLink, isSigningOut, onSignOut, compact = false }: {
  playerName: string;
  isCommissioner: boolean;
  showCommissionerLink: boolean;
  isSigningOut: boolean;
  onSignOut: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [installHelp, setInstallHelp] = useState<"apple" | "other" | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const reset = () => { setConfirming(false); setInstallHelp(null); };
  async function addToHomeScreen() {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = null;
      setOpen(false);
      await prompt.prompt();
      return;
    }
    setInstallHelp(isAppleTouch() ? "apple" : "other");
  }
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(event.target as Node)) { setOpen(false); reset(); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); reset(); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const item = "account-menu-item";
  return (
    <div className={`account-menu ${compact ? "is-compact" : ""}`} ref={box}>
      <button aria-expanded={open} aria-haspopup="menu" className="account-menu-button" onClick={() => { setCanInstall(isCommissioner && !runningAsApp()); setOpen((current) => !current); reset(); }} type="button">
        {compact ? null : <span className="account-menu-signed">Signed in as</span>}
        <strong>{playerName}</strong>
        <span aria-hidden="true" className="account-menu-caret">▾</span>
      </button>
      {open ? (
        <div className="account-menu-panel" role="menu">
          {installHelp ? (
            <div className="account-menu-confirm">
              <p>{installHelp === "apple" ? "In Safari, tap the Share button, then Add to Home Screen." : "Open your browser's menu and choose Install app or Add to Home screen."}</p>
              <button className={item} onClick={() => { setInstallHelp(null); setOpen(false); }} role="menuitem" type="button">Done</button>
            </div>
          ) : confirming ? (
            <div className="account-menu-confirm">
              <p>Sign out?</p>
              <button className={`${item} is-danger`} disabled={isSigningOut} onClick={onSignOut} role="menuitem" type="button">{isSigningOut ? "Signing out..." : "Yes, sign out"}</button>
              <button className={item} onClick={() => setConfirming(false)} role="menuitem" type="button">Cancel</button>
            </div>
          ) : (
            <>
              <Link className={item} href="/profile" onClick={() => setOpen(false)} role="menuitem">Notifications</Link>
              {isCommissioner && showCommissionerLink ? <Link className={item} href="/admin" onClick={() => setOpen(false)} role="menuitem">Commissioner</Link> : null}
              {canInstall ? <button className={item} onClick={addToHomeScreen} role="menuitem" type="button">Add to Home Screen</button> : null}
              <button className={item} onClick={() => setConfirming(true)} role="menuitem" type="button">Sign out</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
