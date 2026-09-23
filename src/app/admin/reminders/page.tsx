"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

const EmailArtworkStudio = dynamic(
  () => import("@/components/email-artwork-studio").then((module) => module.EmailArtworkStudio),
  { ssr: false, loading: () => <section className="border-b-2 border-zinc-900 py-8"><p className="text-sm text-zinc-600">Loading email image studio…</p></section> },
);

type Reminder = { id: string; category: string; audience: string; title: string; body: string; scheduledFor: string; status: string; suppressionReason: string | null; emailDelivered: number; emailFailed: number; emailSuppressed: number };

const easternTimeZone = "America/New_York";


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
  const [previewReminderId, setPreviewReminderId] = useState<string>();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [recentIssueCutoff] = useState(() => Date.now() - 7 * 24 * 60 * 60 * 1000);

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
    window.queueMicrotask(() => void load());
  }, []);

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
  const scheduledReminders = reminders
    .filter((reminder) => reminder.status === "scheduled" || reminder.status === "sending")
    .sort((left, right) => {
      const leftTime = new Date(left.scheduledFor).getTime();
      const rightTime = new Date(right.scheduledFor).getTime();
      return (Number.isFinite(leftTime) ? leftTime : Number.POSITIVE_INFINITY) - (Number.isFinite(rightTime) ? rightTime : Number.POSITIVE_INFINITY);
    });
  const sentReminders = reminders.filter((reminder) => reminder.status !== "scheduled" && reminder.status !== "sending");

  function reminderCard(reminder: Reminder, canCancel: boolean) {
    return <article className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3 border border-zinc-300 bg-white p-3 sm:p-4" key={reminder.id}>
      <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-zinc-600">{reminder.category.replaceAll("_", " ")} · {reminder.audience.replaceAll("_", " ")}</p><h3 className="mt-1 truncate font-bold">{reminder.title}</h3><p className="mt-1 line-clamp-2 text-sm text-zinc-700">{reminder.body}</p>{reminder.suppressionReason ? <p className="mt-2 text-sm font-semibold text-[#075f58]">No email needed: {reminder.suppressionReason}</p> : null}<p className="mt-2 text-xs text-zinc-600">Scheduled {easternDateTime(reminder.scheduledFor)} · {reminder.emailDelivered} delivered · {reminder.emailFailed} failed · {reminder.emailSuppressed} suppressed</p></div>
      <div className="col-span-2"><button className="min-h-11 font-bold underline" type="button" onClick={() => { setPreviewReminderId(reminder.id); window.setTimeout(() => document.getElementById("email-artwork-studio")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0); }}>View email images</button></div>
      <div className="flex w-24 shrink-0 justify-end pt-0.5">{canCancel ? <button className="h-fit border border-red-800 px-3 py-2 text-sm font-bold text-red-800 disabled:opacity-50" disabled={saving} onClick={() => void cancel(reminder.id)} type="button">Cancel</button> : <span className="text-right text-[11px] font-black uppercase tracking-wide text-zinc-500">{reminder.status.replaceAll("_", " ")}</span>}</div>
    </article>;
  }

  return <main className="min-h-screen bg-[#f7f3e8] px-4 py-8 text-zinc-900 sm:px-6 sm:py-10"><div className="mx-auto max-w-4xl">
    <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-zinc-900 pb-6"><div><p className="text-sm font-semibold tracking-[0.2em] text-zinc-600">COMMISSIONER</p><h1 className="mt-2 font-serif text-4xl font-bold">Email center</h1><p className="mt-2 max-w-2xl text-zinc-700">See delivery health first, then test or refine future automatic messages. Previously sent emails remain permanent receipts.</p></div><Link className="font-semibold underline" href="/admin">Back to Commissioner</Link></header>
    <section className="grid gap-3 border-b-2 border-zinc-900 py-6 sm:grid-cols-3"><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">SCHEDULED</p><p className="mt-1 text-3xl font-serif font-bold">{scheduledCount}</p><p className="mt-1 text-sm text-zinc-700">Upcoming player messages</p></div><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">RECENT DELIVERY ISSUES</p><p className="mt-1 text-3xl font-serif font-bold">{attentionCount}</p><p className="mt-1 text-sm text-zinc-700">Failed sends in the past 7 days</p></div><div className="border border-zinc-300 bg-white p-4"><p className="text-xs font-bold tracking-[.12em] text-zinc-600">NOT NEEDED</p><p className="mt-1 text-3xl font-serif font-bold">{suppressedCount}</p><p className="mt-1 text-sm text-zinc-700">Empty reveal windows intentionally suppressed</p></div></section>
    <EmailArtworkStudio key={previewReminderId ?? "templates"} reminderId={previewReminderId} onCloseReceipt={() => setPreviewReminderId(undefined)} onSaved={() => void load()} />
    <section className="border-b-2 border-zinc-900 py-8"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-serif text-2xl font-bold">Send yourself a test</h2><p className="mt-1 text-sm text-zinc-700">Both previews send only to your enabled email address—never the pool.</p></div><div className="flex flex-wrap gap-3"><button className="border border-zinc-900 bg-white px-5 py-3 font-bold text-zinc-900 disabled:opacity-50" disabled={saving} onClick={() => void test()} type="button">Send delivery test</button><button className="bg-zinc-900 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={saving} onClick={() => void test("selections")} type="button">Preview selections email</button></div></div></section>
    {error ? <p className="mt-5 font-semibold text-red-700">{error}</p> : null}{message ? <p className="mt-5 font-semibold text-green-800">{message}</p> : null}
    <section className="grid gap-8 py-8 sm:grid-cols-2 sm:gap-6"><div><div className="flex items-baseline justify-between gap-3 border-b-2 border-zinc-900 pb-2"><h2 className="font-serif text-2xl font-bold">Scheduled emails</h2><span className="text-sm font-bold text-zinc-600">{scheduledReminders.length}</span></div><p className="mt-2 text-sm text-zinc-700">Upcoming messages can be cancelled until delivery begins.</p><div className="commissioner-email-list mt-4 space-y-3">{loading ? <p>Loading…</p> : scheduledReminders.length ? scheduledReminders.map((reminder) => reminderCard(reminder, true)) : <p className="text-sm text-zinc-700">Nothing is scheduled.</p>}</div></div><div><div className="flex items-baseline justify-between gap-3 border-b-2 border-zinc-900 pb-2"><h2 className="font-serif text-2xl font-bold">Sent emails</h2><span className="text-sm font-bold text-zinc-600">{sentReminders.length}</span></div><p className="mt-2 text-sm text-zinc-700">Delivery receipts stay here permanently, including failed and suppressed sends.</p><div className="commissioner-email-list mt-4 space-y-3">{loading ? <p>Loading…</p> : sentReminders.length ? sentReminders.map((reminder) => reminderCard(reminder, false)) : <p className="text-sm text-zinc-700">No sent emails yet.</p>}</div></div></section>
  </div></main>;
}
