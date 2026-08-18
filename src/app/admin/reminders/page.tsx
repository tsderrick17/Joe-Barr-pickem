"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { reminderTemplates, type ReminderTemplate } from "@/lib/reminder-templates";

type Reminder = { id: string; category: string; audience: string; title: string; body: string; scheduledFor: string; status: string; emailDelivered: number; emailFailed: number; emailSuppressed: number };

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
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, { title: string; body: string }>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState({ title: "", body: "" });
  const [form, setForm] = useState({ category: reminderTemplates[0].category, audience: reminderTemplates[0].audience, title: reminderTemplates[0].title, body: reminderTemplates[0].body, scheduledFor: initialTime() });

  function resolvedTemplate(template: ReminderTemplate) {
    return { ...template, ...(templateOverrides[template.id] ?? {}) };
  }

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

  async function loadTemplates() {
    try {
      const response = await fetchWithSession("/api/admin/reminder-templates");
      const data = await response.json() as { templates?: Array<{ id: string; title: string; body: string }>; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Standard email wording could not be loaded.");
      setTemplateOverrides(Object.fromEntries((data.templates ?? []).map((template) => [template.id, { title: template.title, body: template.body }])));
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Standard email wording could not be loaded.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); void loadTemplates(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function applyPreset(preset: ReminderTemplate) {
    const resolved = resolvedTemplate(preset);
    setForm((current) => ({ ...current, category: resolved.category, audience: resolved.audience, title: resolved.title, body: resolved.body }));
  }

  function beginTemplateEdit(template: ReminderTemplate) {
    const resolved = resolvedTemplate(template);
    setEditingTemplateId(template.id);
    setTemplateDraft({ title: resolved.title, body: resolved.body });
    setMessage(""); setError("");
  }

  async function saveTemplate() {
    if (!editingTemplateId) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession("/api/admin/reminder-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingTemplateId, title: templateDraft.title, message: templateDraft.body }) });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Standard email wording could not be saved.");
      setTemplateOverrides((current) => ({ ...current, [editingTemplateId]: { title: templateDraft.title.trim(), body: templateDraft.body.trim() } }));
      setMessage(data.message ?? "Standard email wording saved.");
      setEditingTemplateId(null);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Standard email wording could not be saved.");
    } finally { setSaving(false); }
  }

  async function resetTemplate() {
    if (!editingTemplateId) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession(`/api/admin/reminder-templates?id=${encodeURIComponent(editingTemplateId)}`, { method: "DELETE" });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Standard email wording could not be reset.");
      setTemplateOverrides((current) => { const next = { ...current }; delete next[editingTemplateId]; return next; });
      setMessage(data.message ?? "Standard wording restored.");
      setEditingTemplateId(null);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Standard email wording could not be reset.");
    } finally { setSaving(false); }
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

  async function test(template?: "selections") {
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetchWithSession("/api/admin/reminders/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template ? { template } : {}),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Test reminder could not be sent.");
      setMessage(data.message ?? "Test sent."); await load();
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Test reminder could not be sent.");
    } finally { setSaving(false); }
  }

  const scheduledCount = reminders.filter((reminder) => reminder.status === "scheduled").length;
  const attentionCount = reminders.filter((reminder) => reminder.status === "failed" || reminder.emailFailed > 0).length;
  const heldCount = reminders.reduce((total, reminder) => total + reminder.emailSuppressed, 0);

  return <main className="min-h-screen bg-[#f7f3e8] px-4 py-8 text-zinc-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">COMMISSIONER</p><h1 className="mt-2 font-serif text-4xl font-bold">Player reminders</h1><p className="mt-2 max-w-2xl text-zinc-700">Schedule opt-in-only email reminders. Messages never include private selections, and every attempted delivery is retained as a receipt.</p></div><Link className="font-semibold underline" href="/admin">Back to Commissioner</Link></header>
    <section className="grid gap-3 border-b-2 border-zinc-900 py-6 sm:grid-cols-3"><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">SCHEDULED</p><p className="mt-1 text-3xl font-serif font-bold">{scheduledCount}</p><p className="mt-1 text-sm text-zinc-700">Upcoming player messages</p></div><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">NEEDS YOU NOW</p><p className="mt-1 text-3xl font-serif font-bold">{attentionCount}</p><p className="mt-1 text-sm text-zinc-700">Failed or failed-to-send items</p></div><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">HELD FOR INBOX SPACE</p><p className="mt-1 text-3xl font-serif font-bold">{heldCount}</p><p className="mt-1 text-sm text-zinc-700">Routine emails intentionally not sent</p></div></section>
    <section className="border-b-2 border-zinc-900 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Send yourself a test</h2><p className="mt-1 text-sm text-zinc-700">Both previews send only to your enabled email address—never the pool.</p></div><div className="flex flex-wrap gap-3"><button className="border border-zinc-900 bg-white px-5 py-3 font-bold text-zinc-900 disabled:opacity-50" disabled={saving} onClick={() => void test()} type="button">Send delivery test</button><button className="bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void test("selections")} type="button">Preview selections email</button></div></div></section>
    <section className="border-b-2 border-zinc-900 py-8"><h2 className="font-serif text-2xl font-bold">Standard email wording</h2><p className="mt-1 text-sm text-zinc-700">Choose a message to edit its subject and wording for future use. Previously sent emails stay preserved exactly as delivered.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{reminderTemplates.map((template) => <article className="border border-zinc-400 bg-white p-3" key={template.id}><strong className="block">{template.label}</strong><p className="mt-1 line-clamp-2 text-sm text-zinc-700">{resolvedTemplate(template).title}</p><button className="mt-3 font-bold underline" onClick={() => beginTemplateEdit(template)} type="button">Edit standard wording</button></article>)}</div>{editingTemplateId ? <div className="mt-5 border-2 border-zinc-900 bg-white p-4"><p className="font-bold">Editing {reminderTemplates.find((template) => template.id === editingTemplateId)?.label}</p><label className="mt-4 block text-sm font-bold">SUBJECT<input className="mt-2 min-h-11 w-full border border-zinc-500 px-3 font-normal" maxLength={80} onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))} value={templateDraft.title} /></label><label className="mt-4 block text-sm font-bold">MESSAGE<textarea className="mt-2 min-h-24 w-full border border-zinc-500 px-3 py-2 font-normal" maxLength={220} onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))} value={templateDraft.body} /></label><div className="mt-4 flex flex-wrap gap-3"><button className="bg-zinc-900 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void saveTemplate()} type="button">Save standard wording</button><button className="border border-zinc-900 px-4 py-2 font-bold disabled:opacity-50" disabled={saving} onClick={() => void resetTemplate()} type="button">Restore original</button><button className="px-2 py-2 font-bold underline" disabled={saving} onClick={() => setEditingTemplateId(null)} type="button">Cancel</button></div></div> : null}</section>
    <form className="border-b-2 border-zinc-900 py-8" onSubmit={schedule}><h2 className="font-serif text-2xl font-bold">Schedule a reminder</h2><p className="mt-1 text-sm text-zinc-700">Start with a season-ready note below, then choose the exact Eastern time. The delivery worker checks every five minutes.</p><div className="mt-5 grid gap-3 sm:grid-cols-2">{reminderTemplates.map((preset) => <button className="border border-zinc-400 bg-white p-3 text-left text-sm hover:border-zinc-900" key={preset.id} onClick={() => applyPreset(preset)} type="button"><strong className="block">{preset.label}</strong><span className="mt-1 block text-zinc-700">Use this wording</span></button>)}</div><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">REMINDER TYPE<select className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, category: event.target.value as typeof form.category }))} value={form.category}>{reminderTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-bold">AUDIENCE<select className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value as typeof form.audience }))} value={form.audience}><option value="all_active">All active players</option><option value="pick_due">Only players who still need to act</option></select></label><label className="text-sm font-bold sm:col-span-2">TITLE<input className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" maxLength={80} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} /></label><label className="text-sm font-bold sm:col-span-2">MESSAGE<textarea className="mt-2 min-h-24 w-full border border-zinc-500 bg-white px-3 py-2 font-normal" maxLength={220} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} /></label><label className="text-sm font-bold">SEND AT (EASTERN TIME)<input className="mt-2 min-h-11 w-full border border-zinc-500 bg-white px-3 font-normal" onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} type="datetime-local" value={form.scheduledFor} /></label></div><button className="mt-6 bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} type="submit">{saving ? "Saving..." : "Schedule reminder"}</button></form>
    {error ? <p className="mt-5 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-5 font-semibold text-green-800">{message}</p> : null}
    <section className="py-8"><h2 className="font-serif text-2xl font-bold">Reminder receipt log</h2><p className="mt-1 text-sm text-zinc-700">A scheduled item can be cancelled until delivery begins. Each email attempt is retained as a receipt; a held routine email is not an error.</p>{loading ? <p className="mt-5">Loading reminders...</p> : reminders.length === 0 ? <p className="mt-5 text-zinc-700">No reminders have been scheduled yet.</p> : <div className="mt-5 space-y-3">{reminders.map((reminder) => <article className="border border-zinc-400 bg-white p-4" key={reminder.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-zinc-600">{reminder.category.replaceAll("_", " ")} · {reminder.audience.replaceAll("_", " ")} · {reminder.status}</p><h3 className="mt-1 font-bold">{reminder.title}</h3><p className="mt-1 text-sm text-zinc-700">{reminder.body}</p><p className="mt-3 text-sm text-zinc-600">Scheduled {easternDateTime(reminder.scheduledFor)} · Email: {reminder.emailDelivered} delivered, {reminder.emailFailed} failed, {reminder.emailSuppressed} held</p></div>{reminder.status === "scheduled" ? <button className="border border-red-800 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50" disabled={saving} onClick={() => void cancel(reminder.id)} type="button">Cancel</button> : null}</div></article>)}</div>}</section>
  </div></main>;
}
