"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Message = {
  id: string;
  body: string;
  createdAt: string;
  playerName: string;
};

function messageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    month: "numeric",
    day: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export default function PoolChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadMessages = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const response = await fetchWithSession("/api/pool-chat");
      const data = await response.json() as { error?: string; messages?: Message[] };
      if (!response.ok) throw new Error(data.error ?? "The Rail could not be loaded.");
      setMessages(data.messages ?? []);
      setError("");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else if (!quiet) setError(reason instanceof Error ? reason.message : "The Rail could not be loaded.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadMessages(), 0);
    const refresh = window.setInterval(() => void loadMessages(true), 25_000);
    return () => {
      window.clearTimeout(initialLoad);
      window.clearInterval(refresh);
    };
  }, [loadMessages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetchWithSession("/api/pool-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: draft }),
      });
      const data = await response.json() as { error?: string; messages?: Message[] };
      if (!response.ok) throw new Error(data.error ?? "Your note could not be sent.");
      setMessages(data.messages ?? []);
      setDraft("");
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "Your note could not be sent.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section aria-labelledby="pool-chat-title" className="pool-chat border-y-2 border-[#1d1d1f] bg-[#fffdf8] px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,.7)] sm:px-5">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-[#b7aea0] pb-3">
        <div>
          <p className="text-[10px] font-black tracking-[.18em] text-[#00756e]">POOL CHAT</p>
          <h2 className="mt-0.5 font-serif text-2xl font-black" id="pool-chat-title">Live across the pool</h2>
        </div>
        <p className="max-w-xs text-right text-xs leading-4 text-slate-600">One shared conversation, wherever you are. Keep it friendly.</p>
      </div>

      <div aria-live="polite" className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {loading ? <p className="py-4 text-sm text-slate-600">Opening The Rail…</p> : null}
        {!loading && !messages.length ? <p className="py-4 text-sm text-slate-600">No notes yet. Set the tone.</p> : null}
        {messages.map((message) => <article className="border-l-2 border-[#d6cdbd] pl-3" key={message.id}>
          <p className="flex flex-wrap items-baseline gap-x-2"><strong className="font-serif text-base">{message.playerName}</strong><time className="text-[10px] font-bold tracking-[.08em] text-slate-500">{messageTime(message.createdAt)} ET</time></p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{message.body}</p>
        </article>)}
      </div>

      <form className="mt-4 border-t border-[#b7aea0] pt-3" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="pool-chat-message">Write a note</label>
        <div className="flex gap-2"><input className="min-w-0 flex-1 border border-[#9b9284] bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-[#00756e] focus:ring-1 focus:ring-[#00756e]" id="pool-chat-message" maxLength={280} onChange={(event) => setDraft(event.target.value)} placeholder="Add a note to the Rail…" value={draft} /><button className="bg-[#2b7773] px-4 text-sm font-bold text-white transition hover:bg-[#1e625e] disabled:cursor-not-allowed disabled:bg-slate-400" disabled={!draft.trim() || sending} type="submit">{sending ? "Sending…" : "Send"}</button></div>
        <div className="mt-2 flex justify-between gap-3 text-[11px] text-slate-500"><span>{error || "Messages refresh automatically."}</span><span>{draft.length}/280</span></div>
      </form>
    </section>
  );
}
