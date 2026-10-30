"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getFreshSession, SessionUnavailableError } from "@/lib/auth-session";
import { notificationsBannerVisible, phoneNotificationStatus } from "@/lib/phone-push.js";
import { currentSubscription, readPhoneFacts, turnOnPhoneNotifications } from "@/lib/phone-push-client";

const DISMISSED_KEY = "pickem-notifications-banner-dismissed";

function readDismissed() {
  try {
    const value = Number(window.localStorage.getItem(DISMISSED_KEY) ?? NaN);
    return Number.isFinite(value) ? value : null;
  } catch { return null; }
}

type Stage = "hidden" | "offer" | "busy" | "on" | "later" | "error";

const buttonClass = "inline-flex min-h-11 shrink-0 items-center justify-center px-4 py-2 font-bold transition disabled:opacity-60";
const goldButton = `${buttonClass} bg-[#b38b4d] text-[#16223a] hover:bg-[#c79d5c]`;

/**
 * The one-tap "Turn on notifications" banner inside the Home Screen app, so a player who has just added the app never has to go looking for it.
 * Same place and look as the Add to Home Screen banner (which never shows inside the app, so the two never meet). One tap asks the phone; the
 * Notifications page keeps the full controls.
 */
export default function TurnOnNotifications() {
  const path = usePathname() ?? "/";
  const [stage, setStage] = useState<Stage>("hidden");

  useEffect(() => {
    let active = true;
    void (async () => {
      const facts = readPhoneFacts();
      if (!facts.standalone || !facts.hasPush) { if (active) setStage("hidden"); return; }
      const [session, subscription] = await Promise.all([getFreshSession().catch(() => null), currentSubscription().catch(() => null)]);
      if (!active) return;
      const status = phoneNotificationStatus({ ...facts, subscribed: subscription !== null });
      const visible = notificationsBannerVisible({ status, standalone: facts.standalone, signedIn: session !== null, path, dismissedAt: readDismissed(), now: Date.now() });
      // A message that is showing (done, later, or an error) stays until it finishes; otherwise follow the page.
      setStage((current) => (current === "hidden" || current === "offer" ? (visible ? "offer" : "hidden") : current));
    })();
    return () => { active = false; };
  }, [path]);

  useEffect(() => {
    if (stage !== "on" && stage !== "later") return;
    const timer = window.setTimeout(() => setStage("hidden"), 6000);
    return () => window.clearTimeout(timer);
  }, [stage]);

  function notNow() {
    try { window.localStorage.setItem(DISMISSED_KEY, String(Date.now())); } catch { /* private browsing: it is just forgotten */ }
    setStage("hidden");
  }

  async function turnOn() {
    setStage("busy");
    try {
      const outcome = await turnOnPhoneNotifications();
      if (outcome === "on") setStage("on");
      else if (outcome === "blocked") setStage("later");
      else notNow();   // the phone's question was closed without an answer: ask again another day
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) { setStage("hidden"); return; }
      setStage("error");
    }
  }

  if (stage === "hidden") return null;
  return <section aria-label="Notifications" className="home-screen-banner border-b-2 border-[#b38b4d] bg-[#16223a] px-4 py-3 text-[#fbf8f1]" data-notifications-banner={stage}>
    <div className="mx-auto flex max-w-3xl items-center gap-3">
      {stage === "offer" || stage === "busy" ? <>
        <p className="min-w-0 flex-1 text-[15px] font-bold leading-5">Get pool reminders on this phone</p>
        <button className={goldButton} disabled={stage === "busy"} onClick={turnOn} type="button">{stage === "busy" ? "Turning on…" : "Turn on"}</button>
        <button aria-label="Not now" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-xl leading-none text-[#e6d6b4]" disabled={stage === "busy"} onClick={notNow} type="button">✕</button>
      </> : null}
      {stage === "on" ? <p className="min-w-0 flex-1 text-[15px] font-bold leading-5" role="status">✓ Notifications are on. You’ll get the same messages as your emails.</p> : null}
      {stage === "later" ? <p className="min-w-0 flex-1 text-[15px] font-bold leading-5" role="status">No problem. You can turn them on any time under Notifications.</p> : null}
      {stage === "error" ? <>
        <p className="min-w-0 flex-1 text-[15px] font-bold leading-5" role="alert">That didn’t work. Try once more.</p>
        <button className={goldButton} onClick={turnOn} type="button">Try again</button>
        <button aria-label="Not now" className="-mr-2 inline-flex size-11 shrink-0 items-center justify-center text-xl leading-none text-[#e6d6b4]" onClick={notNow} type="button">✕</button>
      </> : null}
    </div>
  </section>;
}
