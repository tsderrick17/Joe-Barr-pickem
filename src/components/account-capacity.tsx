"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import Link from "next/link";
import { formatAdminNumber } from "@/lib/format-admin-number.js";
import { Big, CardHead, Meter } from "@/components/commissioner/dash-chart";

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
  connection: "live" | "estimated" | "awaiting_connection" | "not_reported";
  efficiency?: {
    windowDays: number;
    providerCalls: number;
    totalCredits: number;
    scoreCalls: number;
    scoreCredits: number;
    finalizedGames: number;
    productiveScoreCalls: number;
    productiveRate: number | null;
    creditsPerFinal: number | null;
    currentSevenDayCreditsPerFinal: number | null;
    previousSevenDayCreditsPerFinal: number | null;
    trend: "improving" | "worsening" | "steady" | "insufficient";
  };
  calendarMonth?: {
    monthLabel: string;
    daysInMonth: number;
    daysElapsed: number;
    sundaysInMonth: number;
    providerCalls: number;
    creditsTracked: number;
    scoreCredits: number;
    lineLockCredits: number;
    oddsCredits: number;
    forecastCredits: number;
    forecastTotal: number;
    providerUsed: number | null;
    providerRemaining: number | null;
    providerLimit: number | null;
    reportedAt: string | null;
  };
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
  "vercel-cpu": { href: "https://vercel.com/tsderrick/~/usage", purpose: "Live site and deployments", signIn: "Start with GitHub" },
  "vercel-storage": { href: "https://vercel.com/tsderrick/~/usage", purpose: "Live site and deployments", signIn: "Start with GitHub" },
  sentry: { href: "https://sentry.io/", purpose: "Application error reports", signIn: "Start with GitHub" },
  uptimerobot: { href: "https://dashboard.uptimerobot.com/", purpose: "External health alerts", signIn: "Start with Google" },
};

function label(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(1);
}

function megabytes(value: number) {
  return `${(value / (1024 * 1024)).toFixed(value >= 10 * 1024 * 1024 ? 1 : 2)} MB`;
}

/** The meter's colour: green, amber from 70% used, red from 90%. Always with the percentage beside it. */
const tone = (ratio: number) => (ratio >= 0.9 ? "bad" : ratio >= 0.7 ? "warn" : "s1");

/** One account: its name (opens its own dashboard), how much of the free allowance is used, a meter with the month-end pace, and when it resets. */
function AccountRow({ account }: { account: AccountCapacity }) {
  const access = serviceAccess[account.id];
  const ratio = account.used !== null && account.limit !== null && account.limit > 0 ? Math.min(1, account.used / account.limit) : null;
  const pace = account.calendarMonth && account.calendarMonth.providerLimit ? account.calendarMonth.forecastTotal / account.calendarMonth.providerLimit : null;
  const reading = account.used === null
    ? (account.connection === "awaiting_connection" ? "Setup needed" : "No reading yet")
    : `${label(account.used)}${account.limit !== null ? ` of ${label(account.limit)}` : ""} ${account.unit}`;
  return <div className="dash-limit">
    {access ? <a href={access.href} rel="noreferrer" target="_blank">{account.service} <span aria-hidden="true">↗</span></a> : <b>{account.service}</b>}
    <span className="dash-pc">{ratio !== null ? `${Math.round(ratio * 100)}%` : account.used !== null ? label(account.used) : "—"}</span>
    <Meter label={ratio !== null ? `${reading} used${pace !== null ? `; month-end forecast ${Math.round(pace * 100)}%` : ""}` : reading} pace={pace} share={ratio ?? 0} tone={ratio === null ? "s1" : tone(ratio)} />
    <small>{account.metric} · {reading}</small>
    <small>{account.period}</small>
    {account.used === null ? <small className="dash-limit-note">{account.detail}{access ? ` Sign in: ${access.signIn}.` : ""}</small> : null}
  </div>;
}

/**
 * Free limits: every account the site runs on, one row each, against its free allowance; then what uses the database space, as one split bar and
 * the largest tables. Live readings use existing pool records and never make an extra Odds API request.
 */
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

  const tables = [...storageTables].sort((a, b) => b.total_bytes - a.total_bytes);
  const totalBytes = tables.reduce((sum, table) => sum + table.total_bytes, 0);
  const rest = tables.slice(5).reduce((sum, table) => sum + table.total_bytes, 0);
  const parts = [
    ...tables.slice(0, 5).map((table) => ({ name: table.relation_name, bytes: table.total_bytes, rows: table.estimated_rows as number | null })),
    ...(rest ? [{ name: "Everything else", bytes: rest, rows: null }] : []),
  ];
  const shade = (index: number) => Math.max(0.22, 1 - index * 0.17);

  return <div className="dash-page">
    {error ? <p className="dash-error" role="alert">{error}</p> : null}
    {!accounts && !error ? <div aria-label="Reading the accounts" className="dash-loading" /> : null}
    {accounts ? <>
      <section aria-label="Free allowances" className="dash-card">
        <CardHead
          line="How much of each free allowance is used. The tick marks the month-end pace."
          right={<button className="dash-refresh" disabled={loading} onClick={() => void load()} type="button">{loading ? "Checking…" : "Refresh"}</button>}
          title="Free allowances"
        />
        {accounts.map((account) => <AccountRow account={account} key={account.id} />)}
        <p className="dash-foot">
          {checkedAt ? `Checked ${new Date(checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} ET. ` : null}
          A plan limit that is not known shows a live count instead of a made-up percentage. <Link href="/admin/odds">Odds credits</Link> has the month in detail.
        </p>
      </section>
      {parts.length ? <section aria-label="What uses database space" className="dash-card">
        <CardHead right={<Big sub="in the tables below" value={megabytes(totalBytes)} />} title="Database space" />
        <div aria-hidden="true" className="dash-split">{parts.map((part, index) => <u key={part.name} style={{ opacity: shade(index), width: `${(part.bytes / (totalBytes || 1)) * 100}%` }} />)}</div>
        <table className="dash-table">
          <thead><tr><th scope="col">Table</th><th className="is-num" scope="col">Size</th><th className="is-num" scope="col">Share</th><th className="is-num" scope="col">Rows</th></tr></thead>
          <tbody>{parts.map((part, index) => <tr key={part.name}>
            <th scope="row"><span aria-hidden="true" className="dash-swatch" style={{ opacity: shade(index) }} />{part.name}</th>
            <td className="is-num">{megabytes(part.bytes)}</td>
            <td className="is-num">{Math.round((part.bytes / (totalBytes || 1)) * 100)}%</td>
            <td className="is-num">{part.rows === null ? "—" : formatAdminNumber(part.rows)}</td>
          </tr>)}</tbody>
        </table>
        <p className="dash-foot">Read-only. Pool history is never removed by the weekly clean-up.</p>
      </section> : null}
    </> : null}
  </div>;
}
