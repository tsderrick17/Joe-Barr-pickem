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
  playoffDayRecap: boolean;
  playoffPublicReveal: boolean;
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
  emailPlayoffDayRecapEnabled: boolean;
  emailPlayoffPublicRevealEnabled: boolean;
};

type NotificationPace = "quiet" | "regular" | "full" | "custom";

const quiet: Preferences = { weekly: false, finalLines: false, sundayFinalLines: false, earlyLock: false, pickDue: true, sundayEarlyReveal: false, sundayLateReveal: false, featuredWindowReveal: false, weeklyRecap: true, playoffDayRecap: false, playoffPublicReveal: false };
const regular: Preferences = { weekly: true, finalLines: true, sundayFinalLines: false, earlyLock: true, pickDue: true, sundayEarlyReveal: false, sundayLateReveal: false, featuredWindowReveal: false, weeklyRecap: true, playoffDayRecap: false, playoffPublicReveal: false };
const full: Preferences = { weekly: true, finalLines: true, sundayFinalLines: false, earlyLock: true, pickDue: true, sundayEarlyReveal: true, sundayLateReveal: true, featuredWindowReveal: true, weeklyRecap: true, playoffDayRecap: true, playoffPublicReveal: true };
const initialPreferences = regular;

function matches(left: Preferences, right: Preferences) {
  return (Object.keys(left) as Array<keyof Preferences>).every((key) => left[key] === right[key]);
}

function paceFor(preferences: Preferences): NotificationPace {
  if (matches(preferences, quiet)) return "quiet";
  if (matches(preferences, regular)) return "regular";
  if (matches(preferences, full)) return "full";
  return "custom";
}

function Choice({ checked, disabled = false, note, onChange, title }: { checked: boolean; disabled?: boolean; note: string; onChange: (checked: boolean) => void; title: string }) {
  return <label className={`flex items-start gap-3 px-2 py-3 text-sm transition ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-[#eee4d1]"}`}><input checked={checked} className="mt-1 size-4 accent-[#007e72]" disabled={disabled} onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span><strong className="block text-[#171719]">{title}</strong><span className="block leading-5 text-slate-600">{note}</span></span></label>;
}

function PaceCard({ active, detail, onChoose, recommended = false, title }: { active: boolean; detail: string; onChoose: () => void; recommended?: boolean; title: string }) {
  return <button aria-pressed={active} className={`relative min-h-32 border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007e72] ${active ? "border-[#007e72] bg-[#e8f4f0] shadow-[inset_4px_0_0_#007e72]" : "border-zinc-300 bg-white hover:border-[#16877f]"}`} onClick={onChoose} type="button">{recommended ? <span className="absolute right-3 top-3 rounded-full bg-[#007e72] px-2 py-1 text-[10px] font-black tracking-[.1em] text-white">RECOMMENDED</span> : null}<strong className="block pr-24 text-base">{title}</strong><span className="mt-2 block text-sm leading-5 text-slate-600">{detail}</span><span className={`mt-3 block text-xs font-black tracking-[.12em] ${active ? "text-[#007e72]" : "text-slate-500"}`}>{active ? "SELECTED" : "CHOOSE THIS PACE"}</span></button>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState<Preferences>(initialPreferences);
  const [showFineTune, setShowFineTune] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<Preferences>) => setPreferences((current) => ({ ...current, ...patch }));
  const pace = paceFor(preferences);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetchWithSession("/api/profile");
        const data = await response.json() as Profile & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be loaded.");
        if (!active) return;
        setProfile(data); setEmail(data.notificationEmail); setEnabled(data.emailNotificationsEnabled);
        setPreferences({ weekly: data.emailWeeklyEnabled, finalLines: data.emailFinalLinesEnabled, sundayFinalLines: data.emailSundayFinalLinesEnabled, earlyLock: data.emailEarlyLockEnabled, pickDue: data.emailPickDueEnabled, sundayEarlyReveal: data.emailSundayEarlyRevealEnabled, sundayLateReveal: data.emailSundayLateRevealEnabled, featuredWindowReveal: data.emailFeaturedWindowRevealEnabled, weeklyRecap: data.emailWeeklyRecapEnabled, playoffDayRecap: data.emailPlayoffDayRecapEnabled, playoffPublicReveal: data.emailPlayoffPublicRevealEnabled });
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
      const response = await fetchWithSession("/api/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationEmail: email, emailNotificationsEnabled: enabled, emailWeeklyEnabled: preferences.weekly, emailFinalLinesEnabled: preferences.finalLines, emailSundayFinalLinesEnabled: preferences.sundayFinalLines, emailEarlyLockEnabled: preferences.earlyLock, emailPickDueEnabled: preferences.pickDue, emailSundayEarlyRevealEnabled: preferences.sundayEarlyReveal, emailSundayLateRevealEnabled: preferences.sundayLateReveal, emailFeaturedWindowRevealEnabled: preferences.featuredWindowReveal, emailWeeklyRecapEnabled: preferences.weeklyRecap, emailPlayoffDayRecapEnabled: preferences.playoffDayRecap, emailPlayoffPublicRevealEnabled: preferences.playoffPublicReveal }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be saved.");
      setProfile({ notificationEmail: email.trim(), emailNotificationsEnabled: enabled, emailWeeklyEnabled: preferences.weekly, emailFinalLinesEnabled: preferences.finalLines, emailSundayFinalLinesEnabled: preferences.sundayFinalLines, emailEarlyLockEnabled: preferences.earlyLock, emailPickDueEnabled: preferences.pickDue, emailSundayEarlyRevealEnabled: preferences.sundayEarlyReveal, emailSundayLateRevealEnabled: preferences.sundayLateReveal, emailFeaturedWindowRevealEnabled: preferences.featuredWindowReveal, emailWeeklyRecapEnabled: preferences.weeklyRecap, emailPlayoffDayRecapEnabled: preferences.playoffDayRecap, emailPlayoffPublicRevealEnabled: preferences.playoffPublicReveal });
      setMessage(data.message ?? "Notification settings saved.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your notification settings could not be saved.");
    } finally { setSaving(false); }
  }

  if (!profile && !error) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">Loading your preferences...</main>;
  return <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#171719] sm:px-6 sm:py-12"><div className="mx-auto max-w-3xl">
    <p className="text-xs font-bold tracking-[0.2em] text-slate-600">YOUR ACCOUNT</p><h1 className="mt-2 font-serif text-4xl font-bold">Notification preferences</h1><p className="mt-3 max-w-2xl leading-6 text-slate-600">Pick the pace that feels right. Every message is useful, private when it needs to be, and easy to change later.</p>
    <form className="mt-8 border-y-2 border-[#1d1d1f] py-6" onSubmit={save}>
      <label className="block text-sm font-bold tracking-wide" htmlFor="notification-email">EMAIL ADDRESS</label>
      <input autoComplete="email" className="mt-2 min-h-12 w-full border border-zinc-500 bg-white px-3 py-2 outline-none focus:border-[#007e72]" id="notification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      <p className="mt-3 text-sm leading-5 text-slate-600">Your address is private and used only for this pool.</p>
      <label className="mt-5 flex items-start gap-3 border-y border-zinc-300 py-5 text-sm"><input checked={enabled} className="mt-1 size-4 accent-[#007e72]" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /><span><strong className="block">Send pool emails to this address</strong>You can change the pace below whenever you like.</span></label>
      {enabled ? <div className="mt-7 space-y-8">
        <section><h2 className="text-sm font-black tracking-[.14em] text-[#171719]">CHOOSE YOUR PACE</h2><p className="mt-1 text-sm text-slate-600">Start simple. The detailed controls are available if you ever want them.</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><PaceCard active={pace === "quiet"} detail="Only the weekly recap and a reminder when a selection is still waiting for you." onChoose={() => setPreferences(quiet)} title="Quiet" /><PaceCard active={pace === "regular"} detail="Fresh Slate, official lines, gentle due reminders, and the weekly recap." onChoose={() => setPreferences(regular)} recommended title="Regular" /><PaceCard active={pace === "full"} detail="Everything above, plus public pick windows and playoff-day updates." onChoose={() => setPreferences(full)} title="Full card" /></div>{pace === "custom" ? <p className="mt-3 text-sm font-semibold text-[#007e72]">You have a custom mix. Your choices are preserved below.</p> : null}</section>
        <section className="border-y border-zinc-300 py-5"><button aria-expanded={showFineTune} className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setShowFineTune((current) => !current)} type="button"><span><strong className="block text-sm tracking-[.12em]">FINE-TUNE THE DETAILS</strong><span className="mt-1 block text-sm text-slate-600">Optional controls for exact days, public windows, and playoffs.</span></span><span className="text-xl text-[#007e72]">{showFineTune ? "−" : "+"}</span></button>{showFineTune ? <div className="mt-5 space-y-7">
          <section><h3 className="text-xs font-black tracking-[.14em] text-[#171719]">LINE LOCKS & WEEK SETUP</h3><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.finalLines} note="ALL gamedays at 8:30 AM, once official lines are set." onChange={(checked) => update({ finalLines: checked, ...(checked ? { sundayFinalLines: false } : {}) })} title="ALL final gameday lines" /><Choice checked={preferences.sundayFinalLines} disabled={preferences.finalLines} note={preferences.finalLines ? "Already included in ALL final gameday lines above." : "A Sunday-only alternative at 8:30 AM."} onChange={(checked) => update({ sundayFinalLines: checked })} title="Sunday-only final lines" /><Choice checked={preferences.earlyLock} note="A heads-up when an international matchup locks earlier than normal." onChange={(checked) => update({ earlyLock: checked })} title="International game locks early" /><Choice checked={preferences.weekly} note="Wednesday morning: the full preliminary Slate with black lines." onChange={(checked) => update({ weekly: checked })} title="Fresh Slate on Wednesday" /></div></section>
          <section><h3 className="text-xs font-black tracking-[.14em] text-[#171719]">PUBLIC PICK WINDOWS</h3><p className="mt-1 text-sm text-slate-600">These send only after the listed games have started. Later selections stay private.</p><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.sundayEarlyReveal} note="A standings view after the Sunday early games begin." onChange={(checked) => update({ sundayEarlyReveal: checked })} title="Sunday early window" /><Choice checked={preferences.sundayLateReveal} note="A second standings view after the Sunday late games begin." onChange={(checked) => update({ sundayLateReveal: checked })} title="Sunday late window" /><Choice checked={preferences.featuredWindowReveal} note="One combined choice for primetime and international game windows." onChange={(checked) => update({ featuredWindowReveal: checked })} title="Primetime and international windows" /></div></section>
          <section><h3 className="text-xs font-black tracking-[.14em] text-[#171719]">RECAPS & PLAYOFFS</h3><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.pickDue} note="A reminder only when there is still a selection waiting for you." onChange={(checked) => update({ pickDue: checked })} title="Selections still to be made" /><Choice checked={preferences.weeklyRecap} note="The final Pick'em board, standings, and Survivor update while that pool is active." onChange={(checked) => update({ weeklyRecap: checked })} title="Weekly recap" /><Choice checked={preferences.playoffPublicReveal} note="A public Pick'em board after each playoff kickoff window; later selections remain private." onChange={(checked) => update({ playoffPublicReveal: checked })} title="Public playoff pick windows" /><Choice checked={preferences.playoffDayRecap} note="A settled Pick'em update after each playoff day, limited to players who began that day with a path to tie." onChange={(checked) => update({ playoffDayRecap: checked })} title="Playoff day recap" /></div></section>
        </div> : null}</section>
      </div> : null}
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
      <button className="mt-6 min-h-12 bg-[#007e72] px-5 py-3 font-bold text-white shadow-[0_2px_0_#07564f] transition hover:bg-[#086f66] disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Save email choices"}</button>
    </form>
  </div></main>;
}
