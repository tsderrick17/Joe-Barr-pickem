"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Reminder = {
  id: string;
  category: string;
  audience: string;
  title: string;
  body: string;
  scheduledFor: string;
  status: string;
  sentAt: string | null;
  delivered: number;
  failed: number;
};

const initialTime = () => {
  const date = new Date(Date.now() + 10 * 60_000);
  date.setSeconds(0, 0);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export default function ReminderAdminPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({ category: "ats_due", audience: "ats_due", title: "Pick'em reminder", body: "You still have Pick'em selections due. Open The Slate to submit your picks.", scheduledFor: initialTime() });

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

  function updateCategory(category: string) {
    const defaults: Record<string, { audience: string; title: string; body: string }> = {
      weekly: { audience: "all_active", title: "A new Pick'em week is open", body: "The Slate is ready. Review the matchups and submit your selections." },
      ats_due: { audience: "ats_due", title: "Pick'em reminder", body: "You still have Pick'em selections due. Open The Slate to submit your picks." },
      survivor_due: { audience: "survivor_due", title: "Survivor reminder", body: "Your active Survivor entry still needs an outright winner." },
      custom: { audience: "all_active", title: "Joe Barr Pick'em update", body: "Open the pool for the latest update." },
    };
    setForm((current) => ({ ...current, category, ...defaults[category] }));
  }

  async function schedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession("/api/admin/reminders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, scheduledFor: new Date(form.scheduledFor).toISOString() }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Reminder could not be scheduled.");
      setMessage(data.message ?? "Browser reminder scheduled.");
      await load();
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
      setMessage(data.message ?? "Reminder cancelled.");
      await load();
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
      setMessage(data.message ?? "Test reminder sent.");
      await load();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Test reminder could not be sent.");
    } finally { setSaving(false); }
  }

  return <main className="min-h-screen bg-[#f7f3e8] px-4 py-8 text-zinc-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl"><header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">COMMISSIONER</p><h1 className="mt-2 font-serif text-4xl font-bold">Browser reminders</h1><p className="mt-2 max-w-2xl text-zinc-700">Schedule opt-in-only push messages. Reminders never contain players&apos; selections and every delivery is retained as a receipt.</p></div><Link className="font-semibold underline" href="/admin">Back to Commissioner</Link></header><section className="border-b-2 border-zinc-900 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Send a test</h2><p className="mt-1 text-sm text-zinc-700">Sends only to your own registered browser, never the pool.</p></div><button className="bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void test()} type="button">Send test to my browser</button></div></section><form className="border-b-2 border-zinc-900 py-8" onSubmit={schedule}><h2 className="font-serif text-2xl font-bold">Schedule a reminder</h2><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">REMINDER TYPE<select className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => updateCategory(event.target.value)} value={form.category}><option value="weekly">Weekly slate open</option><option value="ats_due">Pick&apos;em picks due</option><option value="survivor_due">Survivor pick due</option><option value="custom">Commissioner notice</option></select></label><label className="text-sm font-bold">AUDIENCE<select className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value }))} value={form.audience}><option value="all_active">All active players</option><option value="ats_due">Only players still needing ATS picks</option><option value="survivor_due">Only active Survivor entries needing a pick</option></select></label><label className="text-sm font-bold sm:col-span-2">TITLE<input className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" maxLength={80} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} /></label><label className="text-sm font-bold sm:col-span-2">MESSAGE<textarea className="mt-2 min-h-24 w-full border border-zinc-500 bg-white px-3 py-2 font-normal" maxLength={220} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} /></label><label className="text-sm font-bold">SEND AT (YOUR LOCAL TIME)<input className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} type="datetime-local" value={form.scheduledFor} /></label></div><button className="mt-6 bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Schedule browser reminder"}</button></form>{error ? <p className="mt-5 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-5 font-semibold text-green-800">{message}</p> : null}<section className="py-8"><h2 className="font-serif text-2xl font-bold">Reminder receipt log</h2><p className="mt-1 text-sm text-zinc-700">A scheduled item can be cancelled until delivery begins. Duplicate sends are blocked per browser subscription.</p>{loading ? <p className="mt-5">Loading reminders...</p> : reminders.length === 0 ? <p className="mt-5 text-zinc-700">No browser reminders have been scheduled yet.</p> : <div className="mt-5 space-y-3">{reminders.map((reminder) => <article className="border border-zinc-400 bg-white p-4" key={reminder.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-zinc-600">{reminder.category.replaceAll("_", " ")} · {reminder.audience.replaceAll("_", " ")} · {reminder.status}</p><h3 className="mt-1 font-bold">{reminder.title}</h3><p className="mt-1 text-sm text-zinc-700">{reminder.body}</p><p className="mt-3 text-sm text-zinc-600">Scheduled {new Date(reminder.scheduledFor).toLocaleString()} · Delivered {reminder.delivered} · Failed/expired {reminder.failed}</p></div>{reminder.status === "scheduled" ? <button className="border border-red-800 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50" disabled={saving} onClick={() => void cancel(reminder.id)} type="button">Cancel</button> : null}</div></article>)}</div>}</section></div></main>;
}
