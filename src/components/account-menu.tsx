"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The signed-in player's menu: tap your name for Notifications (and the Commissioner desk on a phone) and Sign out.
 * Sign out asks once before it happens, so a stray tap never logs anyone out.
 */
export default function AccountMenu({ playerName, isCommissioner, showCommissionerLink, showTrophyRoom = false, isSigningOut, onSignOut, compact = false }: {
  playerName: string;
  isCommissioner: boolean;
  showCommissionerLink: boolean;
  showTrophyRoom?: boolean;
  isSigningOut: boolean;
  onSignOut: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | TouchEvent) => { if (box.current && !box.current.contains(event.target as Node)) { setOpen(false); setConfirming(false); } };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setConfirming(false); } };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("touchstart", close); document.removeEventListener("keydown", escape); };
  }, [open]);

  const item = "account-menu-item";
  return (
    <div className={`account-menu ${compact ? "is-compact" : ""}`} ref={box}>
      <button aria-expanded={open} aria-haspopup="menu" className="account-menu-button" onClick={() => { setOpen((current) => !current); setConfirming(false); }} type="button">
        {compact ? null : <span className="account-menu-signed">Signed in as</span>}
        <strong>{playerName}</strong>
        <span aria-hidden="true" className="account-menu-caret">▾</span>
      </button>
      {open ? (
        <div className="account-menu-panel" role="menu">
          {confirming ? (
            <div className="account-menu-confirm">
              <p>Sign out?</p>
              <button className={`${item} is-danger`} disabled={isSigningOut} onClick={onSignOut} role="menuitem" type="button">{isSigningOut ? "Signing out..." : "Yes, sign out"}</button>
              <button className={item} onClick={() => setConfirming(false)} role="menuitem" type="button">Cancel</button>
            </div>
          ) : (
            <>
              {showTrophyRoom ? <Link className={item} href="/trophy-room" onClick={() => setOpen(false)} role="menuitem">Trophy Room</Link> : null}
              <Link className={item} href="/profile" onClick={() => setOpen(false)} role="menuitem">Notifications</Link>
              {isCommissioner && showCommissionerLink ? <Link className={item} href="/admin" onClick={() => setOpen(false)} role="menuitem">Commissioner</Link> : null}
              <button className={item} onClick={() => setConfirming(true)} role="menuitem" type="button">Sign out</button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
