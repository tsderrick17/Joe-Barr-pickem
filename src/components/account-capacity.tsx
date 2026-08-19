"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

type AccountCapacity = {
  id: string;
  service: string;
  metric: string;
  used: number | null;
  limit: number | null;
  unit: string;
  period: string;
  observedAt: string | null;
  detail: string;
  connection: "live" | "awaiting_connection" | "not_reported";
};

function label(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function dialColor(ratio: number) {
  if (ratio >= 0.9) return "#b91c1c";
  if (ratio >= 0.7) return "#a16207";
  return "#007e72";
}

function CapacityDial({ account }: { account: AccountCapacity }) {
  const ratio = account.used !== null && account.limit !== null && account.limit > 0
    ? Math.min(1, account.used / account.limit)
    : null;
  const color = ratio === null ? "#a8a29e" : dialColor(ratio);
  const dialStyle = ratio === null
    ? { background: "conic-gradient(#d6d3d1 0deg 360deg)" }
    : { background: `conic-gradient(${color} 0deg ${Math.max(4, ratio * 360)}deg, #e7e5e4 ${Math.max(4, ratio * 360)}deg 360deg)` };

  return <div className="flex items-center gap-4">
    <div aria-label={ratio === null ? "Usage awaiting connection" : `${label(account.used)} of ${label(account.limit)} ${account.unit} used`} className="relative grid size-20 shrink-0 place-items-center rounded-full" role="img" style={dialStyle}>
      <div className="grid size-[4.1rem] place-items-center rounded-full bg-white text-center">
        <span className="font-serif text-lg font-bold leading-none">{ratio === null ? "—" : `${Math.round(ratio * 100)}%`}</span>
      </div>
    </div>
    <div className="min-w-0">
      <p className="text-[11px] font-black tracking-[.12em] text-zinc-600">{account.metric.toUpperCase()}</p>
      {account.used !== null && account.limit !== null ? <p className="mt-1 text-lg font-bold tabular-nums">{label(account.used)} <span className="text-zinc-500">/ {label(account.limit)}</span> {account.unit}</p> : <p className="mt-1 font-bold text-zinc-700">Awaiting connection</p>}
      <p className="mt-1 text-xs text-zinc-600">{account.period}</p>
    </div>
  </div>;
}

export default function AccountCapacityPanel() {
  const [accounts, setAccounts] = useState<AccountCapacity[] | null>(null);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithSession("/api/admin/account-capacity");
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Account capacity could not be loaded.");
      setAccounts(data.accounts ?? []);
      setCheckedAt(data.checkedAt ?? null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Account capacity could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => { void load(); });
  }, []);

  return <section className="mt-5 border-y-2 border-zinc-900 py-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-black tracking-[.16em] text-zinc-600">FREE-PLAN CAPACITY</p><h3 className="mt-1 font-serif text-2xl font-bold">Keep every account inside its free lane</h3><p className="mt-1 max-w-2xl text-sm text-zinc-700">Live dials use existing pool records and never make an extra Odds API request. Unconnected services stay clearly marked until a read-only usage key is added.</p></div>
      <button className="border border-zinc-900 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={() => void load()} type="button">{loading ? "Checking..." : "Refresh gauges"}</button>
    </div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {accounts ? <><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => <article className={`border p-4 ${account.connection === "awaiting_connection" ? "border-dashed border-zinc-400 bg-stone-50" : "border-zinc-300 bg-white"}`} key={account.id}><p className="font-bold">{account.service}</p><div className="mt-3"><CapacityDial account={account} /></div><p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-600">{account.detail}</p></article>)}</div><p className="mt-4 text-xs text-zinc-500">{checkedAt ? `Last checked ${new Date(checkedAt).toLocaleString()}.` : null} A dial is never shown as zero when its service is not connected.</p></> : null}
  </section>;
}
