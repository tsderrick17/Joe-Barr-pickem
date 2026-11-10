"use client";

import { useEffect, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { formatAdminNumber } from "@/lib/format-admin-number.js";
import { ladderChartData } from "@/lib/ladder-chart.js";
import { rollingCreditsPerGame15Days, rollingCreditsPerGame30Days, slatesSince } from "@/lib/provider-chart-data.js";
import { FIRST_SCORE_CHECK_DELAY_MINUTES } from "@/lib/score-window.js";
import { shareWithin } from "@/lib/dash-chart.js";
import type { CreditUsage, EfficiencyPoint, EfficiencySummary } from "@/components/commissioner/odds-types";
import { Big, CardHead, Change, DashChart, Meter, Sparkline, Tile, ViewSwitch } from "@/components/commissioner/dash-chart";

type Ladder = Array<{ rung: number; windowMinutes: number; newFinals: number; pickedUp: number; percentage: number; newFinalsPercentage: number }>;
type Dashboard = {
  checkedAt: string;
  creditUsage: CreditUsage;
  ladderCoverage?: { since: string | null; runs: number };
  ladderSummary: Ladder;
  metrics: { efficiency: EfficiencySummary & { history: EfficiencyPoint[] } };
};

const TIER_NAMES = { normal: "Normal", lean: "Lean", minimal: "Minimal", paused: "Paused" } as const;
const one = (value: number | null | undefined) => formatAdminNumber(value, { maximumFractionDigits: 1 });
const whole = (value: number) => formatAdminNumber(value, { maximumFractionDigits: 0 });
const day = (value: string, timeZone = "UTC") => new Date(value).toLocaleString("en-US", { timeZone, month: "short", day: "numeric" });
const slateTime = (value: string) => new Date(value).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
/** An axis top a little above the highest value, in steps of 100. */
const roundTop = (value: number) => Math.max(100, Math.ceil((value * 1.04) / 100) * 100);

/**
 * Odds credits: what the odds and scores feed spends this month against the free 500, what each game costs, and how fast finals arrive.
 * The same figures the old Performance tab showed (read from the grading dashboard), drawn as a finance dashboard: four headline tiles,
 * then one chart per question.
 */
export default function OddsCredits() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");
  const [monthView, setMonthView] = useState<"total" | "daily">("total");
  const [range, setRange] = useState<"all" | "14">("all");

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const response = await fetchWithSession("/api/admin/grading-dashboard");
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "The credit figures could not be loaded.");
        if (live) setData(body as Dashboard);
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else if (live) setError(reason instanceof Error ? reason.message : "The credit figures could not be loaded.");
      }
    })();
    return () => { live = false; };
  }, []);

  if (error) return <p className="dash-error" role="alert">{error}</p>;
  if (!data) return <div aria-label="Loading the credit figures" className="dash-loading" />;

  const usage = data.creditUsage;
  const limit = usage.providerLimit ?? 500;
  const used = usage.usedCredits;
  const todayKey = data.checkedAt.slice(0, 10);
  const days = usage.calendarDays;
  const today = Math.max(0, days.findIndex((entry) => entry.date.slice(0, 10) === todayKey));
  const slower = usage.tierPlan?.lowBalanceAt ?? null;

  // Credits per game, from the 5-minute schedule on.
  const history = slatesSince(data.metrics.efficiency.history, data.metrics.efficiency.averagesSince);
  const rolling15 = history.map((_, index) => rollingCreditsPerGame15Days(history, index));
  const rolling30 = history.map((_, index) => rollingCreditsPerGame30Days(history, index));
  const settled = history.filter((point) => point.creditsPerGame !== null && point.settledGames > 0);
  const settledGames = settled.reduce((total, point) => total + point.settledGames, 0);
  const perGame = settledGames ? settled.reduce((total, point) => total + point.credits, 0) / settledGames : null;
  const latest15 = rolling15.findLast((value) => value !== null) ?? null;
  const latest30 = rolling30.findLast((value) => value !== null) ?? null;
  const first = range === "14" ? Math.max(0, history.length - 14) : 0;
  const shown = history.slice(first);
  const costValues = [...rolling15.slice(first), ...rolling30.slice(first)].filter((value): value is number => value !== null);
  const costLow = costValues.length ? Math.max(0, Math.floor((Math.min(...costValues) - 0.25) * 2) / 2) : 0;
  const costHigh = costValues.length ? Math.ceil((Math.max(...costValues) + 0.25) * 2) / 2 : 4;

  // How fast finals arrive: bars as wide as each polling window.
  const ladder = ladderChartData(data.ladderSummary);
  const bins = ladder.points.map((point: { start: number; end: number }) => ({ start: point.start, end: point.end }));
  const within10 = shareWithin(ladder.points.map((point: { end: number }, index: number) => ({ end: point.end, count: data.ladderSummary[index].newFinals })), 10);
  const histogramTop = Math.max(20, Math.ceil(Math.max(0, ...ladder.points.map((point: { values: { finals: number } }) => point.values.finals)) / 10) * 10 + 10);

  // The free allowance is the top of the chart; it only grows when the month runs past it.
  const totalHigh = Math.max(...days.map((entry) => Math.max(entry.usedCumulative, entry.forecastCumulative ?? 0)));
  const totalTop = totalHigh <= limit ? limit : roundTop(totalHigh);
  const dailyTop = Math.max(10, Math.ceil(Math.max(...days.map((entry) => Math.max(entry.scores + entry.lines, entry.forecastScores + entry.forecastLines))) / 10) * 10);
  const dayTicks = [0, Math.floor((days.length - 1) / 2), days.length - 1].map((index) => ({ index, text: day(days[index].date) }));
  const dayNote = (index: number) => {
    const entry = days[index];
    return index > today ? `Forecast: ${one(entry.forecast)} credits · ${entry.forecastGames} game${entry.forecastGames === 1 ? "" : "s"} scheduled` : index === today ? `Today so far: ${entry.credits} credits` : `${entry.credits} credits spent`;
  };

  return <div className="dash-page">
    <section aria-label="Monthly provider credit usage" className="dash-section">
      <div className="dash-tiles">
        <Tile label="Used this month" sub={`of the free ${whole(limit)} credits`} value={whole(used)}>
          <Meter label={`${whole(used)} of ${whole(limit)} credits used; month-end forecast ${whole(usage.forecastTotal)}`} pace={usage.forecastTotal / limit} share={used / limit} />
        </Tile>
        <Tile label="Month-end forecast" sub={`${Math.round((usage.forecastTotal / limit) * 100)}% of the free ${whole(limit)} · ${one(usage.forecastCredits)} more`} value={whole(usage.forecastTotal)} />
        {usage.tierPlan ? <Tile label="Score checking" sub={usage.tierPlan.message} value={TIER_NAMES[usage.tierPlan.tier]} /> : null}
        <Tile
          label="Credits per game"
          sub={latest15 !== null && latest30 !== null && Math.abs(latest15 - latest30) >= 0.05
            ? <Change good={latest15 < latest30} up={latest15 > latest30}>{one(Math.abs(latest15 - latest30))} {latest15 < latest30 ? "under" : "over"} the 30-day average</Change>
            : `${settledGames} settled games`}
          trend={<Sparkline values={rolling15} />}
          value={one(latest15 ?? perGame)}
        />
      </div>
      <div className="dash-card">
        <CardHead right={<ViewSwitch label="Credits this month" onChange={setMonthView} options={[["total", "Total"], ["daily", "Daily"]]} value={monthView} />} title={`Credits in ${usage.monthLabel}`} />
        {monthView === "total" ? <DashChart
          endLabels
          height={230}
          label={`Credits used in ${usage.monthLabel}, with the forecast to month end`}
          note={dayNote}
          refs={[{ y: limit, label: `Free limit ${whole(limit)}` }, ...(slower ? [{ y: slower, label: `Slower checking from ${whole(slower)}` }] : [])]}
          series={[
            { key: "actual", label: "Actual", tone: "s1", area: true, values: days.map((entry, index) => (index <= today ? entry.usedCumulative : null)) },
            { key: "forecast", label: "Forecast", tone: "s2", dash: true, values: days.map((entry, index) => (index === today ? entry.usedCumulative : index > today ? entry.forecastCumulative : null)) },
          ]}
          today={today}
          x={days.map((entry, index) => `${day(entry.date)}${index === today ? " · today" : index > today ? " · forecast" : ""}`)}
          xTicks={dayTicks}
          yMax={totalTop}
          yTicks={[0, totalTop / 4, totalTop / 2, (totalTop * 3) / 4, totalTop]}
        /> : <DashChart
          height={230}
          kind="columns"
          label={`Credits each day in ${usage.monthLabel}, scores and lines`}
          note={dayNote}
          series={[
            { key: "scores", label: "Score checks", tone: "s1", values: days.map((entry, index) => (index > today ? entry.forecastScores : entry.scores)) },
            { key: "lines", label: "Line checks", tone: "s2", values: days.map((entry, index) => (index > today ? entry.forecastLines : entry.lines)) },
          ]}
          today={today}
          x={days.map((entry, index) => `${day(entry.date)}${index === today ? " · today" : index > today ? " · forecast" : ""}`)}
          xTicks={dayTicks}
          yMax={dailyTop}
          yTicks={[0, dailyTop / 4, dailyTop / 2, (dailyTop * 3) / 4, dailyTop]}
        />}
      </div>
    </section>

    <section aria-label="Provider cost: credits per game, 15- and 30-day averages" className="dash-card">
      <CardHead
        line={data.metrics.efficiency.averagesSince ? `Since ${day(data.metrics.efficiency.averagesSince, "America/New_York")}, when checks moved to every 5 minutes` : undefined}
        right={<ViewSwitch label="Which slates" onChange={setRange} options={[["all", "Season"], ["14", "Last 14"]]} value={range} />}
        title="Credits per game"
      />
      {shown.length ? <DashChart
        endLabels
        format={(value) => value.toFixed(1)}
        label="Credits per game: 15-day and 30-day moving averages"
        note={(index) => {
          const point = shown[index];
          return point.attribution === "unavailable" ? "Overlaps another slate; left out of the averages"
            : point.attribution === "no-data" ? "No polling receipt; left out of the averages"
            : point.settledGames === 0 ? "Not fully settled yet"
            : `${point.settledGames} games · ${point.calls} score checks`;
        }}
        series={[
          { key: "average15", label: "15-day average", tone: "s1", values: rolling15.slice(first) },
          { key: "average30", label: "30-day average", tone: "s2", dash: true, values: rolling30.slice(first) },
        ]}
        x={shown.map((point) => slateTime(point.slateStartedAt))}
        xTicks={[0, Math.floor((shown.length - 1) / 2), shown.length - 1].filter((index, order, all) => all.indexOf(index) === order).map((index) => ({ index, text: day(shown[index].slateStartedAt, "America/New_York") }))}
        yMax={costHigh}
        yMin={costLow}
        yTicks={[costLow, costLow + (costHigh - costLow) / 4, costLow + (costHigh - costLow) / 2, costLow + ((costHigh - costLow) * 3) / 4, costHigh]}
      /> : <p className="dash-empty">No game has settled on the 5-minute schedule yet. The chart fills in as games finish.</p>}
    </section>

    <section aria-label="Fresh finals picked up by polling ladder" className="dash-card">
      <CardHead
        line={`Minutes after the first score check, ${FIRST_SCORE_CHECK_DELAY_MINUTES} minutes after kickoff. Each bar is as wide as its window.`}
        right={within10 !== null ? <Big sub="within 10 minutes" value={`${within10}%`} /> : undefined}
        title="How fast finals arrive"
      />
      {ladder.points.length ? <>
        <DashChart
          bins={bins}
          capLabels
          format={(value) => `${Math.round(value)}%`}
          height={210}
          kind="histogram"
          label="Share of new finals found in each polling window"
          note={(index) => ladder.points[index].note}
          series={[{ key: "finals", label: "Share of finals", tone: "s1", values: ladder.points.map((point: { values: { finals: number } }) => point.values.finals) }]}
          x={ladder.points.map((point: { start: number; end: number }) => `${point.start} to ${point.end} minutes`)}
          xTicks={ladder.ticks.map((minutes: number) => ({ index: minutes, text: `+${minutes}` }))}
          yMax={histogramTop}
          yTicks={[0, histogramTop / 2, histogramTop]}
        />
        {ladder.laterFinals || ladder.laterMinutes.length ? <p className="dash-foot">Later windows, not drawn: {ladder.laterFinals} final{ladder.laterFinals === 1 ? "" : "s"}.</p> : null}
      </> : <p className="dash-empty">Fills in as score checks record their window.</p>}
    </section>
  </div>;
}
