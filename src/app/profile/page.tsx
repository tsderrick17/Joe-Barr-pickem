"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Profile = {
  notificationEmail: string;
};

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState("");
  const [pushError, setPushError] = useState("");
  const [pushSupported, setPushSupported] = useState(() => typeof window !== "undefined"
    && Boolean(vapidPublicKey && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window));

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetchWithSession("/api/profile");
        const data = await response.json() as Profile & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be loaded.");
        if (active) {
          setProfile(data);
          setEmail(data.notificationEmail);
        }
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (active) setError(reason instanceof Error ? reason.message : "Your notification settings could not be loaded.");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!pushSupported) return;

    void navigator.serviceWorker
      .register("/push-sw.js")
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setPushEnabled(Boolean(subscription)))
      .catch(() => setPushSupported(false));
  }, [pushSupported]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await fetchWithSession("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: email }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be saved.");
      setProfile({ notificationEmail: email.trim() });
      setMessage(data.message ?? "Contact email saved.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your notification settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function enableBrowserPush() {
    setPushError("");
    setPushMessage("");
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Allow browser notifications to receive Pick'em reminders on this device.");
      const registration = await navigator.serviceWorker.register("/push-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey!),
      });
      const response = await fetchWithSession("/api/profile/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) {
        if (!existing) await subscription.unsubscribe();
        throw new Error(data.error ?? "Browser notifications could not be turned on.");
      }
      setPushEnabled(true);
      setPushMessage(data.message ?? "Browser notifications are on for this device.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setPushError(reason instanceof Error ? reason.message : "Browser notifications could not be turned on.");
    } finally {
      setPushBusy(false);
    }
  }

  async function disableBrowserPush() {
    setPushError("");
    setPushMessage("");
    setPushBusy(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/push-sw.js");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        const response = await fetchWithSession("/api/profile/push", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        const data = await response.json() as { error?: string; message?: string };
        if (!response.ok) throw new Error(data.error ?? "Browser notifications could not be turned off.");
        await subscription.unsubscribe();
        setPushMessage(data.message ?? "Browser notifications are off for this device.");
      }
      setPushEnabled(false);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setPushError(reason instanceof Error ? reason.message : "Browser notifications could not be turned off.");
    } finally {
      setPushBusy(false);
    }
  }

  if (!profile && !error) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">Loading your preferences...</main>;

  return (
    <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#171719] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold tracking-[0.2em] text-slate-600">YOUR ACCOUNT</p>
        <h1 className="mt-2 font-serif text-4xl font-bold">Notification preferences</h1>
        <p className="mt-3 leading-6 text-slate-700">Choose how this device receives Joe Barr Memorial Pick&apos;em reminders. You can change these settings whenever you like.</p>
        <form className="mt-8 border-y-2 border-[#1d1d1f] py-6" onSubmit={save}>
          <label className="block text-sm font-bold tracking-wide" htmlFor="notification-email">EMAIL ADDRESS</label>
          <input autoComplete="email" className="mt-2 min-h-12 w-full border border-zinc-500 bg-white px-3 py-2 outline-none focus:border-zinc-900" id="notification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
          <p className="mt-3 text-sm leading-5 text-slate-600">Your contact email is stored privately. Email delivery is not active while the pool remains domain-free.</p>
          {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
          <button className="mt-6 min-h-12 bg-[#1d1d1f] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Save contact email"}</button>
        </form>
        <section className="border-b-2 border-[#1d1d1f] py-6">
          <p className="text-sm font-bold tracking-wide">BROWSER PUSH</p>
          <p className="mt-2 text-sm leading-5 text-slate-700">Free reminders for this browser and device. Turn them on here, then the Commissioner can send only the reminder types you choose.</p>
          {!pushSupported ? <p className="mt-3 text-sm text-slate-600">Browser push is being prepared for this deployment, or this browser does not support it.</p> : null}
          {pushError ? <p className="mt-4 font-semibold text-red-700">{pushError}</p> : null}
          {pushMessage ? <p className="mt-4 font-semibold text-green-800">{pushMessage}</p> : null}
          {pushSupported ? <button className="mt-5 min-h-12 border border-[#1d1d1f] px-5 py-3 font-bold disabled:opacity-50" disabled={pushBusy} onClick={pushEnabled ? disableBrowserPush : enableBrowserPush} type="button">{pushBusy ? "Updating..." : pushEnabled ? "Turn off browser reminders" : "Turn on browser reminders"}</button> : null}
        </section>
      </div>
    </main>
  );
}
