"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { reminderTemplates, type ReminderTemplate } from "@/lib/reminder-templates";

type Reminder = { id: string; category: string; audience: string; title: string; body: string; scheduledFor: string; status: string; suppressionReason: string | null; emailDelivered: number; emailFailed: number; emailSuppressed: number };

const easternTimeZone = "America/New_York";

const templateGroups = [
  { title: "Slate and official lines", description: "The weekly slate, final line, and International-lock notices.", ids: ["weekly", "final_lines", "sunday_final_lines", "early_lock"] },
  { title: "Selection reminders", description: "Private prompts sent only to players who still have selections to make.", ids: ["pick_due_sunday_11", "pick_due_sunday_3", "pick_due_sunday_6", "pick_due_monday"] },
  { title: "Public pick reveals", description: "Messages released at kickoff only when that game has actual pool action.", ids: ["sunday_early_reveal", "sunday_late_reveal", "featured_window_reveal", "playoff_public_reveal"] },
  { title: "Results and recaps", description: "The settled weekly and playoff summaries that become permanent receipts.", ids: ["weekly_recap", "weekly_recap_pickem_only", "playoff_day_recap"] },
] as const;

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

export default function ReminderAdminPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [templateOverrides, setTemplateOverrides] = useState<Record<string, { title: string; body: string }>>({});
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDraft, setTemplateDraft] = useState({ title: "", body: "" });
  const [recentIssueCutoff, setRecentIssueCutoff] = useState(0);

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
    const timer = window.setTimeout(() => { setRecentIssueCutoff(Date.now() - 7 * 24 * 60 * 60 * 1000); void load(); void loadTemplates(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

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
  const attentionCount = reminders.filter((reminder) => (reminder.status === "failed" || reminder.emailFailed > 0) && new Date(reminder.scheduledFor).getTime() >= recentIssueCutoff).length;
  const suppressedCount = reminders.reduce((total, reminder) => total + reminder.emailSuppressed, 0);

  return <main className="min-h-screen bg-[#f7f3e8] px-4 py-8 text-zinc-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">COMMISSIONER</p><h1 className="mt-2 font-serif text-4xl font-bold">Email center</h1><p className="mt-2 max-w-2xl text-zinc-700">See delivery health first, then test or refine future automatic messages. Previously sent emails remain permanent receipts.</p></div><Link className="font-semibold underline" href="/admin">Back to Commissioner</Link></header>
    <section className="grid gap-3 border-b-2 border-zinc-900 py-6 sm:grid-cols-3"><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">SCHEDULED</p><p className="mt-1 text-3xl font-serif font-bold">{scheduledCount}</p><p className="mt-1 text-sm text-zinc-700">Upcoming player messages</p></div><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">RECENT DELIVERY ISSUES</p><p className="mt-1 text-3xl font-serif font-bold">{attentionCount}</p><p className="mt-1 text-sm text-zinc-700">Failed sends in the past 7 days</p></div><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">NOT NEEDED</p><p className="mt-1 text-3xl font-serif font-bold">{suppressedCount}</p><p className="mt-1 text-sm text-zinc-700">Empty reveal windows intentionally suppressed</p></div></section>
    <section className="border-b-2 border-zinc-900 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Send yourself a test</h2><p className="mt-1 text-sm text-zinc-700">Both previews send only to your enabled email address—never the pool.</p></div><div className="flex flex-wrap gap-3"><button className="border border-zinc-900 bg-white px-5 py-3 font-bold text-zinc-900 disabled:opacity-50" disabled={saving} onClick={() => void test()} type="button">Send delivery test</button><button className="bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void test("selections")} type="button">Preview selections email</button></div></div></section>
    <section className="border-b-2 border-zinc-900 py-8"><h2 className="font-serif text-2xl font-bold">Standard email wording</h2><p className="mt-1 text-sm text-zinc-700">Open only the kind of message you want to refine. Keep <code>{"{{week}}"}</code> or <code>{"{{date}}"}</code> where shown so subjects remain current.</p><div className="mt-5 space-y-3">{templateGroups.map((group, index) => { const templates = reminderTemplates.filter((template) => (group.ids as readonly string[]).includes(template.id)); return <details className="border border-zinc-300 bg-white" key={group.title} open={index === 0}><summary className="cursor-pointer px-4 py-4"><span className="font-serif text-xl font-bold">{group.title}</span><span className="ml-2 text-sm text-zinc-600">{templates.length} messages</span><p className="mt-1 pr-8 text-sm text-zinc-700">{group.description}</p></summary><div className="grid gap-3 border-t border-zinc-200 p-4 sm:grid-cols-2">{templates.map((template) => <article className="border border-zinc-300 bg-[#fdfcf8] p-3" key={template.id}><strong className="block">{template.label}</strong><p className="mt-1 line-clamp-2 text-sm text-zinc-700">{resolvedTemplate(template).title}</p><button className="mt-3 font-bold underline underline-offset-2" onClick={() => beginTemplateEdit(template)} type="button">Edit wording</button></article>)}</div></details>; })}</div>{editingTemplateId ? <div className="mt-5 border-2 border-zinc-900 bg-white p-4"><p className="text-xs font-black tracking-[.14em] text-zinc-600">EDITING</p><p className="mt-1 font-serif text-xl font-bold">{reminderTemplates.find((template) => template.id === editingTemplateId)?.label}</p><label className="mt-4 block text-sm font-bold">SUBJECT<input className="mt-2 min-h-11 w-full border border-zinc-500 px-3 font-normal" maxLength={80} onChange={(event) => setTemplateDraft((current) => ({ ...current, title: event.target.value }))} value={templateDraft.title} /></label><label className="mt-4 block text-sm font-bold">MESSAGE<textarea className="mt-2 min-h-24 w-full border border-zinc-500 px-3 py-2 font-normal" maxLength={220} onChange={(event) => setTemplateDraft((current) => ({ ...current, body: event.target.value }))} value={templateDraft.body} /></label><div className="mt-4 flex flex-wrap gap-3"><button className="bg-zinc-900 px-4 py-2 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void saveTemplate()} type="button">Save standard wording</button><button className="border border-zinc-900 px-4 py-2 font-bold disabled:opacity-50" disabled={saving} onClick={() => void resetTemplate()} type="button">Restore original</button><button className="px-2 py-2 font-bold underline" disabled={saving} onClick={() => setEditingTemplateId(null)} type="button">Cancel</button></div></div> : null}</section>
    {error ? <p className="mt-5 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-5 font-semibold text-green-800">{message}</p> : null}
    <section className="py-8"><h2 className="font-serif text-2xl font-bold">Reminder receipt log</h2><p className="mt-1 text-sm text-zinc-700">A scheduled item can be cancelled until delivery begins. Every attempted delivery is retained; automatic reveal emails with no selections are clearly marked suppressed.</p>{loading ? <p className="mt-5">Loading reminders...</p> : reminders.length === 0 ? <p className="mt-5 text-zinc-700">No reminders have been scheduled yet.</p> : <div className="mt-5 space-y-3">{reminders.map((reminder) => <article className="border border-zinc-400 bg-white p-4" key={reminder.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-zinc-600">{reminder.category.replaceAll("_", " ")} · {reminder.audience.replaceAll("_", " ")} · {reminder.status}</p><h3 className="mt-1 font-bold">{reminder.title}</h3><p className="mt-1 text-sm text-zinc-700">{reminder.body}</p>{reminder.suppressionReason ? <p className="mt-2 text-sm font-semibold text-[#075f58]">No email needed: {reminder.suppressionReason}</p> : null}<p className="mt-3 text-sm text-zinc-600">Scheduled {easternDateTime(reminder.scheduledFor)} · Email: {reminder.emailDelivered} delivered, {reminder.emailFailed} failed, {reminder.emailSuppressed} suppressed</p></div>{reminder.status === "scheduled" ? <button className="border border-red-800 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50" disabled={saving} onClick={() => void cancel(reminder.id)} type="button">Cancel</button> : null}</div></article>)}</div>}</section>
  </div></main>;
}
