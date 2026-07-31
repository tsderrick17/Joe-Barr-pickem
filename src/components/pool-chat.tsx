"use client";

/* Remote animated GIFs are intentionally rendered without Next image optimization. */
/* eslint-disable @next/next/no-img-element */

import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Message = { id: string; body: string; canDelete: boolean; createdAt: string; gifUrl: string | null; playerName: string };

const QUICK_EMOJIS = ["😂", "🔥", "😤", "🏈", "🍻", "👀", "🙌", "🏆"];

function messageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "numeric", timeZone: "America/New_York" }).format(new Date(value));
}

export default function PoolChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [gifUrl, setGifUrl] = useState("");
  const [showGifField, setShowGifField] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetchWithSession("/api/pool-chat");
      const data = await response.json() as { error?: string; messages?: Message[] };
      if (!response.ok) throw new Error(data.error ?? "Pool chat could not be loaded.");
      setMessages(data.messages ?? []);
      setError("");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else if (!quiet) setError(reason instanceof Error ? reason.message : "Pool chat could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMessages(), 0);
    const refresh = window.setInterval(() => void loadMessages(true), 25_000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(refresh); };
  }, [loadMessages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if ((!draft.trim() && !gifUrl.trim()) || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetchWithSession("/api/pool-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft, gifUrl }),
      });
      const data = await response.json() as { error?: string; messages?: Message[] };
      if (!response.ok) throw new Error(data.error ?? "Your message could not be sent.");
      setMessages(data.messages ?? []);
      setDraft("");
      setGifUrl("");
      setShowGifField(false);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your message could not be sent.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(messageId: string) {
    if (deletingId) return;
    setDeletingId(messageId);
    setError("");
    try {
      const response = await fetchWithSession("/api/pool-chat", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId }),
      });
      const data = await response.json() as { error?: string; messages?: Message[] };
      if (!response.ok) throw new Error(data.error ?? "That message could not be removed.");
      setMessages(data.messages ?? []);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "That message could not be removed.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section aria-label="Pool chat" className="pool-chat border-y-2 border-[#1d1d1f] bg-[#fffdf8] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,.7)] sm:px-5">
      <div aria-live="polite" className="max-h-72 space-y-2 overflow-y-auto pr-1">
        {loading ? <p className="py-4 text-sm text-slate-600">Opening pool chat...</p> : null}
        {!loading && !messages.length ? <p className="py-4 text-sm text-slate-600">No messages yet. Set the tone.</p> : null}
        {messages.map((message) => <article className="border-l-2 border-[#d6cdbd] pl-3" key={message.id}>
          <p className="flex flex-wrap items-baseline gap-x-2"><strong className="font-serif text-base">{message.playerName}</strong><time className="text-[10px] font-bold tracking-[.08em] text-slate-500">{messageTime(message.createdAt)} ET</time>{message.canDelete ? <button aria-label={`Delete ${message.playerName}'s message`} className="ml-auto text-[10px] font-bold tracking-[.08em] text-slate-500 underline-offset-2 hover:text-red-700 hover:underline" disabled={deletingId === message.id} onClick={() => void deleteMessage(message.id)} type="button">{deletingId === message.id ? "REMOVING" : "DELETE"}</button> : null}</p>
          {message.body ? <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{message.body}</p> : null}
          {message.gifUrl ? <img alt={`${message.playerName}'s GIF`} className="mt-2 max-h-48 max-w-full rounded-sm border border-[#b7aea0] bg-white object-contain" loading="lazy" src={message.gifUrl} /> : null}
        </article>)}
      </div>

      <form className="mt-4 border-t border-[#b7aea0] pt-3" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="pool-chat-message">Write a message</label>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          {QUICK_EMOJIS.map((emoji) => <button aria-label={`Add ${emoji}`} className="rounded-full border border-[#c8c1b5] bg-white px-1.5 py-0.5 text-sm transition hover:-translate-y-px hover:border-[#2b7773] hover:bg-[#edf7ef]" key={emoji} onClick={() => setDraft((current) => `${current}${emoji}`)} type="button">{emoji}</button>)}
          <button aria-expanded={showGifField} className={`ml-1 rounded-sm border px-2 py-1 text-[10px] font-black tracking-[.12em] transition ${showGifField ? "border-[#2b7773] bg-[#e5f2ef] text-[#145d58]" : "border-[#9b9284] bg-white text-slate-700 hover:border-[#2b7773]"}`} onClick={() => setShowGifField((current) => !current)} type="button">GIF</button>
        </div>
        {showGifField ? <input className="mb-2 w-full border border-[#9b9284] bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-[#00756e] focus:ring-1 focus:ring-[#00756e]" onChange={(event) => setGifUrl(event.target.value)} placeholder="Paste a GIPHY or Tenor GIF link" type="url" value={gifUrl} /> : null}
        <div className="flex gap-2"><input className="min-w-0 flex-1 border border-[#9b9284] bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-[#00756e] focus:ring-1 focus:ring-[#00756e]" id="pool-chat-message" maxLength={280} onChange={(event) => setDraft(event.target.value)} placeholder="Message the pool..." value={draft} /><button className="bg-[#2b7773] px-4 text-sm font-bold text-white transition hover:bg-[#1e625e] disabled:cursor-not-allowed disabled:bg-slate-400" disabled={(!draft.trim() && !gifUrl.trim()) || sending} type="submit">{sending ? "Sending..." : "Send"}</button></div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-500"><span>{error || "Messages refresh automatically."}</span><span>{draft.length}/280</span></div>
      </form>
    </section>
  );
}
