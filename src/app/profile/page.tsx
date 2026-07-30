"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Preferences = {
  weekly: boolean;
  finalLines: boolean;
  sundayFinalLines: boolean;
  earlyLock: boolean;
  pickDue: boolean;
  sundayEarlyReveal: boolean;
  sundayLateReveal: boolean;
  featuredWindowReveal: boolean;
  weeklyRecap: boolean;
};

type Profile = {
  notificationEmail: string;
  emailNotificationsEnabled: boolean;
  emailWeeklyEnabled: boolean;
  emailFinalLinesEnabled: boolean;
  emailSundayFinalLinesEnabled: boolean;
  emailEarlyLockEnabled: boolean;
  emailPickDueEnabled: boolean;
  emailSundayEarlyRevealEnabled: boolean;
  emailSundayLateRevealEnabled: boolean;
  emailFeaturedWindowRevealEnabled: boolean;
  emailWeeklyRecapEnabled: boolean;
};

const initialPreferences: Preferences = { weekly: true, finalLines: true, sundayFinalLines: false, earlyLock: true, pickDue: true, sundayEarlyReveal: false, sundayLateReveal: false, featuredWindowReveal: false, weeklyRecap: true };

function Choice({ checked, disabled = false, note, onChange, title }: { checked: boolean; disabled?: boolean; note: string; onChange: (checked: boolean) => void; title: string }) {
  return <label className={`flex items-start gap-3 rounded-md px-2 py-2 text-sm transition ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[#eee4d1]"}`}><input checked={checked} className="mt-1 size-4 accent-zinc-900" disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span><strong className="block text-[#171719]">{title}</strong><span className="block leading-5 text-slate-600">{note}</span></span></label>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<Preferences>) => setPreferences((current) => ({ ...current, ...patch }));

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetchWithSession("/api/profile");
        const data = await response.json() as Profile & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be loaded.");
        if (!active) return;
        setProfile(data); setEmail(data.notificationEmail); setEnabled(data.emailNotificationsEnabled);
        setPreferences({ weekly: data.emailWeeklyEnabled, finalLines: data.emailFinalLinesEnabled, sundayFinalLines: data.emailSundayFinalLinesEnabled, earlyLock: data.emailEarlyLockEnabled, pickDue: data.emailPickDueEnabled, sundayEarlyReveal: data.emailSundayEarlyRevealEnabled, sundayLateReveal: data.emailSundayLateRevealEnabled, featuredWindowReveal: data.emailFeaturedWindowRevealEnabled, weeklyRecap: data.emailWeeklyRecapEnabled });
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
      const response = await fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationEmail: email, emailNotificationsEnabled: enabled, emailWeeklyEnabled: preferences.weekly, emailFinalLinesEnabled: preferences.finalLines, emailSundayFinalLinesEnabled: preferences.sundayFinalLines, emailEarlyLockEnabled: preferences.earlyLock, emailPickDueEnabled: preferences.pickDue, emailSundayEarlyRevealEnabled: preferences.sundayEarlyReveal, emailSundayLateRevealEnabled: preferences.sundayLateReveal, emailFeaturedWindowRevealEnabled: preferences.featuredWindowReveal, emailWeeklyRecapEnabled: preferences.weeklyRecap }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be saved.");
      setProfile({ notificationEmail: email.trim(), emailNotificationsEnabled: enabled, emailWeeklyEnabled: preferences.weekly, emailFinalLinesEnabled: preferences.finalLines, emailSundayFinalLinesEnabled: preferences.sundayFinalLines, emailEarlyLockEnabled: preferences.earlyLock, emailPickDueEnabled: preferences.pickDue, emailSundayEarlyRevealEnabled: preferences.sundayEarlyReveal, emailSundayLateRevealEnabled: preferences.sundayLateReveal, emailFeaturedWindowRevealEnabled: preferences.featuredWindowReveal, emailWeeklyRecapEnabled: preferences.weeklyRecap });
      setMessage(data.message ?? "Notification settings saved.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your notification settings could not be saved.");
    } finally { setSaving(false); }
  }

  if (!profile && !error) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">Loading your preferences...</main>;
  return <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#171719] sm:px-6 sm:py-12"><div className="mx-auto max-w-2xl">
    <p className="text-xs font-bold tracking-[0.2em] text-slate-600">YOUR ACCOUNT</p><h1 className="mt-2 font-serif text-4xl font-bold">Notification preferences</h1>
    <form className="mt-8 border-y-2 border-[#1d1d1f] py-6" onSubmit={save}>
      <label className="block text-sm font-bold tracking-wide" htmlFor="notification-email">EMAIL ADDRESS</label>
      <input autoComplete="email" className="mt-2 min-h-12 w-full border border-zinc-500 bg-white px-3 py-2 outline-none focus:border-zinc-900" id="notification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      <p className="mt-3 text-sm leading-5 text-slate-600">Your address is private and used only for the pool communications below.</p>
      <label className="mt-5 flex items-start gap-3 border-y border-zinc-300 py-5 text-sm"><input checked={enabled} className="mt-1 size-4 accent-zinc-900" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /><span><strong className="block">Send pool emails to this address</strong>You can change this whenever you like.</span></label>
      {enabled ? <div className="mt-6 space-y-7">
        <section><h2 className="text-sm font-black tracking-[.14em] text-[#171719]">RECOMMENDED</h2><p className="mt-1 text-sm text-slate-600">The three essentials for following the pool without being chased down.</p><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.weeklyRecap} note="A friendly weekly wrap-up with the final slate, standings, and Survivor result while it is active." onChange={(checked) => update({ weeklyRecap: checked })} title="Weekly recap" /><Choice checked={preferences.finalLines} note="Official lines at 8:30 AM on every game day." onChange={(checked) => update({ finalLines: checked, ...(checked ? { sundayFinalLines: false } : {}) })} title="Final game-day lines" /><Choice checked={preferences.sundayFinalLines} disabled={preferences.finalLines} note={preferences.finalLines ? "Included in your every-game-day final-lines choice." : "A Sunday-only alternative at 8:30 AM."} onChange={(checked) => update({ sundayFinalLines: checked })} title="Sunday-only final lines" /><Choice checked={preferences.pickDue} note="A courteous reminder ONLY when you still have a selection to make." onChange={(checked) => update({ pickDue: checked })} title="Selections still to be made" /></div></section>
        <section><h2 className="text-sm font-black tracking-[.14em] text-[#171719]">WEEK SETUP & LINE LOCKS</h2><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.weekly} note="Wednesday morning: the full preliminary Slate with black lines." onChange={(checked) => update({ weekly: checked })} title="Fresh Slate on Wednesday" /><Choice checked={preferences.earlyLock} note="An international matchup has an earlier official line lock than the normal schedule." onChange={(checked) => update({ earlyLock: checked })} title="International game locks early" /></div></section>
        <section><h2 className="text-sm font-black tracking-[.14em] text-[#171719]">PUBLIC PICK WINDOWS</h2><p className="mt-1 text-sm text-slate-600">These arrive only after the listed games have started; future selections stay private.</p><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.sundayEarlyReveal} note="A standings view after the Sunday early games begin." onChange={(checked) => update({ sundayEarlyReveal: checked })} title="Sunday early-window reveal" /><Choice checked={preferences.sundayLateReveal} note="A second standings view after the Sunday late games begin." onChange={(checked) => update({ sundayLateReveal: checked })} title="Sunday late-window reveal" /><Choice checked={preferences.featuredWindowReveal} note="One combined option for primetime and international game windows." onChange={(checked) => update({ featuredWindowReveal: checked })} title="Primetime & international reveals" /></div></section>
        <p className="border-l-2 border-[#007e72] bg-[#edf7ef] px-3 py-2 text-sm text-slate-700">Commissioner notes are included automatically whenever pool emails are on, so important updates do not get missed.</p>
      </div> : null}
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
      <button className="mt-6 min-h-12 bg-[#1d1d1f] px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Save email choices"}</button>
    </form>
  </div></main>;
}
