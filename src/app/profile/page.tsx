"use client";

import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type NotificationChoices = {
  weekly: boolean;
  finalLines: boolean;
  sundayFinalLines: boolean;
  earlyLock: boolean;
  pickDueSundayEarly: boolean;
  pickDueSundayAfternoon: boolean;
  pickDuePrimetime: boolean;
  sundayEarlyReveal: boolean;
  sundayLateReveal: boolean;
  featuredWindowReveal: boolean;
  weeklyRecap: boolean;
  playoffDayRecap: boolean;
  playoffPublicReveal: boolean;
};

type Profile = {
  notificationEmail: string;
  senderEmail: string;
  emailNotificationsEnabled: boolean;
  emailWeeklyEnabled: boolean;
  emailFinalLinesEnabled: boolean;
  emailSundayFinalLinesEnabled: boolean;
  emailEarlyLockEnabled: boolean;
  emailPickDueSundayEarlyEnabled: boolean;
  emailPickDueSundayAfternoonEnabled: boolean;
  emailPickDuePrimetimeEnabled: boolean;
  emailSundayEarlyRevealEnabled: boolean;
  emailSundayLateRevealEnabled: boolean;
  emailFeaturedWindowRevealEnabled: boolean;
  emailWeeklyRecapEnabled: boolean;
  emailPlayoffDayRecapEnabled: boolean;
  emailPlayoffPublicRevealEnabled: boolean;
};

type NotificationPace = "essentials" | "regular" | "full" | "custom";
type FinalLineChoice = "all" | "sunday" | "none";

const essentials: NotificationChoices = { weekly: false, finalLines: false, sundayFinalLines: false, earlyLock: false, pickDueSundayEarly: true, pickDueSundayAfternoon: true, pickDuePrimetime: true, sundayEarlyReveal: false, sundayLateReveal: false, featuredWindowReveal: false, weeklyRecap: true, playoffDayRecap: false, playoffPublicReveal: false };
const regular: NotificationChoices = { weekly: true, finalLines: true, sundayFinalLines: false, earlyLock: true, pickDueSundayEarly: true, pickDueSundayAfternoon: true, pickDuePrimetime: true, sundayEarlyReveal: false, sundayLateReveal: false, featuredWindowReveal: false, weeklyRecap: true, playoffDayRecap: false, playoffPublicReveal: false };
const full: NotificationChoices = { weekly: true, finalLines: true, sundayFinalLines: false, earlyLock: true, pickDueSundayEarly: true, pickDueSundayAfternoon: true, pickDuePrimetime: true, sundayEarlyReveal: true, sundayLateReveal: true, featuredWindowReveal: true, weeklyRecap: true, playoffDayRecap: true, playoffPublicReveal: true };

function matches(left: NotificationChoices, right: NotificationChoices) {
  return (Object.keys(left) as Array<keyof NotificationChoices>).every((key) => left[key] === right[key]);
}

function paceFor(preferences: NotificationChoices): NotificationPace {
  if (matches(preferences, essentials)) return "essentials";
  if (matches(preferences, regular)) return "regular";
  if (matches(preferences, full)) return "full";
  return "custom";
}

function Choice({ checked, note, onChange, title }: { checked: boolean; note: string; onChange: (checked: boolean) => void; title: string }) {
  return <label className="flex items-start gap-3 px-2 py-3 text-sm transition hover:bg-[#eee4d1]"><input checked={checked} className="mt-1 size-4 accent-[#007e72]" onChange={(event) => onChange(event.target.checked)} type="checkbox" /><span><strong className="block text-[#171719]">{title}</strong><span className="block leading-5 text-slate-600">{note}</span></span></label>;
}

function PaceCard({ active, detail, onChoose, recommended = false, title }: { active: boolean; detail: string; onChoose: () => void; recommended?: boolean; title: string }) {
  return <button aria-pressed={active} className={`relative min-h-32 border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#007e72] ${active ? "border-[#007e72] bg-[#e8f4f0] shadow-[inset_4px_0_0_#007e72]" : "border-zinc-300 bg-white hover:border-[#16877f]"}`} onClick={onChoose} type="button">{recommended ? <span className="absolute right-3 top-3 rounded-full bg-[#007e72] px-2 py-1 text-[10px] font-black tracking-[.1em] text-white">RECOMMENDED</span> : null}<strong className="block pr-24 text-base">{title}</strong><span className="mt-2 block text-sm leading-5 text-slate-600">{detail}</span><span className={`mt-3 block text-xs font-black tracking-[.12em] ${active ? "text-[#007e72]" : "text-slate-500"}`}>{active ? "SELECTED" : "CHOOSE THIS PACE"}</span></button>;
}

function FinalLinesChoice({ active, detail, onChoose, title }: { active: boolean; detail: string; onChoose: () => void; title: string }) {
  return <button aria-pressed={active} className={`min-h-24 border px-4 py-3 text-left transition ${active ? "border-[#007e72] bg-[#e8f4f0] shadow-[inset_4px_0_0_#007e72]" : "border-zinc-300 bg-white hover:border-[#16877f]"}`} onClick={onChoose} type="button"><strong className="block">{title}</strong><span className="mt-1 block text-sm leading-5 text-slate-600">{detail}</span><span className={`mt-2 block text-[10px] font-black tracking-[.12em] ${active ? "text-[#007e72]" : "text-slate-500"}`}>{active ? "SELECTED" : "CHOOSE"}</span></button>;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [preferences, setPreferences] = useState<NotificationChoices>(regular);
  const [showFineTune, setShowFineTune] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = (patch: Partial<NotificationChoices>) => setPreferences((current) => ({ ...current, ...patch }));
  const pace = paceFor(preferences);
  const finalLineChoice: FinalLineChoice = preferences.finalLines ? "all" : preferences.sundayFinalLines ? "sunday" : "none";

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await fetchWithSession("/api/profile");
        const data = await response.json() as Profile & { error?: string };
        if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be loaded.");
        if (!active) return;
        setProfile(data);
        setEmail(data.notificationEmail);
        setEnabled(data.emailNotificationsEnabled);
        setPreferences({
          weekly: data.emailWeeklyEnabled,
          finalLines: data.emailFinalLinesEnabled,
          sundayFinalLines: data.emailSundayFinalLinesEnabled,
          earlyLock: data.emailEarlyLockEnabled,
          pickDueSundayEarly: data.emailPickDueSundayEarlyEnabled,
          pickDueSundayAfternoon: data.emailPickDueSundayAfternoonEnabled,
          pickDuePrimetime: data.emailPickDuePrimetimeEnabled,
          sundayEarlyReveal: data.emailSundayEarlyRevealEnabled,
          sundayLateReveal: data.emailSundayLateRevealEnabled,
          featuredWindowReveal: data.emailFeaturedWindowRevealEnabled,
          weeklyRecap: data.emailWeeklyRecapEnabled,
          playoffDayRecap: data.emailPlayoffDayRecapEnabled,
          playoffPublicReveal: data.emailPlayoffPublicRevealEnabled,
        });
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (active) setError(reason instanceof Error ? reason.message : "Your notification settings could not be loaded.");
      }
    })();
    return () => { active = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notificationEmail: email,
          emailNotificationsEnabled: enabled,
          emailWeeklyEnabled: preferences.weekly,
          emailFinalLinesEnabled: preferences.finalLines,
          emailSundayFinalLinesEnabled: preferences.sundayFinalLines,
          emailEarlyLockEnabled: preferences.earlyLock,
          emailPickDueSundayEarlyEnabled: preferences.pickDueSundayEarly,
          emailPickDueSundayAfternoonEnabled: preferences.pickDueSundayAfternoon,
          emailPickDuePrimetimeEnabled: preferences.pickDuePrimetime,
          emailSundayEarlyRevealEnabled: preferences.sundayEarlyReveal,
          emailSundayLateRevealEnabled: preferences.sundayLateReveal,
          emailFeaturedWindowRevealEnabled: preferences.featuredWindowReveal,
          emailWeeklyRecapEnabled: preferences.weeklyRecap,
          emailPlayoffDayRecapEnabled: preferences.playoffDayRecap,
          emailPlayoffPublicRevealEnabled: preferences.playoffPublicReveal,
        }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Your notification settings could not be saved.");
      setProfile((current) => current ? { ...current, notificationEmail: email.trim(), emailNotificationsEnabled: enabled } : current);
      setMessage(data.message ?? "Notification settings saved.");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your notification settings could not be saved.");
    } finally { setSaving(false); }
  }

  if (!profile && !error) return <main className="min-h-screen bg-[#f5f0e6] p-8 text-[#171719]">Loading Notifications…</main>;

  return <main className="min-h-screen bg-[#f5f0e6] px-4 py-8 text-[#171719] sm:px-6 sm:py-12"><div className="mx-auto max-w-3xl">
    <h1 className="font-serif text-4xl font-bold">Notifications</h1>
    <form className="mt-8 border-y-2 border-[#1d1d1f] py-6" onSubmit={save}>
      <label className="block text-sm font-bold tracking-wide" htmlFor="notification-email">EMAIL ADDRESS</label>
      <input autoComplete="email" className="mt-2 min-h-12 w-full border border-zinc-500 bg-white px-3 py-2 outline-none focus:border-[#007e72]" id="notification-email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      <label className="mt-5 flex items-start gap-3 border-y border-zinc-300 py-5 text-sm"><input checked={enabled} className="mt-1 size-4 accent-[#007e72]" onChange={(event) => setEnabled(event.target.checked)} type="checkbox" /><span><strong className="block">Send pool emails to this address</strong>You can change the pace below whenever you like.</span></label>
      {enabled ? <aside className="mt-4 border-l-4 border-[#007e72] bg-white px-4 py-3 text-sm leading-5"><strong className="block">Keep PickemJB out of spam</strong>Add <span className="font-bold">PickemJB</span> and <span className="break-all font-mono font-bold">{profile?.senderEmail || "the PickemJB From address shown in your email"}</span> to your contacts or safe-senders list. This is the pool’s delivery address.</aside> : null}

      {enabled ? <div className="mt-7 space-y-8">
        <section><h2 className="text-sm font-black tracking-[.14em]">CHOOSE YOUR EMAIL PLAN</h2><div className="mt-4 grid gap-3 sm:grid-cols-3"><PaceCard active={pace === "essentials"} detail="Selection reminders and the Tuesday recap." onChoose={() => setPreferences(essentials)} title="Essentials" /><PaceCard active={pace === "regular"} detail="Essentials, plus Wednesday Slate, final lines, and Int’l locks." onChoose={() => setPreferences(regular)} recommended title="Regular" /><PaceCard active={pace === "full"} detail="Everything in Regular, plus public pick reveals and playoff-day updates." onChoose={() => setPreferences(full)} title="Full Card" /></div>{pace === "custom" ? <p className="mt-3 text-sm font-semibold text-[#007e72]">You have a custom mix. Your choices are preserved below.</p> : null}</section>

        <section className="border-y border-zinc-300 py-5"><button aria-expanded={showFineTune} className="flex w-full items-center justify-between gap-4 text-left" onClick={() => setShowFineTune((current) => !current)} type="button"><strong className="block text-sm tracking-[.12em]">FINE-TUNE THE DETAILS</strong><span className="text-xl text-[#007e72]">{showFineTune ? "−" : "+"}</span></button>{showFineTune ? <div className="mt-5 space-y-7">
          <section><h3 className="text-xs font-black tracking-[.14em]">FINAL GAMEDAY LINES</h3><p className="mt-1 text-sm text-slate-600">Choose the official-line email pace that fits you.</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><FinalLinesChoice active={finalLineChoice === "all"} detail="Sent once that day’s official lines are ready." onChoose={() => update({ finalLines: true, sundayFinalLines: false })} title="All gamedays" /><FinalLinesChoice active={finalLineChoice === "sunday"} detail="Sent once Sunday’s official lines are ready." onChoose={() => update({ finalLines: false, sundayFinalLines: true })} title="Sundays only" /><FinalLinesChoice active={finalLineChoice === "none"} detail="No final-line emails." onChoose={() => update({ finalLines: false, sundayFinalLines: false })} title="None" /></div></section>
          <section><h3 className="text-xs font-black tracking-[.14em]">SLATE DELIVERY</h3><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.earlyLock} note="Before an International game locks: official line and kickoff reminder." onChange={(checked) => update({ earlyLock: checked })} title="International lock" /><Choice checked={preferences.weekly} note="Wednesday morning: next week’s full preliminary Slate, before official lines." onChange={(checked) => update({ weekly: checked })} title="Fresh Slate on Wednesday" /></div></section>
          <section><h3 className="text-xs font-black tracking-[.14em]">SELECTION REMINDERS</h3><p className="mt-1 text-sm text-slate-600">Each one goes only to players who can still make a needed selection.</p><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.pickDueSundayEarly} note="Sunday at 11 AM ET." onChange={(checked) => update({ pickDueSundayEarly: checked })} title="Sunday early" /><Choice checked={preferences.pickDueSundayAfternoon} note="Sunday at 3 PM ET." onChange={(checked) => update({ pickDueSundayAfternoon: checked })} title="Sunday afternoon" /><Choice checked={preferences.pickDuePrimetime} note="Sunday at 6 PM ET and Monday at 5 PM ET." onChange={(checked) => update({ pickDuePrimetime: checked })} title="Sunday & Monday primetime" /></div></section>
          <section><h3 className="text-xs font-black tracking-[.14em]">PUBLIC PICK REVEALS</h3><p className="mt-1 text-sm text-slate-600">These go out after kickoff only when someone selected a game in that window. Later picks stay private.</p><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.sundayEarlyReveal} note="When the Sunday early window begins." onChange={(checked) => update({ sundayEarlyReveal: checked })} title="Sunday early window" /><Choice checked={preferences.sundayLateReveal} note="When the Sunday late window begins." onChange={(checked) => update({ sundayLateReveal: checked })} title="Sunday late window" /><Choice checked={preferences.featuredWindowReveal} note="At kickoff, only when at least one player picked that primetime or International game." onChange={(checked) => update({ featuredWindowReveal: checked })} title="Primetime and International windows" /></div></section>
          <section><h3 className="text-xs font-black tracking-[.14em]">RECAPS & PLAYOFFS</h3><div className="mt-2 divide-y divide-zinc-200 border-y border-zinc-200"><Choice checked={preferences.weeklyRecap} note="Tuesday morning: final Pick’em results and updated standings. Survivor is included only while it remains relevant." onChange={(checked) => update({ weeklyRecap: checked })} title="Weekly recap" /><Choice checked={preferences.playoffPublicReveal} note="At each playoff game’s kickoff, only when at least one player selected that game." onChange={(checked) => update({ playoffPublicReveal: checked })} title="Public playoff picks" /><Choice checked={preferences.playoffDayRecap} note="After every playoff game day is final, with the date in the subject." onChange={(checked) => update({ playoffDayRecap: checked })} title="Playoff day recap" /></div></section>
        </div> : null}</section>
      </div> : null}
      {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-4 font-semibold text-green-800">{message}</p> : null}
      <button className="mt-6 min-h-12 bg-[#007e72] px-5 py-3 font-bold text-white shadow-[0_2px_0_#07564f] transition hover:bg-[#086f66] disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving…" : "Save notification choices"}</button>
    </form>
  </div></main>;
}
