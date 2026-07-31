"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Reminder = { id: string; category: string; audience: string; title: string; body: string; scheduledFor: string; status: string; emailDelivered: number; emailFailed: number };

const easternTimeZone = "America/New_York";

function easternParts(value: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    timeZone: easternTimeZone,
    year: "numeric",
  }).formatToParts(value);
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);

  return { day: read("day"), hour: read("hour"), minute: read("minute"), month: read("month"), year: read("year") };
}

function easternInput(value: Date) {
  const parts = easternParts(value);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
}

function easternInputToIso(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a valid Eastern reminder time.");

  const [, year, month, day, hour, minute] = match.map(Number);
  const easternWallTimeAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const observedEastern = easternParts(new Date(easternWallTimeAsUtc));
  const observedEasternAsUtc = Date.UTC(observedEastern.year, observedEastern.month - 1, observedEastern.day, observedEastern.hour, observedEastern.minute);
  const easternOffset = observedEasternAsUtc - easternWallTimeAsUtc;

  return new Date(easternWallTimeAsUtc - easternOffset).toISOString();
}

function easternDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    timeZone: easternTimeZone,
    timeZoneName: "short",
    year: "numeric",
  }).format(new Date(value));
}

const initialTime = () => {
  const date = new Date(Date.now() + 10 * 60_000);
  date.setSeconds(0, 0);
  return easternInput(date);
};

const presets = [
  { category: "weekly", audience: "all_active", title: "A fresh slate is ready", body: "The full preliminary slate is ready for the week, with black lines throughout. Take a look whenever you have a moment and make your selections before kickoff.", label: "Wednesday fresh slate" },
  { category: "final_lines", audience: "all_active", title: "Today's official lines are set", body: "The final lines are posted for today's games. Take a quick look at The Slate before the day gets moving.", label: "ALL final gameday lines — 8:30 AM" },
  { category: "sunday_final_lines", audience: "all_active", title: "Sunday's official lines are set", body: "The final lines are posted for today's games. Take a quick look at The Slate before the day gets moving.", label: "Sunday-only final lines — 8:30 AM" },
  { category: "early_lock", audience: "all_active", title: "International game locked early", body: "The international matchup has its official line early. Take a look at The Slate when you have a moment.", label: "International early lock" },
  { category: "pick_due", audience: "pick_due", title: "Selections still to be made", body: "A friendly reminder: there is still time to take care of anything waiting for you. Open the pool when you are ready.", label: "Sunday selections reminder — 11 AM" },
  { category: "pick_due", audience: "pick_due", title: "Selections still to be made", body: "A friendly reminder: there is still time to take care of anything waiting for you. Open the pool when you are ready.", label: "Sunday selections reminder — 3 PM" },
  { category: "pick_due", audience: "pick_due", title: "Selections still to be made", body: "A final reminder before tonight's game: please take a moment to look over anything still waiting for you.", label: "Monday selections reminder — 5 PM" },
  { category: "sunday_early_reveal", audience: "all_active", title: "Sunday early window picks are public", body: "The early games are underway. The public Pick'em board is ready to look over whenever you have a moment.", label: "Sunday early window reveal" },
  { category: "sunday_late_reveal", audience: "all_active", title: "Sunday late window picks are public", body: "The late games are underway. The updated public Pick'em board is ready to look over whenever you have a moment.", label: "Sunday late window reveal" },
  { category: "featured_window_reveal", audience: "all_active", title: "Featured-game picks are public", body: "The featured game window is underway. Public Pick'em selections are now available on the standings page.", label: "Primetime or international reveal" },
  { category: "weekly_recap", audience: "all_active", title: "This week in Joe Barr Pick'em", body: "The final slate, current standings, and Survivor recap are ready to look over. Thanks for being part of the pool.", label: "Weekly recap — Tuesday morning" },
  { category: "playoff_day_recap", audience: "all_active", title: "Today in the playoff race", body: "Today’s playoff card is final and the updated Pick'em race is ready to look over. Good luck in the next round.", label: "Playoff day recap — after final grades" },
  { category: "playoff_public_reveal", audience: "all_active", title: "Playoff picks are public", body: "This playoff window is underway. Public Pick'em receipts are ready to look over whenever you have a moment.", label: "Playoff public pick window — at kickoff" },
] as const;

const reminderTypes = [
  ["weekly", "Fresh slate"],
  ["final_lines", "ALL final gameday lines"],
  ["sunday_final_lines", "Sunday-only final lines"],
  ["early_lock", "International early lock"],
  ["pick_due", "Selections still to be made"],
  ["sunday_early_reveal", "Sunday early window reveal"],
  ["sunday_late_reveal", "Sunday late window reveal"],
  ["featured_window_reveal", "Primetime or international reveal"],
  ["weekly_recap", "Weekly recap"],
  ["playoff_day_recap", "Playoff day recap"],
  ["playoff_public_reveal", "Playoff public pick window"],
  ["custom", "Commissioner note"],
] as const;

export default function ReminderAdminPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category: "weekly", audience: "all_active", title: "A fresh slate is ready", body: "The full preliminary slate is ready for the week, with black lines throughout. Take a look whenever you have a moment and make your selections before kickoff.", scheduledFor: initialTime() });

  async function load() {
    setLoading(true);
    try {
      const response = await fetchWithSession("/api/admin/reminders");
      const data = await response.json() as { reminders?: Reminder[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Reminder history could not be loaded.");
      setReminders(data.reminders ?? []);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Reminder history could not be loaded.");
    } finally { setLoading(false); }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function applyPreset(preset: typeof presets[number]) {
    setForm((current) => ({ ...current, category: preset.category, audience: preset.audience, title: preset.title, body: preset.body }));
  }

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession("/api/admin/reminders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, scheduledFor: easternInputToIso(form.scheduledFor) }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Reminder could not be scheduled.");
      setMessage(data.message ?? "Reminder scheduled."); await load();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Reminder could not be scheduled.");
    } finally { setSaving(false); }
  }

  async function cancel(id: string) {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession(`/api/admin/reminders/${id}`, { method: "PATCH" });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Reminder could not be cancelled.");
      setMessage(data.message ?? "Reminder cancelled."); await load();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Reminder could not be cancelled.");
    } finally { setSaving(false); }
  }

  async function test() {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession("/api/admin/reminders/test", { method: "POST" });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Test reminder could not be sent.");
      setMessage(data.message ?? "Test sent."); await load();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Test reminder could not be sent.");
    } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f7f3e8] px-4 py-8 text-zinc-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">COMMISSIONER</p><h1 className="mt-2 font-serif text-4xl font-bold">Player reminders</h1><p className="mt-2 max-w-2xl text-zinc-700">Schedule opt-in-only email reminders. Messages never include private selections, and every attempted delivery is retained as a receipt.</p></div><Link className="font-semibold underline" href="/admin">Back to Commissioner</Link></header>
    <section className="border-b-2 border-zinc-900 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Send yourself a test</h2><p className="mt-1 text-sm text-zinc-700">Sends only to your enabled email address - never the pool.</p></div><button className="bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void test()} type="button">Send my email test</button></div></section>
    <form className="border-b-2 border-zinc-900 py-8" onSubmit={schedule}><h2 className="font-serif text-2xl font-bold">Schedule a reminder</h2><p className="mt-1 text-sm text-zinc-700">Start with a season-ready note below, then choose the exact Eastern time. The delivery worker checks every five minutes.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{presets.map((preset) => <button className="border border-zinc-400 bg-white p-3 text-left text-sm hover:border-zinc-900" key={preset.label} onClick={() => applyPreset(preset)} type="button"><strong className="block">{preset.label}</strong><span className="mt-1 block text-zinc-700">Use this wording</span></button>)}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">REMINDER TYPE<select className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} value={form.category}>{reminderTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold">AUDIENCE<select className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} value={form.audience}><option value="all_active">All active players</option><option value="pick_due">Only players who still need to act</option></select></label><label className="text-sm font-bold sm:col-span-2">TITLE<input className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" maxLength={80} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} /></label><label className="text-sm font-bold sm:col-span-2">MESSAGE<textarea className="mt-2 min-h-24 w-full border border-zinc-500 bg-white px-3 py-2 font-normal" maxLength={220} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} /></label><label className="text-sm font-bold">SEND AT (EASTERN TIME)<input className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} type="datetime-local" value={form.scheduledFor} /></label></div><button className="mt-6 bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Schedule reminder"}</button></form>
    {error ? <p className="mt-5 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-5 font-semibold text-green-800">{message}</p> : null}
    <section className="py-8"><h2 className="font-serif text-2xl font-bold">Reminder receipt log</h2><p className="mt-1 text-sm text-zinc-700">A scheduled item can be cancelled until delivery begins. Each email attempt is retained as a receipt.</p>{loading ? <p className="mt-5">Loading reminders...</p> : reminders.length === 0 ? <p className="mt-5 text-zinc-700">No reminders have been scheduled yet.</p> : <div className="mt-5 space-y-3">{reminders.map((reminder) => <article className="border border-zinc-400 bg-white p-4" key={reminder.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-zinc-600">{reminder.category.replaceAll("_", " ")} · {reminder.audience.replaceAll("_", " ")} · {reminder.status}</p><h3 className="mt-1 font-bold">{reminder.title}</h3><p className="mt-1 text-sm text-zinc-700">{reminder.body}</p><p className="mt-3 text-sm text-zinc-600">Scheduled {easternDateTime(reminder.scheduledFor)} · Email: {reminder.emailDelivered} delivered, {reminder.emailFailed} failed</p></div>{reminder.status === "scheduled" ? <button className="border border-red-800 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50" disabled={saving} onClick={() => void cancel(reminder.id)} type="button">Cancel</button> : null}</div></article>)}</div>}</section>
  </div></main>;
}
