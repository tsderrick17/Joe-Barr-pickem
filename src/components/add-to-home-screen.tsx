"use client";

import { useState, useSyncExternalStore } from "react";
import { androidBrowser, homeScreenBannerVisible, homeScreenHelp } from "@/lib/home-screen.js";

/** The browser's own one-tap Install (Chrome and most Android browsers hand it over once the page qualifies). */
type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Help = ReturnType<typeof homeScreenHelp>;

const DISMISSED_KEY = "pickem-home-screen-dismissed";
const HAVE_IT_KEY = "pickem-home-screen-have-it";
const INSTALLED_KEY = "pickem-home-screen-installed";

function readStored(key: string) {
  try {
    const stored = window.localStorage.getItem(key);
    const value = stored === null ? NaN : Number(stored);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}
function store(key: string, value: string) {
  try { window.localStorage.setItem(key, value); } catch { /* private browsing: it is just forgotten */ }
}

// Everything the banner and the card read lives here, outside React, so both stay in step and the browser's one-time events are never missed.
const listeners = new Set<() => void>();
const announce = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };

let offered: InstallPrompt | null = null;
// Whether Android says the app is installed on this phone: "checking" until it answers, "unknown" where it cannot tell.
let related: "checking" | "installed" | "not-installed" | "unknown" = "unknown";

if (typeof window !== "undefined") {
  // The browser offers the install once, a little while after the page loads, so it is caught as soon as this file loads.
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();   // our own button takes the place of the browser's small bar
    offered = event as InstallPrompt;
    announce();
  });
  window.addEventListener("appinstalled", () => {
    offered = null;
    related = "installed";
    store(INSTALLED_KEY, String(Date.now()));
    announce();
  });
  const standalone = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  // The app and the browser share their storage on Android, so a tab there knows the app was opened on this phone before.
  if (standalone) store(INSTALLED_KEY, String(Date.now()));
  const lookup = (navigator as { getInstalledRelatedApps?: () => Promise<unknown[]> }).getInstalledRelatedApps;
  if (!standalone && typeof lookup === "function") {
    related = "checking";
    // The answer normally comes back at once; if it never does, the banner must not wait forever.
    const giveUp = window.setTimeout(() => { if (related === "checking") { related = "unknown"; announce(); } }, 2000);
    lookup.call(navigator).then((apps) => { if (related === "checking") related = apps.length > 0 ? "installed" : "not-installed"; }, () => { if (related === "checking") related = "unknown"; })
      .finally(() => { window.clearTimeout(giveUp); announce(); });
  }
}

/** What this phone is, read once on the phone itself (the server renders nothing, so there is nothing to mismatch while hydrating). */
type PhoneFacts = { userAgent: string; platform: string; maxTouchPoints: number; standalone: boolean; now: number };
let facts: PhoneFacts | null = null;
const readFacts = () => facts ??= {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  maxTouchPoints: navigator.maxTouchPoints,
  standalone: (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches,
  now: Date.now(),
};

type Quiet = { dismissedAt: number | null; haveItAt: number | null; installedBefore: boolean };
let quiet: Quiet | null = null;
const readQuiet = () => quiet ??= { dismissedAt: readStored(DISMISSED_KEY), haveItAt: readStored(HAVE_IT_KEY), installedBefore: readStored(INSTALLED_KEY) !== null };

const currentOffer = () => offered;
const currentRelated = () => related;
const nothing = () => null;

function useHomeScreen() {
  const offer = useSyncExternalStore(subscribe, currentOffer, nothing);
  const phone = useSyncExternalStore(subscribe, readFacts, nothing);
  const remembered = useSyncExternalStore(subscribe, readQuiet, nothing);
  const androidSays = useSyncExternalStore(subscribe, currentRelated, nothing);
  // Android's own answer wins (it also notices the app being removed); without one, the app having been opened on this device before counts.
  // A Chromebook's "no" is not trusted: on a computer Chrome only matches an app whose full address is written in the manifest, which this one is not.
  const trustNo = androidSays === "not-installed" && /Android/.test(phone?.userAgent ?? "");
  const installedHere = androidSays === "installed" || (!trustNo && remembered?.installedBefore === true);
  const ready = phone !== null && remembered !== null && androidSays !== null && androidSays !== "checking";
  const help: Help = ready ? homeScreenHelp({ ...phone, canPrompt: offer !== null, installedHere }) : "none";

  async function install() {
    if (!offer) return;
    offered = null;   // a browser's offer can be used once
    announce();
    try {
      await offer.prompt();
      await offer.userChoice;
    } catch { /* the phone closed it; the steps are still there */ }
  }

  function remember(key: string, field: "dismissedAt" | "haveItAt") {
    const at = Date.now();
    store(key, String(at));
    quiet = { ...readQuiet(), [field]: at };
    announce();
  }

  return {
    help,
    userAgent: phone?.userAgent ?? "",
    install,
    dismiss: () => remember(DISMISSED_KEY, "dismissedAt"),
    haveIt: () => remember(HAVE_IT_KEY, "haveItAt"),
    bannerVisible: ready && homeScreenBannerVisible({ help, dismissedAt: remembered.dismissedAt, haveItAt: remembered.haveItAt, now: phone.now }),
  };
}

const buttonClass = "inline-flex min-h-11 shrink-0 items-center justify-center px-4 py-2 font-bold transition";
const goldButton = `${buttonClass} bg-[#b38b4d] text-[#16223a] hover:bg-[#c79d5c]`;
const tealButton = `${buttonClass} bg-[#007e72] text-white shadow-[0_2px_0_#07564f] hover:bg-[#086f66]`;

/** The Share button as it is drawn on an iPhone: a box with an arrow leaving the top. */
function ShareIcon() {
  return <svg aria-label="(a box with an arrow pointing up)" className="mx-0.5 inline-block h-[1.15em] w-[1.15em] -translate-y-0.5" fill="none" role="img" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 15V3M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" /></svg>;
}

function CopyLink({ className }: { className: string }) {
  const [state, setState] = useState<"idle" | "copied" | "manual">("idle");
  const address = typeof window === "undefined" ? "" : `${window.location.origin}/`;
  async function copy() {
    try { await navigator.clipboard.writeText(address); setState("copied"); } catch { setState("manual"); }
  }
  return <>
    <button className={`${className} align-middle`} onClick={copy} type="button">Copy the link</button>
    {state === "copied" ? <span className="ml-2 font-semibold" role="status">Copied.</span> : null}
    {state === "manual" ? <span className="ml-2 font-semibold" role="status">{address.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span> : null}
  </>;
}

const OPEN_IT = "Then open Lead Pipe Locks from your Home Screen";
const isChromebook = (help: Help) => help === "chromebook-prompt" || help === "chromebook-steps";
const hasInstallButton = (help: Help) => help === "android-prompt" || help === "chromebook-prompt";

/** Three short steps for the visitor's own device and browser. */
function Steps({ help, userAgent, copyClass }: { help: Help; userAgent: string; copyClass: string }) {
  const list = "mt-3 list-decimal space-y-2 pl-6 leading-6";
  if (help === "iphone-safari") return <ol className={list}>
    <li>Tap the Share button <ShareIcon />. (Don’t see it? Tap <strong>•••</strong> first.)</li>
    <li>Scroll down and tap <strong>Add to Home Screen</strong>. (Not there? Open this page in the Safari app first.)</li>
    <li>Tap <strong>Add</strong>. {OPEN_IT} and sign in with your PIN.</li>
  </ol>;
  if (help === "iphone-browser") return <ol className={list}>
    <li>Tap the Share button <ShareIcon /> at the top. (Don’t see it? Look in the <strong>•••</strong> menu.)</li>
    <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
    <li>Tap <strong>Add</strong>. {OPEN_IT} and sign in with your PIN.</li>
  </ol>;
  if (help === "iphone-in-app" || help === "android-in-app") {
    const browser = help === "iphone-in-app" ? "Safari" : "Chrome";
    return <ol className={list}>
      <li>This page is open inside another app. Tap the <strong>•••</strong> or <strong>⋮</strong> menu and choose <strong>Open in {browser}</strong>.</li>
      <li>No such choice? <CopyLink className={copyClass} /> and paste it into {browser}.</li>
      <li>In {browser}, tap <strong>Show me how</strong> on this same bar.</li>
    </ol>;
  }
  if (isChromebook(help)) return <ol className={list}>
    <li>Click the install button <strong>⊕</strong> at the right end of the address bar. (Don’t see it? Click <strong>⋮</strong>, then <strong>Cast, save and share</strong>.)</li>
    <li>Click <strong>Install page as app</strong> or <strong>Install</strong>.</li>
    <li>Lead Pipe Locks opens in its own window. Next time, open it from the launcher.</li>
  </ol>;
  const browser = androidBrowser(userAgent);
  if (browser === "samsung") return <ol className={list}>
    <li>Tap the menu button <strong>≡</strong> at the bottom.</li>
    <li>Tap <strong>Add page to</strong>, then <strong>Home screen</strong>.</li>
    <li>Tap <strong>Add</strong>. {OPEN_IT}.</li>
  </ol>;
  if (browser === "firefox") return <ol className={list}>
    <li>Tap the menu button <strong>⋮</strong>.</li>
    <li>Tap <strong>Add app to Home screen</strong>.</li>
    <li>Tap <strong>Add</strong>. {OPEN_IT}.</li>
  </ol>;
  return <ol className={list}>
    <li>Tap the menu button <strong>⋮</strong> at the top right. (If you see <strong>Open in Chrome</strong>, tap that first.)</li>
    <li>Tap <strong>Add to Home screen</strong> (or <strong>Install app</strong>).</li>
    <li>Tap <strong>Install</strong>. {OPEN_IT}.</li>
  </ol>;
}

/**
 * Helps every player put the pool on their phone's Home Screen (or a Chromebook's launcher), where it opens like an app and can send notifications.
 * `banner` is the slim bar under the header of every page; it shows on any phone or Chromebook that is not running the app (and not known to have it),
 * and stays away 14 days after "Not now" or 180 days after "I already have it". `card` is the always-there version on the Notifications page.
 * Where the browser offers its own one-tap Install (Android, Chromebook) that is the button; everyone else gets one tap on "Show me how" and three steps.
 */
export function AddToHomeScreen({ variant }: { variant: "banner" | "card" }) {
  const { help, userAgent, install, dismiss, haveIt, bannerVisible } = useHomeScreen();
  const [open, setOpen] = useState(false);
  const device = isChromebook(help) ? "Chromebook" : "phone";

  if (variant === "card") {
    if (help === "none") return null;
    return <section aria-labelledby="home-screen-title" className="mt-8 border-y-2 border-(color:--themed-border-10) py-6" data-home-screen="card" data-home-screen-help={help}>
      <h2 className="text-sm font-black tracking-[.14em]" id="home-screen-title">{isChromebook(help) ? "INSTALL THE APP" : "ADD TO YOUR HOME SCREEN"}</h2>
      {help === "installed" ? <p className="mt-3 text-sm font-semibold leading-5 text-green-800">✓ You’re using the Lead Pipe Locks app.</p> : null}
      {help === "installed-tab" ? <p className="mt-3 text-sm font-semibold leading-5 text-green-800">✓ The Lead Pipe Locks app is on this device. Open it from your Home Screen or launcher.</p> : null}
      {help !== "installed" && help !== "installed-tab" ? <>
        <p className="mt-3 text-sm leading-5 text-slate-600">It opens like an app, and it lets this {device} get notifications.</p>
        {hasInstallButton(help)
          ? <button className={`mt-4 ${tealButton}`} onClick={install} type="button">Install the app</button>
          : <div className="text-sm text-(color:--themed-text-18)"><Steps copyClass={`${buttonClass} border border-zinc-500 bg-(color:--themed-bg-26) text-(color:--themed-text-18)`} help={help} userAgent={userAgent} /></div>}
      </> : null}
    </section>;
  }

  if (!bannerVisible) return null;
  return <section aria-label="Get the app" className="home-screen-banner border-b-2 border-[#b38b4d] bg-[#16223a] px-4 py-3 text-[#fbf8f1]" data-home-screen="banner" data-home-screen-help={help}>
    <div className="mx-auto flex max-w-3xl items-center gap-3">
      <p className="min-w-0 flex-1 text-[15px] font-bold leading-5">{isChromebook(help) ? "Get Lead Pipe Locks as an app on this Chromebook" : "Add Lead Pipe Locks to your Home Screen"}</p>
      {hasInstallButton(help)
        ? <button className={goldButton} onClick={install} type="button">Install</button>
        : <button aria-expanded={open} className={goldButton} onClick={() => setOpen((value) => !value)} type="button">{open ? "Hide" : "Show me how"}</button>}
      <button aria-label="Not now" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-xl leading-none text-[#e6d6b4]" onClick={dismiss} type="button">✕</button>
    </div>
    {open && !hasInstallButton(help) ? <div className="mx-auto mt-1 max-w-3xl text-[15px] text-[#fbf8f1]">
      <Steps copyClass={goldButton} help={help} userAgent={userAgent} />
      <p className="mt-2 leading-6">Already have it? <button className="min-h-11 font-bold text-[#e6c88f] underline underline-offset-4" onClick={haveIt} type="button">I already have it</button></p>
    </div> : null}
  </section>;
}
