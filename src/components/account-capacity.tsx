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

type StorageTableUsage = {
  relation_name: string;
  total_bytes: number;
  table_bytes: number;
  index_bytes: number;
  estimated_rows: number;
};

const serviceAccess: Record<string, { href: string; purpose: string; signIn: string }> = {
  "odds-api": { href: "https://the-odds-api.com/", purpose: "NFL odds source", signIn: "Start with Google" },
  brevo: { href: "https://app.brevo.com/", purpose: "Reminder email delivery", signIn: "Start with Google" },
  supabase: { href: "https://supabase.com/dashboard/project/qtuycmgjiizrahfchsxe", purpose: "Database, sign-in, and scheduled automation", signIn: "Start with GitHub" },
  vercel: { href: "https://vercel.com/tsderrick/pickem", purpose: "Live site and deployments", signIn: "Start with GitHub" },
  github: { href: "https://github.com/tsderrick17/Joe-Barr-pickem/actions", purpose: "Migration deployment history", signIn: "Start with GitHub" },
  sentry: { href: "https://sentry.io/", purpose: "Application error reports", signIn: "Start with GitHub" },
  uptimerobot: { href: "https://dashboard.uptimerobot.com/", purpose: "External health alerts", signIn: "Start with Google" },
};

function label(value: number | null) {
  if (value === null) return "—";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function megabytes(value: number) {
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
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
  const [storageTables, setStorageTables] = useState<StorageTableUsage[]>([]);
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
      setStorageTables(data.storageTables ?? []);
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

  return <section className="border-b-2 border-zinc-900 py-7">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-black tracking-[.16em] text-zinc-600">CONNECTED SYSTEMS</p><h3 className="mt-1 font-serif text-2xl font-bold">Keep every account inside its free lane</h3><p className="mt-1 max-w-2xl text-sm text-zinc-700">Open a service from its card when you need its own dashboard. Live dials use existing pool records and never make an extra Odds API request.</p></div>
      <button className="border border-zinc-900 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={() => void load()} type="button">{loading ? "Checking..." : "Refresh gauges"}</button>
    </div>
    {error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}
    {accounts ? <><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{accounts.map((account) => {
      const access = serviceAccess[account.id];
      return <article className={`border p-4 ${account.connection === "awaiting_connection" ? "border-dashed border-zinc-400 bg-stone-50" : "border-zinc-300 bg-white"}`} key={account.id}>
        <a className="font-bold underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-900" href={access?.href} rel="noreferrer" target="_blank">{account.service} ↗</a>
        {access ? <><p className="mt-1 text-sm text-zinc-700">{access.purpose}</p><p className="mt-2 text-[11px] font-black tracking-[.1em] text-[#007e72]">{access.signIn.toUpperCase()}</p></> : null}
        <div className="mt-4"><CapacityDial account={account} /></div>
        <p className="mt-3 border-t border-zinc-200 pt-3 text-xs leading-5 text-zinc-600">{account.detail}</p>
      </article>;
    })}</div>{storageTables.length ? <details className="mt-5 border border-zinc-300 bg-white p-4"><summary className="cursor-pointer font-bold">See what uses database space</summary><p className="mt-1 text-sm text-zinc-700">This is a commissioner-only, read-only table breakdown. Pool history is not removed by the weekly cleanup.</p><div className="mt-3 overflow-x-auto"><table className="w-full min-w-[36rem] text-left text-sm"><thead className="border-b border-zinc-300 text-xs uppercase tracking-wide text-zinc-600"><tr><th className="pb-2 pr-3">Table</th><th className="pb-2 pr-3">Total</th><th className="pb-2 pr-3">Data</th><th className="pb-2 pr-3">Indexes</th><th className="pb-2">Rows</th></tr></thead><tbody>{storageTables.map((table) => <tr className="border-b border-zinc-100" key={table.relation_name}><td className="py-2 pr-3 font-mono text-xs">{table.relation_name}</td><td className="py-2 pr-3 tabular-nums">{megabytes(table.total_bytes)}</td><td className="py-2 pr-3 tabular-nums">{megabytes(table.table_bytes)}</td><td className="py-2 pr-3 tabular-nums">{megabytes(table.index_bytes)}</td><td className="py-2 tabular-nums">{table.estimated_rows.toLocaleString()}</td></tr>)}</tbody></table></div></details> : null}<p className="mt-4 text-xs text-zinc-500">{checkedAt ? `Last checked ${new Date(checkedAt).toLocaleString()}.` : null} A dial is never shown as zero when its service is not connected.</p></> : null}
  </section>;
}
