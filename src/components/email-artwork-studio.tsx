"use client";

import { useEffect, useRef, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { reminderTemplates } from "@/lib/reminder-templates";
import { emailArtworkOptions, type EmailArtworkOptions } from "@/lib/email-artwork-options";

type Draft = { title: string; body: string; imageOptions: EmailArtworkOptions };
type Preview = { html: string; images: Array<{ kind: string; src: string }>; source: string; warning: string; templateId: string };

export function EmailArtworkStudio({ reminderId, onCloseReceipt, onSaved }: { reminderId?: string; onCloseReceipt: () => void; onSaved: () => void }) {
  const [templateId, setTemplateId] = useState("weekly_recap");
  const initial = reminderTemplates.find((item) => item.id === "weekly_recap")!;
  const [draft, setDraft] = useState<Draft>({ title: initial.title, body: initial.body, imageOptions: { density: "compact" } });
  const [overrides, setOverrides] = useState<Record<string, Draft>>({});
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState(true);
  const [height, setHeight] = useState(700);
  const [dirty, setDirty] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const generation = useRef(0);

  async function render(id: string, values: Draft, receipt?: string) {
    const current = ++generation.current;
    setBusy(true); setError(""); setPreview(null);
    try {
      const response = await fetchWithSession("/api/admin/reminders/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receipt ? { reminderId: receipt } : { templateId: id, title: values.title, message: values.body, imageOptions: values.imageOptions }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Preview could not be loaded.");
      if (current === generation.current) { setPreview(result); setDirty(false); }
    } catch (reason) { if (current === generation.current) setError(reason instanceof Error ? reason.message : "Preview could not be loaded."); }
    finally { if (current === generation.current) setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetchWithSession("/api/admin/reminder-templates");
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Email preferences could not be loaded.");
        const saved = Object.fromEntries((result.templates ?? []).map((item: Draft & { id: string }) => [item.id, { ...item, imageOptions: emailArtworkOptions(item.imageOptions) }]));
        const values = saved.weekly_recap ?? { title: initial.title, body: initial.body, imageOptions: { density: "compact" as const } };
        if (active) { setOverrides(saved); setDraft(values); void render("weekly_recap", values, reminderId); }
      } catch (reason) { if (active) setError(reason instanceof Error ? reason.message : "Email preferences could not be loaded."); }
    }
    void load();
    return () => { active = false; };
  }, [reminderId, initial.title, initial.body]);

  useEffect(() => {
    const document = frame.current?.contentDocument;
    if (!document?.body) return;
    const observer = new ResizeObserver(() => setHeight(document.documentElement.scrollHeight));
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [preview, phone]);

  function choose(id: string) {
    const template = reminderTemplates.find((item) => item.id === id)!;
    const values = overrides[id] ?? { title: template.title, body: template.body, imageOptions: { density: "compact" as const } };
    setTemplateId(id); setDraft(values); setMessage(""); setDirty(false);
    void render(id, values);
  }

  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const response = await fetchWithSession("/api/admin/reminder-templates", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: templateId, title: draft.title, message: draft.body, imageOptions: draft.imageOptions }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Changes could not be saved.");
      setOverrides((current) => ({ ...current, [templateId]: draft }));
      setMessage("Saved for future emails. Already queued wording and sent receipts are unchanged.");
      onSaved();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Changes could not be saved."); }
    finally { setBusy(false); }
  }

  function edit(values: Partial<Draft>) { generation.current++; setDraft((current) => ({ ...current, ...values })); setDirty(true); setMessage(""); }

  return <section id="email-artwork-studio" className="border-b-2 border-zinc-900 py-8">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black tracking-[.14em] text-[#007e72]">REVIEW BEFORE DELIVERY</p><h2 className="mt-1 font-serif text-2xl font-bold">Email image studio</h2><p className="mt-2 max-w-2xl text-sm text-zinc-700">See the actual generated images inside the email. Adjust the wording and spacing, refresh the preview, then save.</p></div>{reminderId ? <button type="button" className="min-h-11 font-bold underline" onClick={onCloseReceipt}>Back to template editor</button> : null}</div>
    {!reminderId ? <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-bold">Email type<select className="mt-2 min-h-11 w-full border border-zinc-400 bg-white p-2" value={templateId} disabled={busy} onChange={(event) => choose(event.target.value)}>{reminderTemplates.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      <label className="text-sm font-bold">Image spacing<select className="mt-2 min-h-11 w-full border border-zinc-400 bg-white p-2" disabled={busy} value={draft.imageOptions.density} onChange={(event) => edit({ imageOptions: emailArtworkOptions({ density: event.target.value }) })}><option value="compact">Compact — tight, readable rows</option><option value="comfortable">Comfortable — more row spacing</option></select></label>
      <label className="text-sm font-bold sm:col-span-2">Subject<input className="mt-2 min-h-11 w-full border border-zinc-400 bg-white p-2 font-normal" maxLength={80} disabled={busy} value={draft.title} onChange={(event) => edit({ title: event.target.value })} /></label>
      <label className="text-sm font-bold sm:col-span-2">Message<textarea className="mt-2 min-h-24 w-full border border-zinc-400 bg-white p-2 font-normal" maxLength={220} disabled={busy} value={draft.body} onChange={(event) => edit({ body: event.target.value })} /></label>
      <p className="text-xs text-zinc-600 sm:col-span-2">Keep week/date placeholders for automatic subjects. Standings and selections come from saved game data; correct results through Grading.</p>
    </div> : null}
    <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={busy} className="min-h-11 border border-zinc-900 bg-white px-4 font-bold disabled:opacity-50" onClick={() => void render(templateId, draft, reminderId)}>{busy ? "Rendering images…" : "Refresh preview"}</button>{!reminderId ? <button type="button" disabled={busy || dirty || !preview} className="min-h-11 bg-[#007e72] px-4 font-bold text-white disabled:opacity-50" onClick={() => void save()}>Save email changes</button> : null}</div>
    {!reminderId ? <button type="button" disabled={busy} className="mt-2 min-h-11 text-sm font-bold underline disabled:opacity-50" onClick={() => { const original = reminderTemplates.find((item) => item.id === templateId)!; edit({ title: original.title, body: original.body, imageOptions: { density: "compact" } }); }}>Use default wording and spacing</button> : null}
    {dirty ? <p className="mt-3 text-sm font-semibold text-amber-800">Changes are not previewed yet. Refresh to review them before saving.</p> : null}
    {message ? <p role="status" className="mt-3 text-sm font-semibold text-green-800">{message}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm font-semibold text-red-800">{error}</p> : null}
    {preview ? <div className="mt-5 border border-zinc-300 bg-[#e9e5dc] p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">{preview.source}</p>{preview.warning ? <p className="mt-1 text-sm text-amber-900">{preview.warning}</p> : null}</div><div className="flex gap-1"><button className={`min-h-11 px-3 text-sm font-bold ${phone ? "bg-zinc-900 text-white" : "bg-white"}`} type="button" aria-pressed={phone} onClick={() => setPhone(true)}>Phone</button><button className={`min-h-11 px-3 text-sm font-bold ${!phone ? "bg-zinc-900 text-white" : "bg-white"}`} type="button" aria-pressed={!phone} onClick={() => setPhone(false)}>Desktop</button></div></div>
      <iframe ref={frame} title="Actual email and image preview" sandbox="allow-same-origin" className="mx-auto block max-w-full border-0 bg-white" style={{ width: phone ? 390 : 648, height }} srcDoc={`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;padding:0}*{box-sizing:border-box}a{pointer-events:none}</style></head><body>${preview.html}</body></html>`} onLoad={() => setHeight(frame.current?.contentDocument?.body.scrollHeight ?? 700)} />
      {preview.images.length ? <div className="mt-3 flex flex-wrap gap-4">{preview.images.map((item) => <a key={item.kind} download={`pickem-${item.kind}.png`} href={item.src} className="min-h-11 py-3 text-sm font-bold underline">Download {item.kind} image</a>)}</div> : <p className="mt-3 text-sm text-zinc-600">This email has no images.</p>}
    </div> : busy ? <p role="status" className="mt-5 text-sm">Generating the email artwork…</p> : null}
  </section>;
}
