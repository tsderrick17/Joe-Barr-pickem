"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Profile = {
  notificationEmail: string;
  emailNotificationsEnabled: boolean;
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

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
          setEnabled(data.emailNotificationsEnabled);
        }
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (active) setError(reason instanceof Error ? reason.message : "Your notification settings could not be loaded.");
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      const response = await fetchWithSession("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationEmail: email, emailNotificationsEnabled: enabled }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be saved.");
      setProfile({ notificationEmail: email.trim(), emailNotificationsEnabled: enabled });
      setMessage(data.message ?? "Notification settings saved.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your notification settings could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  if (!profile && !error) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">Loading your preferences...</main>;

  return (
    <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#171719] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-xl">
        <p className="text-xs font-bold tracking-[0.2em] text-slate-600">YOUR ACCOUNT</p>
        <h1 className="mt-2 font-serif text-4xl font-bold">Notification preferences</h1>
        <p className="mt-3 leading-6 text-slate-700">Email reminders are optional. Your address is only used for Joe Barr Memorial Pick&apos;em notifications.</p>
        <form className="mt-8 border-y-2 border-[#1d1d1f] py-6" onSubmit={save}>
          <label className="block text-sm font-bold tracking-wide" htmlFor="notification-email">EMAIL ADDRESS</label>
          <input autoComplete="email" className="mt-2 min-h-12 w-full border border-zinc-500 bg-white px-3 py-2 outline-none focus:border-zinc-900" id="notification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
          <label className="mt-5 flex items-start gap-3 text-sm leading-5"><input checked={enabled} className="mt-1 size-4 accent-zinc-900" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /><span><strong className="block">Email reminders</strong>Receive pool reminders when the Commissioner schedules them. You can turn this off whenever you like.</span></label>
          {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
          {message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
          <button className="mt-6 min-h-12 bg-[#1d1d1f] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Save preferences"}</button>
        </form>
        <p className="mt-5 text-sm text-slate-600">Push notifications will be available here once they are configured.</p>
      </div>
    </main>
  );
}
