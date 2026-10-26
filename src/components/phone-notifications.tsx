"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { applicationServerKey, phoneNotificationStatus } from "@/lib/phone-push.js";

type Status = "checking" | "unsupported" | "not-installed" | "blocked" | "on" | "off";

const jsonHeaders = { "Content-Type": "application/json" };

function readFacts() {
  const hasPush = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const isIPhone = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  return { hasPush, isIPhone, standalone, permission: hasPush ? Notification.permission : "default" };
}

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

async function failureMessage(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

const buttonClass = "min-h-12 px-5 py-3 font-bold transition disabled:opacity-50";
const primary = `${buttonClass} bg-[#007e72] text-white shadow-[0_2px_0_#07564f] hover:bg-[#086f66]`;
const secondary = `${buttonClass} border border-zinc-500 bg-(color:--themed-bg-26) text-(color:--themed-text-18) hover:border-[#16877f]`;

/** Turns this phone's notifications on and off, and sends a test. Only the Notifications page shows it. */
export function PhoneNotifications() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void (async () => {
      const facts = readFacts();
      const subscription = facts.hasPush ? await currentSubscription().catch(() => null) : null;
      if (!active) return;
      setStatus(phoneNotificationStatus({ ...facts, subscribed: subscription !== null }));
      // Keep the saved copy of this phone's subscription fresh (a browser can replace it without telling anyone).
      if (subscription && facts.permission === "granted") void fetchWithSession("/api/push/subscription", { method: "PUT", headers: jsonHeaders, body: JSON.stringify(subscription.toJSON()) }).catch(() => undefined);
    })();
    return () => { active = false; };
  }, []);

  async function run(work: () => Promise<void>, fallback: string) {
    setBusy(true); setError(""); setMessage("");
    try { await work(); } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error && reason.message ? reason.message : fallback);
    } finally { setBusy(false); }
  }

  const turnOn = () => run(async () => {
    // The permission question has to be asked straight from the tap, before anything else is waited on.
    const permission = await Notification.requestPermission();
    if (permission !== "granted") { setStatus(permission === "denied" ? "blocked" : "off"); return; }
    const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    const keyResponse = await fetchWithSession("/api/push/key");
    if (!keyResponse.ok) throw new Error(await failureMessage(keyResponse, "Notifications are not available right now."));
    const { publicKey } = await keyResponse.json() as { publicKey: string };
    const subscription = (await registration.pushManager.getSubscription()) ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
    const saved = await fetchWithSession("/api/push/subscription", { method: "PUT", headers: jsonHeaders, body: JSON.stringify(subscription.toJSON()) });
    if (!saved.ok) throw new Error(await failureMessage(saved, "Notifications could not be turned on."));
    setStatus("on");
    setMessage("Notifications are on for this phone.");
  }, "Notifications could not be turned on.");

  const turnOff = () => run(async () => {
    const subscription = await currentSubscription();
    if (subscription) {
      const { endpoint } = subscription;
      await subscription.unsubscribe();
      await fetchWithSession("/api/push/subscription", { method: "DELETE", headers: jsonHeaders, body: JSON.stringify({ endpoint }) });
    }
    setStatus("off");
    setMessage("Notifications are off for this phone.");
  }, "Notifications could not be turned off.");

  const sendTest = () => run(async () => {
    const response = await fetchWithSession("/api/push/test", { method: "POST" });
    if (!response.ok) throw new Error(await failureMessage(response, "The test notification could not be sent."));
    const result = await response.json() as { devices: number; sent: number };
    if (result.sent > 0) setMessage("Sent. It should arrive in a few seconds.");
    else if (result.devices === 0) { setStatus("off"); setError("This phone is not registered. Turn notifications on again."); }
    else setError("Your phone's notification service did not accept the test. Try again in a minute.");
  }, "The test notification could not be sent.");

  return <section aria-labelledby="phone-notifications-title" className="mt-8 border-y-2 border-(color:--themed-border-10) py-6" data-phone-notifications={status}>
    <h2 className="text-sm font-black tracking-[.14em]" id="phone-notifications-title">NOTIFICATIONS ON THIS PHONE</h2>
    {status === "checking" ? <p className="mt-3 text-sm text-slate-600">Checking this phone…</p> : null}
    {status === "off" ? <><p className="mt-3 text-sm leading-5 text-slate-600">Get a buzz on this phone, even when the app is closed.</p><button className={`mt-4 ${primary}`} disabled={busy} onClick={turnOn} type="button">{busy ? "Turning on…" : "Turn on notifications"}</button></> : null}
    {status === "on" ? <><p className="mt-3 text-sm font-semibold leading-5 text-green-800">✓ Notifications are on for this phone.</p><div className="mt-4 flex flex-wrap gap-3"><button className={primary} disabled={busy} onClick={sendTest} type="button">Send me a test</button><button className={secondary} disabled={busy} onClick={turnOff} type="button">Turn off on this phone</button></div></> : null}
    {status === "blocked" ? <p className="mt-3 text-sm leading-5 text-slate-600">This phone is blocking notifications for the app. Allow them in the phone’s Settings (under Notifications, Lead Pipe Locks), then come back here.</p> : null}
    {status === "not-installed" ? <p className="mt-3 text-sm leading-5 text-slate-600">To get notifications on an iPhone, add this page to your Home Screen (the Share button, then Add to Home Screen), open it from the Home Screen, and come back here.</p> : null}
    {status === "unsupported" ? <p className="mt-3 text-sm leading-5 text-slate-600">This browser can’t receive notifications. On an iPhone, use the app added to the Home Screen.</p> : null}
    <p aria-live="polite" className="sr-only">{message}</p>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
  </section>;
}
