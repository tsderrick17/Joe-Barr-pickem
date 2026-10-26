"use client";

import { useState, useSyncExternalStore } from "react";
import { homeScreenBannerVisible, homeScreenHelp } from "@/lib/home-screen.js";

/** The browser's own one-tap Install (Chrome and most Android browsers hand it over once the page qualifies). */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const DISMISSED_KEY = "pickem-home-screen-dismissed";

// The browser offers the install once, soon after the page loads, so it is caught here as soon as this file loads and kept for whichever
// of the banner and the card on the Notifications page asks for it.
let offered: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();   // our own button takes the place of the browser's small bar
    offered = event as InstallPrompt;
    announce();
  });
  window.addEventListener("appinstalled", () => { offered = null; announce(); });
}
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const currentOffer = () => offered;
const noOffer = () => null;

/** What this phone is, read once on the phone itself (the server renders nothing, so there is no mismatch to hydrate over). */
type PhoneFacts = { userAgent: string; platform: string; maxTouchPoints: number; standalone: boolean; now: number };
let facts: PhoneFacts | null = null;
const readFacts = () => facts ??= {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  standalone: (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches,
  now: Date.now(),
};
const noFacts = () => null;

let dismissed: number | null | undefined;
function readDismissedAt() {
  try {
    const stored = window.localStorage.getItem(DISMISSED_KEY);
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}
const currentDismissedAt = () => dismissed === undefined ? (dismissed = readDismissedAt()) : dismissed;

function useHomeScreen() {
  const offer = useSyncExternalStore(subscribe, currentOffer, noOffer);
  const phone = useSyncExternalStore(subscribe, readFacts, noFacts);
  const dismissedAt = useSyncExternalStore(subscribe, currentDismissedAt, noOffer);
  const help = phone ? homeScreenHelp({ ...phone, canPrompt: offer !== null }) : "none";

  async function install() {
    if (!offer) return;
    offered = null;   // a browser's offer can be used once
    announce();
    try {
      await offer.prompt();
      await offer.userChoice;
    } catch { /* the phone closed it; the card on the Notifications page still has the steps */ }
  }

  function dismiss() {
    try { window.localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* the banner just comes back next visit */ }
    dismissed = Date.now();
    announce();
  }

  return { help, install, dismiss, bannerVisible: phone !== null && homeScreenBannerVisible({ help, dismissedAt, now: phone.now }) };
}

const buttonClass = "inline-flex min-h-11 shrink-0 items-center justify-center px-4 py-2 font-bold transition";
const goldButton = `${buttonClass} bg-[#b38b4d] text-[#16223a] hover:bg-[#c79d5c]`;
const tealButton = `${buttonClass} bg-[#007e72] text-white shadow-[0_2px_0_#07564f] hover:bg-[#086f66]`;

/** The Share button as it is drawn on an iPhone: a box with an arrow leaving the top. */
function ShareIcon() {
  return <svg aria-hidden="true" className="mx-0.5 inline-block h-[1.15em] w-[1.15em] -translate-y-0.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>;
}

function CopyLink({ className }: { className: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const address = typeof window === "undefined" ? "" : `${window.location.origin}/`;
  async function copy() {
    try { await navigator.clipboard.writeText(address); setState("copied"); } catch { setState("manual"); }
  }
  return <>
    <button className={`${className} ml-1 align-middle`} onClick={copy} type="button">Copy link</button>
    {state === "copied" ? <span className="ml-2 font-semibold" role="status">Copied.</span> : null}
    {state === "manual" ? <span className="ml-2 font-semibold" role="status">{address.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span> : null}
  </>;
}

/** The few short steps for the visitor's own phone and browser. */
function Steps({ help, copyClass }: { help: ReturnType<typeof homeScreenHelp>; copyClass: string }) {
  if (help === "iphone-safari") return <ol className="mt-3 list-decimal space-y-2 pl-6 leading-6">
    <li>Tap the Share button <ShareIcon /> in Safari. If you don’t see it, tap the ••• button first.</li>
    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
    <li>Tap <strong>Add</strong>, then open Lead Pipe Locks from your Home Screen.</li>
  </ol>;
  if (help === "iphone-other-browser") return <>
    <p className="mt-3 leading-6">On an iPhone the app that can send notifications has to be added from <strong>Safari</strong>.</p>
    <ol className="mt-2 list-decimal space-y-2 pl-6 leading-6">
      <li>Copy the link: <CopyLink className={copyClass} /></li>
      <li>Open Safari and paste the link into its address bar.</li>
      <li>Tap the Share button <ShareIcon />, then <strong>Add to Home Screen</strong>, then <strong>Add</strong>.</li>
    </ol>
  </>;
  return <ol className="mt-3 list-decimal space-y-2 pl-6 leading-6">
    <li>Tap the menu button (<strong>⋮</strong> or <strong>≡</strong>) in your browser.</li>
    <li>Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li>
    <li>Tap <strong>Install</strong>, then open Lead Pipe Locks from your Home Screen.</li>
  </ol>;
}

/**
 * Helps a player put the pool on their phone's Home Screen, where it opens like an app and can send notifications.
 * `banner` is the slim bar under the header of every page; it shows on a phone that is not already running the Home Screen app and stays away
 * for a while after "Not now". `card` is the always-there version on the Notifications page.
 * Android gets the browser's own one-tap Install; an iPhone has no such button, so one tap opens the short steps.
 */
export function AddToHomeScreen({ variant }: { variant: "banner" | "card" }) {
  const { help, install, dismiss, bannerVisible } = useHomeScreen();
  const [open, setOpen] = useState(false);

  if (variant === "card") {
    if (help === "none") return null;
    return <section aria-labelledby="home-screen-title" className="mt-8 border-y-2 border-(color:--themed-border-10) py-6" data-home-screen="card" data-home-screen-help={help}>
      <h2 className="text-sm font-black tracking-[.14em]" id="home-screen-title">ADD TO YOUR HOME SCREEN</h2>
      {help === "installed"
        ? <p className="mt-3 text-sm font-semibold leading-5 text-green-800">✓ Lead Pipe Locks is on your Home Screen.</p>
        : <>
          <p className="mt-3 text-sm leading-5 text-slate-600">Opens like an app, with no browser bars, and it is how this phone gets notifications.</p>
          {help === "android-prompt"
            ? <button className={`mt-4 ${tealButton}`} onClick={install} type="button">Install the app</button>
            : <div className="text-sm text-(color:--themed-text-18)"><Steps copyClass={`${buttonClass} border border-zinc-500 bg-(color:--themed-bg-26) text-(color:--themed-text-18)`} help={help} /></div>}
        </>}
    </section>;
  }

  if (!bannerVisible) return null;
  const message = help === "iphone-other-browser" ? "Add Lead Pipe Locks to your Home Screen from Safari" : "Add Lead Pipe Locks to your Home Screen";
  return <section aria-label="Add to Home Screen" className="home-screen-banner border-b-2 border-[#b38b4d] bg-[#16223a] px-4 py-3 text-[#fbf8f1]" data-home-screen="banner" data-home-screen-help={help}>
    <div className="mx-auto flex max-w-3xl items-center gap-3">
      <p className="min-w-0 flex-1 text-[15px] font-bold leading-5">{message}</p>
      {help === "android-prompt"
        ? <button className={goldButton} onClick={install} type="button">Install</button>
        : <button aria-expanded={open} className={goldButton} onClick={() => setOpen((value) => !value)} type="button">{open ? "Hide" : "Show me how"}</button>}
      <button aria-label="Not now" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-xl leading-none text-[#e6d6b4]" onClick={dismiss} type="button">✕</button>
    </div>
    {open && help !== "android-prompt" ? <div className="mx-auto mt-1 max-w-3xl text-[15px] text-[#fbf8f1]"><Steps copyClass={`${goldButton} ml-1`} help={help} /></div> : null}
  </section>;
}
