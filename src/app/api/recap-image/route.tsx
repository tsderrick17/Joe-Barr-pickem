/* ImageResponse/Satori requires a raw <img> for embedded team logos; next/image
   cannot be used inside this server-generated image tree. */
/* eslint-disable @next/next/no-img-element */
import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { onlyPublicPickRows } from "@/lib/pool-action-visibility";
import { slateImagePresentation } from "@/lib/slate-image-order";
import type { EarlyLockSnapshot, FeaturedWindowRevealSnapshot, FreshSlateSnapshot, GameDaySlateSnapshot, PlayoffDayRecapSnapshot, PlayoffPublicRevealSnapshot, SundayRevealSnapshot, WeeklyRecapSnapshot } from "@/lib/weekly-recap";
import type { BowlDailyRecapSnapshot, BowlLineLockSnapshot } from "@/lib/bowl-pool-recap";
import { bowlRecapLayout } from "@/lib/bowl-recap-layout.js";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const INK = "#171719";
const PAPER = "#fffdf8";
const PARCHMENT = "#f0e5cf";
const RULE_BLUE = "#9cc6ea";
const MARGIN_RED = "#d56b66";
const TEAL = "#008c82";
const MUTED = "#596579";
const SITE_URL = "https://pickemjb.vercel.app";
const IMAGE_CACHE_CONTROL = "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";
// Email clients scale images to the width of the message column. Rendering the
// Slate on a slightly tighter canvas makes its type and rules materially more
// legible on phones without making the email itself any wider.
const SLATE_IMAGE_WIDTH = 920;
// Recap and public-receipt images use a tighter canvas than the full Slate.
// Email clients scale artwork to their fixed message column, so a wide canvas
// makes the actual Pick'em data needlessly small on phones.
const PUBLIC_RECEIPT_IMAGE_WIDTH = 760;
const RECAP_IMAGE_WIDTH = 760;

type SlateGame = { away: string; home: string; day?: string; time: string; favorite: "away" | "home" | null; spread: number | null };
type PublicRow = { name: string; wins: number; picks: string[] };

function safePublicRows(value: unknown): PublicRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object")).map((row) => ({
    name: String(row.name ?? ""),
    wins: Number.isFinite(Number(row.wins)) ? Number(row.wins) : 0,
    picks: Array.isArray(row.picks) ? row.picks.map((pick) => typeof pick === "string" ? pick : String(pick ?? "")) : [],
  }));
}

function SlateImage({
  games,
  title,
  subtitle,
  footer,
  official,
  compact = false,
}: {
  games: SlateGame[];
  title: string;
  subtitle: string;
  footer: string;
  official: boolean;
  compact?: boolean;
}) {
  return (
    <div style={{ background: PAPER, color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "42px 50px", width: "100%" }}>
      <div style={{ alignItems: "baseline", borderBottom: `5px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 16 }}>
        <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 48, fontWeight: 800 }}>The Slate</span>
        <span style={{ color: official ? TEAL : MUTED, display: "flex", fontFamily: "Arial", fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>{official ? "OFFICIAL LINES" : "PRELIMINARY LINES"}</span>
      </div>
      <div style={{ borderBottom: "1px solid #c8c1b5", display: "flex", fontFamily: "Arial", fontSize: 18, fontWeight: 800, letterSpacing: 2, padding: "14px 2px" }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {games.map((game, index) => {
          const presentation = slateImagePresentation(game);
          const singleGame = games.length <= 2;
          return <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: index % 2 ? PAPER : PARCHMENT, borderBottom: "1px solid #d4cab7", borderTop: index === 0 ? `3px solid ${official ? TEAL : INK}` : "0 solid transparent", display: "flex", fontFamily: "Arial", fontSize: compact ? 28 : singleGame ? 30 : 22, minHeight: compact ? 96 : singleGame ? 88 : 64, padding: singleGame ? "0 6px" : "0 8px" }}>
            <span style={{ color: MUTED, display: "flex", flexDirection: "column", fontSize: compact ? 17 : singleGame ? 16 : 14, fontWeight: 800, lineHeight: 1.25, width: singleGame ? 120 : 108 }}>
              {game.day ? <span style={{ display: "flex", fontSize: 12 }}>{game.day}</span> : null}
              <span style={{ display: "flex", marginTop: game.day ? 3 : 0 }}>{game.time}</span>
            </span>
            <span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: singleGame ? "center" : "flex-start", paddingLeft: singleGame ? 0 : 10, paddingRight: singleGame ? 4 : 10, textAlign: singleGame ? "center" : "left" }}>{presentation.leftTeam}</span>
            <span style={{ color: official ? TEAL : INK, display: "flex", fontFamily: "monospace", fontSize: compact ? 28 : singleGame ? 27 : 21, fontWeight: 900, justifyContent: "center", width: singleGame ? 130 : 100 }}>{presentation.line}</span>
            <span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: singleGame ? "center" : "flex-start", paddingLeft: singleGame ? 4 : 10, textAlign: singleGame ? "center" : "left" }}>{presentation.rightTeam}</span>
          </div>;
        })}
      </div>
      <div style={{ borderTop: `3px solid ${INK}`, color: official ? TEAL : MUTED, display: "flex", fontFamily: "Arial", fontSize: compact ? 17 : 16, fontWeight: 800, marginTop: compact ? 24 : 18, paddingTop: 14 }}>{footer}</div>
      <div style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, marginTop: 7 }}>Favorites left; home team ALL CAPS. Changes allowed until kickoff time.</div>
      <span style={{ display: "none" }}>{subtitle}</span>
    </div>
  );
}

function PadRows({ rows, compact = false, grow = false }: { rows: PublicRow[]; compact?: boolean; grow?: boolean }) {
  return (
    <div style={{ display: "flex", flex: grow ? 1 : undefined, flexDirection: "column", marginTop: 8 }}>
      {rows.map((row) => (
        <div key={row.name} style={{ alignItems: "center", background: PAPER, borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Georgia", fontSize: compact ? 18 : 21, minHeight: compact ? 40 : 48 }}>
          <span style={{ borderRight: `3px solid ${MARGIN_RED}`, color: INK, display: "flex", fontFamily: "Arial", fontSize: compact ? 17 : 19, fontWeight: 800, justifyContent: "flex-end", paddingRight: 10, width: 64 }}>{row.wins}</span>
          <span style={{ display: "flex", fontWeight: 700, paddingLeft: 14, width: compact ? 145 : 170 }}>{row.name}</span>
          <span style={{ color: "#263d5b", display: "flex", flex: 1, flexWrap: "wrap", fontFamily: "Arial", fontSize: compact ? 15 : 17, fontWeight: 700, gap: 16 }}>
            {Array.isArray(row.picks) && row.picks.length ? row.picks.map((rawPick, index) => {
              // Recap snapshots are persisted JSON and may contain legacy null
              // or non-string values. Normalize before applying result markup so
              // one malformed pick cannot make the entire OG image return 500.
              const pick = typeof rawPick === "string" ? rawPick : String(rawPick ?? "");
              const resultMatch = pick.match(/^(.*?)(\s+[WL])$/);
              return <span key={`${pick}-${index}`} style={{ display: "flex", whiteSpace: "nowrap" }}>{resultMatch ? <><span>{resultMatch[1]}</span><span style={{ marginLeft: 4 }}>{resultMatch[2]}</span></> : pick}{index < row.picks.length - 1 ? <span style={{ marginLeft: 16 }}>·</span> : null}</span>;
            }) : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

function SummaryRows({ rows }: { rows: PublicRow[] }) {
  return <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
    {rows.map((row) => <div key={row.name} style={{ alignItems: "center", background: PAPER, borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Arial", fontSize: 17, minHeight: 40 }}>
      <span style={{ borderRight: `3px solid ${MARGIN_RED}`, color: INK, display: "flex", fontWeight: 800, justifyContent: "flex-end", paddingRight: 10, width: 64 }}>{row.wins}</span>
      <span style={{ display: "flex", fontFamily: "Georgia", fontWeight: 700, paddingLeft: 14, width: 170 }}>{row.name}</span>
      <span style={{ color: "#263d5b", display: "flex", flex: 1, fontWeight: 700, paddingLeft: 14 }}>{row.picks.length ? row.picks.join("  ·  ") : "—"}</span>
    </div>)}
  </div>;
}

function PublicPickemImage({ kicker, title, rows, note }: { kicker: string; title: string; rows: PublicRow[]; note: string }) {
  const compact = rows.length > 10;
  const columns = rows.length > 16
    ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))]
    : [rows];
  return (
    <div style={{ background: "#fffaf0", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "28px 34px", width: "100%" }}>
      <div style={{ alignItems: "flex-start", borderBottom: `2px solid ${INK}`, display: "flex", flexDirection: "column", gap: 5, paddingBottom: 12 }}>
        <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 46, fontWeight: 800, lineHeight: 1 }}>Pick&apos;em Pad</span>
        <span style={{ color: TEAL, display: "flex", fontFamily: "Arial", fontSize: 13, fontWeight: 800, letterSpacing: 1.2, lineHeight: 1.2, maxWidth: "100%" }}>{kicker}</span>
      </div>
      <div style={{ alignSelf: "stretch", borderBottom: `3px solid ${INK}`, display: "flex", fontFamily: "Georgia", fontSize: 27, fontWeight: 800, justifyContent: "center", lineHeight: 1.1, marginTop: 10, padding: "0 8px 4px", textAlign: "center" }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", gap: columns.length > 1 ? 24 : 0, marginTop: 6 }}>
        {columns.map((column, index) => <PadRows compact={compact} grow key={index} rows={column} />)}
      </div>
      <div style={{ borderTop: `2px solid ${INK}`, color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 16, marginTop: 14, paddingTop: 10 }}>{note}</div>
    </div>
  );
}

function publicRevealHeight(rows: PublicRow[]) {
  const columnCount = rows.length > 16 ? 2 : 1;
  const rowsPerColumn = Math.ceil(rows.length / columnCount);
  const rowHeight = rows.length > 10 ? 42 : 52;
  return Math.max(400, Math.min(920, 218 + rowsPerColumn * rowHeight));
}

function slateImageHeight(gameCount: number, compact = false) {
  const count = Math.max(1, gameCount);
  const singleGame = count <= 2;
  const base = compact ? 330 : singleGame ? 330 : 370;
  const rowHeight = compact ? 96 : singleGame ? 88 : 64;
  return Math.max(compact ? 420 : 440, Math.min(1800, base + count * rowHeight));
}

function summaryImageHeight(snapshot: WeeklyRecapSnapshot | PlayoffDayRecapSnapshot) {
  const weeklyRows = Array.isArray(snapshot.weeklySummary) ? snapshot.weeklySummary.length : 0;
  const standingsRows = Array.isArray(snapshot.standings) ? snapshot.standings.length : 0;
  const championSpace = snapshot.kind === "playoff_day_recap" && snapshot.championsCrowned.length ? 52 : 0;
  // Keep recap artwork close to the actual receipt content. A tall fixed
  // canvas makes mobile mail clients show a large blank tail beneath the
  // standings, which reads like a broken screenshot.
  return Math.max(500, Math.min(1300, 300 + weeklyRows * 40 + standingsRows * 29 + championSpace));
}

function survivorImageHeight(snapshot: WeeklyRecapSnapshot["survivor"]) {
  return Math.max(440, Math.min(1800, 250 + snapshot.rows.length * 42));
}

function BowlRecapImage({ snapshot }: { snapshot: BowlDailyRecapSnapshot }) {
  const layout = bowlRecapLayout(snapshot.games.length);
  const columns = Array.from({ length: layout.columns }, (_, index) => snapshot.games.slice(index * layout.gamesPerColumn, (index + 1) * layout.gamesPerColumn));
  return <div style={{ background: PAPER, color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 46px", width: "100%" }}>
    <div style={{ alignItems: "baseline", borderBottom: `3px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}><span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>NCAA Bowl Pool</span><span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>DAILY RECAP</span></div>
    <div style={{ alignSelf: "center", display: "flex", fontFamily: "Georgia", fontSize: 24, fontWeight: 800, margin: "12px 0" }}>{snapshot.day.toUpperCase()}</div>
    <div style={{ display: "flex", gap: 20 }}>
      {columns.map((column, columnIndex) => <div key={columnIndex} style={{ display: "flex", flex: 1, flexDirection: "column" }}>
        {column.map((game) => <div key={game.name} style={{ background: PARCHMENT, border: "1px solid #d4cab7", display: "flex", flexDirection: "column", marginBottom: 10, padding: "10px 12px" }}>
          <span style={{ display: "flex", fontFamily: "Arial", fontSize: 14, fontWeight: 800, letterSpacing: 1 }}>{game.name.toUpperCase()}</span>
          <span style={{ display: "flex", fontFamily: "Arial", fontSize: 21, fontWeight: 800, justifyContent: "space-between", marginTop: 7 }}><span>{game.favorite}</span><span style={{ color: TEAL }}>{game.line}</span><span>{game.underdog}</span></span>
          <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 700, justifyContent: "space-between", marginTop: 5 }}><span>{game.favoriteScore ?? "—"}</span><span>FINAL</span><span>{game.underdogScore ?? "—"}</span></span>
        </div>)}
      </div>)}
    </div>
    <div style={{ borderTop: `2px solid ${INK}`, display: "flex", flexDirection: "column", marginTop: 8, paddingTop: 10 }}>
      <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>STANDINGS</span>
      {snapshot.rows.map((row, index) => <div key={row.name} style={{ alignItems: "center", borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Arial", fontSize: 17, minHeight: 31 }}><span style={{ color: MUTED, display: "flex", width: 36 }}>{index + 1}</span><span style={{ display: "flex", flex: 1, fontFamily: "Georgia", fontWeight: 800 }}>{row.name}</span><span style={{ display: "flex", fontWeight: 800, width: 54 }}>{row.wins}</span><span style={{ color: TEAL, display: "flex", fontWeight: 800 }}>{row.results.join("  ")}</span></div>)}
    </div>
  </div>;
}

function BowlLineLockImage({ snapshot }: { snapshot: BowlLineLockSnapshot }) {
  return <div style={{ background: PAPER, color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 46px", width: "100%" }}>
    <div style={{ alignItems: "baseline", borderBottom: `3px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}><span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>NCAA Bowl Pool</span><span style={{ color: TEAL, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>OFFICIAL LINES</span></div>
    <div style={{ alignSelf: "center", display: "flex", fontFamily: "Georgia", fontSize: 24, fontWeight: 800, margin: "12px 0" }}>{snapshot.day.toUpperCase()}</div>
    <div style={{ display: "flex", flexDirection: "column" }}>
      {snapshot.games.map((game, index) => <div key={game.name} style={{ alignItems: "center", background: index % 2 ? PAPER : PARCHMENT, borderBottom: "1px solid #d4cab7", display: "flex", fontFamily: "Arial", fontSize: 23, minHeight: 68, padding: "0 14px" }}><span style={{ display: "flex", flex: 1, fontWeight: 800 }}>{game.name}</span><span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-end" }}>{game.favorite}</span><span style={{ color: TEAL, display: "flex", fontFamily: "monospace", fontWeight: 900, justifyContent: "center", width: 110 }}>{game.line}</span><span style={{ display: "flex", flex: 1, fontWeight: 800 }}>{game.underdog}</span></div>)}
    </div>
    <div style={{ borderTop: `2px solid ${INK}`, color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, marginTop: 18, paddingTop: 12 }}>OFFICIAL LINES ARE LOCKED AND WILL NOT CHANGE.</div>
  </div>;
}

async function renderRecap(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || (kind !== "summary" && kind !== "survivor" && kind !== "fresh" && kind !== "gameday" && kind !== "earlylock" && kind !== "reveal" && kind !== "bowl" && kind !== "bowl-lines")) return new Response("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("push_reminders").select("category, recap_snapshot").eq("id", reminderId).maybeSingle();
  let snapshot = data?.recap_snapshot as WeeklyRecapSnapshot | PlayoffDayRecapSnapshot | PlayoffPublicRevealSnapshot | FeaturedWindowRevealSnapshot | FreshSlateSnapshot | GameDaySlateSnapshot | EarlyLockSnapshot | SundayRevealSnapshot | BowlDailyRecapSnapshot | BowlLineLockSnapshot | null;
  if (!snapshot) return new Response("Not found", { status: 404 });

  if (kind === "bowl" && snapshot.kind === "bowl_daily_recap") {
    const layout = bowlRecapLayout(snapshot.games.length);
    return new ImageResponse(<BowlRecapImage snapshot={snapshot} />, { width: 920, height: layout.height });
  }

  if (kind === "bowl-lines" && snapshot.kind === "bowl_line_lock") {
    return new ImageResponse(<BowlLineLockImage snapshot={snapshot} />, { width: 920, height: Math.max(360, 190 + snapshot.games.length * 68) });
  }

  if (snapshot.kind === "weekly_recap" && kind === "survivor") {
    snapshot = { ...snapshot, survivor: { ...snapshot.survivor, rows: snapshot.survivor.rows.filter((row) => row.status === "IN" || row.eliminatedInRecapWeek) } };
  }

  if (kind === "fresh" && snapshot.kind === "fresh_slate") {
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.week} subtitle="Preliminary lines" footer="PRELIMINARY LINES MAY MOVE BEFORE OFFICIAL LOCK." official={false} />, { width: SLATE_IMAGE_WIDTH, height: slateImageHeight(snapshot.games.length) });
  }

  if (kind === "gameday" && snapshot.kind === "game_day") {
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.day} subtitle="Official lines" footer="TEAL LINES ARE OFFICIAL AND WILL NOT CHANGE." official />, { width: SLATE_IMAGE_WIDTH, height: slateImageHeight(snapshot.games.length) });
  }

  if (kind === "earlylock" && snapshot.kind === "early_lock") {
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.day} subtitle="Early lock" footer="THIS INTERNATIONAL MATCHUP'S OFFICIAL LINE IS LOCKED EARLY." official compact />, { width: SLATE_IMAGE_WIDTH, height: slateImageHeight(snapshot.games.length, true) });
  }

  if (kind === "reveal" && snapshot.kind === "sunday_reveal") {
    return new ImageResponse(<PublicPickemImage kicker={`SUNDAY ${snapshot.window.toUpperCase()} · PUBLIC RECEIPTS`} title={snapshot.week} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Future picks remain private." />, { width: PUBLIC_RECEIPT_IMAGE_WIDTH, height: publicRevealHeight(onlyPublicPickRows(snapshot.rows)) });
  }

  if (kind === "reveal" && snapshot.kind === "playoff_public_reveal") {
    return new ImageResponse(<PublicPickemImage kicker={`${snapshot.window.toUpperCase()} · PUBLIC RECEIPTS`} title={`${snapshot.round} · ${snapshot.matchup ?? snapshot.window}`} rows={onlyPublicPickRows(snapshot.rows)} note="This kickoff's selections are now public. Later playoff picks remain private." />, { width: PUBLIC_RECEIPT_IMAGE_WIDTH, height: publicRevealHeight(onlyPublicPickRows(snapshot.rows)) });
  }

  if (kind === "reveal" && snapshot.kind === "featured_window_reveal") {
    return new ImageResponse(<PublicPickemImage kicker="FEATURED WINDOW · PUBLIC RECEIPTS" title={`${snapshot.week} · ${snapshot.window}`} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Future picks remain private." />, { width: PUBLIC_RECEIPT_IMAGE_WIDTH, height: publicRevealHeight(onlyPublicPickRows(snapshot.rows)) });
  }

  if (snapshot.kind !== "weekly_recap" && snapshot.kind !== "playoff_day_recap") return new Response("Not found", { status: 404 });

  if (kind === "summary") {
    const title = snapshot.kind === "playoff_day_recap" ? snapshot.day : snapshot.week;
    const champions = snapshot.kind === "playoff_day_recap" ? snapshot.championsCrowned ?? [] : [];
    const weeklySummary = safePublicRows(snapshot.weeklySummary);
    const standings = safePublicRows(snapshot.standings);
    return new ImageResponse(
      <div style={{ background: "#fffaf0", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 48px", width: "100%" }}>
        <div style={{ alignItems: "baseline", borderBottom: `2px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}>
          <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Pick&apos;em Pad</span>
          <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>FINAL RESULTS</span>
        </div>
        <div style={{ alignSelf: "center", borderBottom: `3px solid ${INK}`, display: "flex", fontFamily: "Georgia", fontSize: 24, fontWeight: 800, marginTop: 12, paddingBottom: 3 }}>{title.toUpperCase()}</div>
        {champions.length ? <div style={{ alignSelf: "center", background: "#e8f4f0", borderLeft: `5px solid ${TEAL}`, display: "flex", fontFamily: "Georgia", fontSize: 22, fontWeight: 800, marginTop: 14, padding: "10px 16px" }}>{champions.length === 1 ? `${champions[0]} · PICK'EM CHAMPION` : `${champions.join(" & ")} · PICK'EM CO-CHAMPIONS`}</div> : null}
        <SummaryRows rows={weeklySummary} />
        <div style={{ borderTop: `2px solid ${INK}`, display: "flex", flexDirection: "column", marginTop: 18, paddingTop: 12 }}>
          <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>STANDINGS</span>
          {standings.map((row, index) => <div key={row.name} style={{ alignItems: "center", borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Georgia", fontSize: 18, minHeight: 29 }}><span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, width: 40 }}>{index + 1}</span><span style={{ display: "flex", flex: 1, fontWeight: 700 }}>{row.name}</span><span style={{ display: "flex", fontFamily: "Arial", fontWeight: 800 }}>{row.wins}</span></div>)}
        </div>
      </div>,
      { width: RECAP_IMAGE_WIDTH, height: summaryImageHeight(snapshot) },
    );
  }

  if (kind === "survivor" && snapshot.kind !== "weekly_recap") return new Response("Not found", { status: 404 });
  if (kind === "survivor") {
    const eliminatedThisWeek = snapshot.survivor.rows.filter((row) => row.eliminatedInRecapWeek).map((row) => row.name);
    const eliminationSummary = eliminatedThisWeek.length
      ? `${eliminatedThisWeek.join(", ")} ${eliminatedThisWeek.length === 1 ? "was" : "were"} eliminated this week.`
      : null;
    const remainingSummary = `${snapshot.survivor.in} ${snapshot.survivor.in === 1 ? "entry remains" : "entries remain"}.`;
    const survivorFooter = [
      snapshot.survivor.championCrownedInRecapWeek ? `Congratulations, ${snapshot.survivor.championName ?? "champion"}!` : null,
      eliminationSummary,
      remainingSummary,
    ].filter(Boolean).join(" · ");
    return new ImageResponse(
      <div style={{ background: PAPER, color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 40px", width: "100%" }}>
        <div style={{ alignItems: "baseline", borderBottom: `3px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 13 }}><span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Survivor Table</span><span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>{snapshot.week.toUpperCase()}</span></div>
        <div style={{ alignItems: "center", borderBottom: `2px solid ${INK}`, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, marginTop: 16, padding: "0 8px 10px" }}><span style={{ display: "flex", width: 62 }}>STATUS</span><span style={{ display: "flex", width: 170 }}>PLAYER</span>{Array.from({ length: snapshot.survivor.visibleWeeks }, (_, index) => <span key={index} style={{ display: "flex", justifyContent: "center", width: 54 }}>{index + 1}</span>)}</div>
        {snapshot.survivor.rows.map((row) => <div key={row.name} style={{ alignItems: "center", borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Arial", fontSize: 18, minHeight: 42, padding: "0 8px" }}><span style={{ color: row.status === "IN" ? "#08785d" : "#b91c1c", display: "flex", fontSize: 13, fontWeight: 800, width: 62 }}>{row.status}</span><span style={{ color: row.status === "OUT" ? MUTED : INK, display: "flex", fontFamily: "Georgia", fontWeight: 700, textDecoration: row.status === "OUT" ? "line-through" : "none", width: 170 }}>{row.name}</span>{row.picks.map((rawPick, pickIndex) => { const pick = typeof rawPick === "string" ? rawPick : ""; const match = pick.match(/^([A-Z]+)(?:\s+([WL]))?$/); const abbreviation = match?.[1] ?? ""; const result = match?.[2] ?? ""; return <span key={pickIndex} style={{ alignItems: "center", color: "#334155", display: "flex", justifyContent: "center", width: 54 }}>{abbreviation ? <span style={{ display: "flex", position: "relative" }}><img alt="" height="32" src={`${SITE_URL}/team-logos/${abbreviation}.png`} width="32" />{result === "W" ? <span style={{ alignItems: "center", background: "#08785d", borderRadius: 12, color: "white", display: "flex", fontFamily: "Arial", fontSize: 11, fontWeight: 900, height: 16, justifyContent: "center", position: "absolute", right: -4, top: -4, width: 16 }}>✓</span> : result === "L" ? <span style={{ color: "#b91c1c", display: "flex", fontFamily: "Arial", fontSize: 29, fontWeight: 900, position: "absolute", right: -3, top: -9 }}>×</span> : null}</span> : "·"}</span>; })}</div>)}
        <div style={{ borderTop: `2px solid ${INK}`, display: "flex", fontFamily: "Arial", fontSize: 16, marginTop: 18, paddingTop: 13 }}>{survivorFooter}</div>
      </div>,
      { width: RECAP_IMAGE_WIDTH, height: survivorImageHeight(snapshot.survivor) },
    );
  }

  return new Response("Not found", { status: 404 });
}

// Email clients cannot recover gracefully from a broken image URL. Keep the
// endpoint image-shaped even when a legacy snapshot or a transient data issue
// slips through, while preserving the real error in server logs for repair.
export async function GET(request: NextRequest) {
  try {
    const response = await renderRecap(request);
    if (response.headers.get("content-type")?.startsWith("image/")) {
      response.headers.set("Cache-Control", IMAGE_CACHE_CONTROL);
    }
    return response;
  } catch (error) {
    console.error("recap image render failed", error);
    const response = new ImageResponse(
      <div style={{ alignItems: "center", background: PAPER, color: INK, display: "flex", flexDirection: "column", fontFamily: "Arial", height: "100%", justifyContent: "center", padding: 48, textAlign: "center", width: "100%" }}>
        <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Pick&apos;em Update</span>
        <span style={{ color: MUTED, display: "flex", fontSize: 20, marginTop: 14 }}>Open Pick&apos;em to view the latest standings.</span>
      </div>,
      { width: 920, height: 300 },
    );
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

}
