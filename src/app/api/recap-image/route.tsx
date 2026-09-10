import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { onlyPublicPickRows } from "@/lib/pool-action-visibility";
import { slateImagePresentation } from "@/lib/slate-image-order";
import type { EarlyLockSnapshot, FeaturedWindowRevealSnapshot, FreshSlateSnapshot, GameDaySlateSnapshot, PlayoffDayRecapSnapshot, PlayoffPublicRevealSnapshot, SundayRevealSnapshot, WeeklyRecapSnapshot } from "@/lib/weekly-recap";
import type { BowlDailyRecapSnapshot } from "@/lib/bowl-pool-recap";
import { bowlRecapLayout } from "@/lib/bowl-recap-layout.js";

export const dynamic = "force-dynamic";

const INK = "#171719";
const PAPER = "#fffdf8";
const PARCHMENT = "#f0e5cf";
const RULE_BLUE = "#9cc6ea";
const MARGIN_RED = "#d56b66";
const TEAL = "#008c82";
const MUTED = "#596579";

type SlateGame = { away: string; home: string; day?: string; time: string; favorite: "away" | "home" | null; spread: number | null };
type PublicRow = { name: string; wins: number; picks: string[] };

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
          return <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: index % 2 ? PAPER : PARCHMENT, borderBottom: "1px solid #d4cab7", borderTop: index === 0 ? `3px solid ${official ? TEAL : INK}` : "0 solid transparent", display: "flex", fontFamily: "Arial", fontSize: compact ? 28 : 22, minHeight: compact ? 96 : 64, padding: "0 14px" }}>
            <span style={{ color: MUTED, display: "flex", flexDirection: "column", fontSize: compact ? 17 : 14, fontWeight: 800, lineHeight: 1.25, width: 150 }}>
              {game.day ? <span style={{ display: "flex", fontSize: 12 }}>{game.day}</span> : null}
              <span style={{ display: "flex", marginTop: game.day ? 3 : 0 }}>{game.time}</span>
            </span>
            <span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-end", paddingRight: 14, textAlign: "right" }}>{presentation.leftTeam}</span>
            <span style={{ color: official ? TEAL : INK, display: "flex", fontFamily: "monospace", fontSize: compact ? 28 : 21, fontWeight: 900, justifyContent: "center", width: 110 }}>{presentation.line}</span>
            <span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-start", paddingLeft: 14 }}>{presentation.rightTeam}</span>
          </div>;
        })}
      </div>
      <div style={{ borderTop: `3px solid ${INK}`, color: official ? TEAL : MUTED, display: "flex", fontFamily: "Arial", fontSize: compact ? 17 : 16, fontWeight: 800, marginTop: compact ? 24 : "auto", paddingTop: 14 }}>{footer}</div>
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
          <span style={{ color: "#263d5b", display: "flex", flex: 1, fontFamily: "Arial", fontSize: compact ? 15 : 17, fontWeight: 700, gap: 16 }}>{row.picks.join("  ·  ") || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function PublicPickemImage({ kicker, title, rows, note }: { kicker: string; title: string; rows: PublicRow[]; note: string }) {
  const compact = rows.length > 10;
  const columns = rows.length > 16
    ? [rows.slice(0, Math.ceil(rows.length / 2)), rows.slice(Math.ceil(rows.length / 2))]
    : [rows];
  return (
    <div style={{ background: "#fffaf0", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "30px 52px", width: "100%" }}>
      <div style={{ alignItems: "baseline", borderBottom: `2px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}>
        <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 44, fontWeight: 800 }}>Pick&apos;em Pad</span>
        <span style={{ color: TEAL, display: "flex", fontFamily: "Arial", fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>{kicker}</span>
      </div>
      <div style={{ alignSelf: "center", borderBottom: `3px solid ${INK}`, display: "flex", fontFamily: "Georgia", fontSize: 25, fontWeight: 800, marginTop: 10, paddingBottom: 4 }}>{title.toUpperCase()}</div>
      <div style={{ display: "flex", gap: columns.length > 1 ? 24 : 0, marginTop: 6 }}>
        {columns.map((column, index) => <PadRows compact={compact} grow key={index} rows={column} />)}
      </div>
      <div style={{ borderTop: `2px solid ${INK}`, color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 16, marginTop: 18, paddingTop: 12 }}>{note}</div>
    </div>
  );
}

function publicRevealHeight(rows: PublicRow[]) {
  const columnCount = rows.length > 16 ? 2 : 1;
  const rowsPerColumn = Math.ceil(rows.length / columnCount);
  const rowHeight = rows.length > 10 ? 40 : 48;
  return Math.max(400, Math.min(920, 245 + rowsPerColumn * rowHeight));
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

export async function GET(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || (kind !== "summary" && kind !== "survivor" && kind !== "fresh" && kind !== "gameday" && kind !== "earlylock" && kind !== "reveal" && kind !== "bowl")) return new Response("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("push_reminders").select("category, recap_snapshot").eq("id", reminderId).maybeSingle();
  let snapshot = data?.recap_snapshot as WeeklyRecapSnapshot | PlayoffDayRecapSnapshot | PlayoffPublicRevealSnapshot | FeaturedWindowRevealSnapshot | FreshSlateSnapshot | GameDaySlateSnapshot | EarlyLockSnapshot | SundayRevealSnapshot | BowlDailyRecapSnapshot | null;
  if (!snapshot) return new Response("Not found", { status: 404 });

  if (kind === "bowl" && snapshot.kind === "bowl_daily_recap") {
    const layout = bowlRecapLayout(snapshot.games.length);
    return new ImageResponse(<BowlRecapImage snapshot={snapshot} />, { width: layout.width, height: layout.height });
  }

  if (snapshot.kind === "weekly_recap" && kind === "survivor") {
    snapshot = { ...snapshot, survivor: { ...snapshot.survivor, rows: snapshot.survivor.rows.filter((row) => row.status === "IN" || row.eliminatedInRecapWeek) } };
  }

  if (kind === "fresh" && snapshot.kind === "fresh_slate") {
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.week} subtitle="Preliminary lines" footer="PRELIMINARY LINES MAY MOVE BEFORE OFFICIAL LOCK." official={false} />, { width: 1200, height: 1200 });
  }

  if (kind === "gameday" && snapshot.kind === "game_day") {
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.day} subtitle="Official lines" footer="TEAL LINES ARE OFFICIAL AND WILL NOT CHANGE." official />, { width: 1200, height: 1200 });
  }

  if (kind === "earlylock" && snapshot.kind === "early_lock") {
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.day} subtitle="Early lock" footer="THIS INTERNATIONAL MATCHUP'S OFFICIAL LINE IS LOCKED EARLY." official compact />, { width: 1200, height: 560 });
  }

  if (kind === "reveal" && snapshot.kind === "sunday_reveal") {
    return new ImageResponse(<PublicPickemImage kicker={`SUNDAY ${snapshot.window.toUpperCase()} · PUBLIC RECEIPTS`} title={snapshot.week} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Future picks remain private." />, { width: 1200, height: publicRevealHeight(onlyPublicPickRows(snapshot.rows)) });
  }

  if (kind === "reveal" && snapshot.kind === "playoff_public_reveal") {
    return new ImageResponse(<PublicPickemImage kicker={`${snapshot.window.toUpperCase()} · PUBLIC RECEIPTS`} title={`${snapshot.round} · ${snapshot.matchup ?? snapshot.window}`} rows={onlyPublicPickRows(snapshot.rows)} note="This kickoff's selections are now public. Later playoff picks remain private." />, { width: 1200, height: publicRevealHeight(onlyPublicPickRows(snapshot.rows)) });
  }

  if (kind === "reveal" && snapshot.kind === "featured_window_reveal") {
    return new ImageResponse(<PublicPickemImage kicker="FEATURED WINDOW · PUBLIC RECEIPTS" title={`${snapshot.week} · ${snapshot.window}`} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Future picks remain private." />, { width: 1200, height: publicRevealHeight(onlyPublicPickRows(snapshot.rows)) });
  }

  if (snapshot.kind !== "weekly_recap" && snapshot.kind !== "playoff_day_recap") return new Response("Not found", { status: 404 });

  if (kind === "summary") {
    const title = snapshot.kind === "playoff_day_recap" ? snapshot.day : snapshot.week;
    const champions = snapshot.kind === "playoff_day_recap" ? snapshot.championsCrowned ?? [] : [];
    return new ImageResponse(
      <div style={{ background: "#fffaf0", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 48px", width: "100%" }}>
        <div style={{ alignItems: "baseline", borderBottom: `2px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}>
          <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Pick&apos;em Pad</span>
          <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>FINAL RESULTS</span>
        </div>
        <div style={{ alignSelf: "center", borderBottom: `3px solid ${INK}`, display: "flex", fontFamily: "Georgia", fontSize: 24, fontWeight: 800, marginTop: 12, paddingBottom: 3 }}>{title.toUpperCase()}</div>
        {champions.length ? <div style={{ alignSelf: "center", background: "#e8f4f0", borderLeft: `5px solid ${TEAL}`, display: "flex", fontFamily: "Georgia", fontSize: 22, fontWeight: 800, marginTop: 14, padding: "10px 16px" }}>{champions.length === 1 ? `${champions[0]} · PICK'EM CHAMPION` : `${champions.join(" & ")} · PICK'EM CO-CHAMPIONS`}</div> : null}
        <PadRows rows={snapshot.weeklySummary} compact />
        <div style={{ borderTop: `2px solid ${INK}`, display: "flex", flexDirection: "column", marginTop: 18, paddingTop: 12 }}>
          <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, fontWeight: 800, letterSpacing: 2 }}>STANDINGS</span>
          {snapshot.standings.map((row, index) => <div key={row.name} style={{ alignItems: "center", borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Georgia", fontSize: 18, minHeight: 29 }}><span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, width: 40 }}>{index + 1}</span><span style={{ display: "flex", flex: 1, fontWeight: 700 }}>{row.name}</span><span style={{ display: "flex", fontFamily: "Arial", fontWeight: 800 }}>{row.wins}</span></div>)}
        </div>
      </div>,
      { width: 1200, height: 1200 },
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
        {snapshot.survivor.rows.map((row) => <div key={row.name} style={{ alignItems: "center", borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Arial", fontSize: 18, minHeight: 42, padding: "0 8px" }}><span style={{ color: row.status === "IN" ? "#08785d" : "#b91c1c", display: "flex", fontSize: 13, fontWeight: 800, width: 62 }}>{row.status}</span><span style={{ display: "flex", fontFamily: "Georgia", fontWeight: 700, width: 170 }}>{row.name}</span>{row.picks.map((pick, pickIndex) => <span key={pickIndex} style={{ color: "#334155", display: "flex", fontFamily: "Arial", fontSize: 12, fontWeight: 800, justifyContent: "center", width: 54 }}>{pick ?? "·"}</span>)}</div>)}
        <div style={{ borderTop: `2px solid ${INK}`, display: "flex", fontFamily: "Arial", fontSize: 16, marginTop: "auto", paddingTop: 13 }}>{survivorFooter}</div>
      </div>,
      { width: 1200, height: 1200 },
    );
  }

  return new Response("Not found", { status: 404 });
}
