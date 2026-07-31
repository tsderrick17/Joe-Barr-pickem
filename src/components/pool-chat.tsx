"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type Message = {
  id: string;
  body: string;
  canDelete: boolean;
  createdAt: string;
  isDeleted: boolean;
  playerName: string;
};

const EMOJI_GROUPS = [
  { label: "Reactions and faces", emojis: ["😀", "😂", "🤣", "😮", "😤", "😮‍💨", "🤯", "😳", "🤔", "😏", "😎", "🤡", "😭", "😈"] },
  { label: "Hands, arms, and eyes", emojis: ["👀", "👍", "👎", "👏", "🙌", "🙏", "✊", "🤞", "👌", "💪", "👆", "👇", "👉", "👈", "🤝"] },
  { label: "Game day", emojis: ["🏈", "🏆", "🎯", "🚨", "🔥", "💰", "💸", "🍀", "👑", "🐐", "💎", "📈", "📉", "🎉", "🧱"] },
  { label: "Quick marks", emojis: ["✅", "❌", "⚡", "💯", "📝", "🧾", "⏰", "🎲", "🃏", "🎰", "📣", "💥", "⭐", "🔔", "📌"] },
];

function messageTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }).format(new Date(value));
}

function messageDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", hour: "numeric", minute: "2-digit", month: "short", timeZone: "America/New_York" }).format(new Date(value));
}

export default function PoolChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
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
      if (!response.ok) throw new Error(data.error ?? "Your message could not be sent.");
      setMessages(data.messages ?? []);
      setDraft("");
      setShowEmojiPicker(false);
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
    <section aria-label="Pool chat" className="pool-chat border-y-2 border-[#1d1d1f] bg-[#fffdf8] px-4 py-3 sm:px-5">
      <div aria-live="polite" className="max-h-60 overflow-y-auto">
        {loading ? <p className="py-3 text-sm text-slate-600">Opening chat...</p> : null}
        {!loading && !messages.length ? <p className="py-3 text-sm text-slate-600">No messages yet.</p> : null}
        {messages.map((message) => <article className={`pool-chat-message ${message.isDeleted ? "is-deleted" : ""}`} key={message.id}>
          <p className="min-w-0 whitespace-pre-wrap break-words text-sm leading-5 text-slate-700">{message.isDeleted ? "Message removed." : message.body}</p>
          <div className="pool-chat-message-meta"><strong className="font-serif">{message.playerName}</strong><time title={`${messageDateTime(message.createdAt)} ET`}>{messageTime(message.createdAt)} ET</time>{message.canDelete ? <button aria-label={`Delete ${message.playerName}'s message`} disabled={deletingId === message.id} onClick={() => void deleteMessage(message.id)} type="button">{deletingId === message.id ? "REMOVING" : "DELETE"}</button> : null}</div>
        </article>)}
      </div>

      <form className="mt-3 border-t border-[#b7aea0] pt-2" onSubmit={sendMessage}>
        <label className="sr-only" htmlFor="pool-chat-message">Write a message</label>
        <div className="mb-2 flex items-center gap-2">
          <button aria-expanded={showEmojiPicker} className={`rounded-full border px-2 py-1 text-sm transition ${showEmojiPicker ? "border-[#2b7773] bg-[#e5f2ef]" : "border-[#9b9284] bg-white hover:border-[#2b7773]"}`} onClick={() => setShowEmojiPicker((current) => !current)} type="button">🙂 <span className="sr-only">Choose an emoji</span></button>
        </div>
        {showEmojiPicker ? <div aria-label="Emoji picker" className="mb-3 space-y-1.5 border-y border-[#d6cdbd] py-2.5">{EMOJI_GROUPS.map((group) => <div aria-label={group.label} className="flex flex-wrap gap-1" key={group.label} role="group">{group.emojis.map((emoji) => <button aria-label={`Add ${emoji}`} className="rounded border border-transparent px-1 text-base transition hover:-translate-y-px hover:border-[#2b7773] hover:bg-[#edf7ef]" key={emoji} onClick={() => setDraft((current) => `${current}${emoji}`)} title={emoji} type="button">{emoji}</button>)}</div>)}</div> : null}
        <div className="flex gap-2"><input className="min-w-0 flex-1 border border-[#9b9284] bg-white px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-[#00756e] focus:ring-1 focus:ring-[#00756e]" id="pool-chat-message" maxLength={280} onChange={(event) => setDraft(event.target.value)} placeholder="Message the pool..." value={draft} /><button className="bg-[#2b7773] px-4 text-sm font-bold text-white transition hover:bg-[#1e625e] disabled:cursor-not-allowed disabled:bg-slate-400" disabled={!draft.trim() || sending} type="submit">{sending ? "Sending..." : "Send"}</button></div>
        <div className="mt-1 flex justify-between gap-3 text-[10px] text-slate-500"><span>{error}</span><span>{draft.length}/280</span></div>
      </form>
    </section>
  );
}
