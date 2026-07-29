"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Profile = {
  notificationEmail: string;
  emailNotificationsEnabled: boolean;
  emailWeeklyEnabled: boolean;
  emailFinalLinesEnabled: boolean;
  emailEarlyLockEnabled: boolean;
  emailPickDueEnabled: boolean;
  emailWeeklyRecapEnabled: boolean;
  emailCustomEnabled: boolean;
};

const choices = [
  { key: "weekly" as const, title: "Fresh slate on Wednesday", note: "A friendly welcome when the new week opens." },
  { key: "finalLines" as const, title: "Final lines · 8:30 AM on game days", note: "A look at the official lines on every game day, including Sunday." },
  { key: "earlyLock" as const, title: "International game locks early", note: "A heads-up when an international matchup has an earlier official lock." },
  { key: "pickDue" as const, title: "A gentle pick check", note: "Sunday at 11 AM and Monday at 5 PM, only if you still need to act." },
  { key: "weeklyRecap" as const, title: "Weekly recap", note: "Tuesday morning—Monday during the playoffs—with the final slate, standings, and Survivor result." },
  { key: "custom" as const, title: "Commissioner notes", note: "Occasional practical pool updates." },
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState({ weekly: true, finalLines: true, earlyLock: true, pickDue: true, weeklyRecap: true, custom: true });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetchWithSession("/api/profile");
        const data = await response.json() as Profile & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be loaded.");
        if (!active) return;
        setProfile(data); setEmail(data.notificationEmail); setEnabled(data.emailNotificationsEnabled);
        setPreferences({ weekly: data.emailWeeklyEnabled, finalLines: data.emailFinalLinesEnabled, earlyLock: data.emailEarlyLockEnabled, pickDue: data.emailPickDueEnabled, weeklyRecap: data.emailWeeklyRecapEnabled, custom: data.emailCustomEnabled });
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (active) setError(reason instanceof Error ? reason.message : "Your notification settings could not be loaded.");
      }
    })();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationEmail: email, emailNotificationsEnabled: enabled, emailWeeklyEnabled: preferences.weekly, emailFinalLinesEnabled: preferences.finalLines, emailEarlyLockEnabled: preferences.earlyLock, emailPickDueEnabled: preferences.pickDue, emailWeeklyRecapEnabled: preferences.weeklyRecap, emailCustomEnabled: preferences.custom }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be saved.");
      setProfile({ notificationEmail: email.trim(), emailNotificationsEnabled: enabled, emailWeeklyEnabled: preferences.weekly, emailFinalLinesEnabled: preferences.finalLines, emailEarlyLockEnabled: preferences.earlyLock, emailPickDueEnabled: preferences.pickDue, emailWeeklyRecapEnabled: preferences.weeklyRecap, emailCustomEnabled: preferences.custom });
      setMessage(data.message ?? "Email choices saved.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your notification settings could not be saved.");
    } finally { setSaving(false); }
  }

  if (!profile && !error) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">Loading your preferences...</main>;
  return <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#171719] sm:px-6 sm:py-12"><div className="mx-auto max-w-xl">
    <p className="text-xs font-bold tracking-[0.2em] text-slate-600">YOUR ACCOUNT</p><h1 className="mt-2 font-serif text-4xl font-bold">Notification preferences</h1>
    <form className="mt-8 border-y-2 border-[#1d1d1f] py-6" onSubmit={save}>
      <label className="block text-sm font-bold tracking-wide" htmlFor="notification-email">EMAIL ADDRESS</label>
      <input autoComplete="email" className="mt-2 min-h-12 w-full border border-zinc-500 bg-white px-3 py-2 outline-none focus:border-zinc-900" id="notification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      <p className="mt-3 text-sm leading-5 text-slate-600">Your address is private and used only for the choices below.</p>
      <fieldset className="mt-5 border-t border-zinc-300 pt-5"><legend className="text-sm font-bold tracking-wide">EMAIL REMINDERS</legend>
        <label className="mt-3 flex items-start gap-3 text-sm"><input checked={enabled} className="mt-1 size-4 accent-zinc-900" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /><span><strong className="block">Send reminders to this email</strong>You can change or turn this off whenever you like.</span></label>
        {enabled ? <div className="mt-4 space-y-3 text-sm">{choices.map((choice) => <label className="flex items-start gap-3" key={choice.key}><input checked={preferences[choice.key]} className="mt-1 size-4 accent-zinc-900" onChange={(event) => setPreferences((current) => ({ ...current, [choice.key]: event.target.checked }))} type="checkbox" /><span><strong className="block">{choice.title}</strong>{choice.note}</span></label>)}</div> : null}
      </fieldset>
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
      <button className="mt-6 min-h-12 bg-[#1d1d1f] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Save email choices"}</button>
    </form>
  </div></main>;
}
