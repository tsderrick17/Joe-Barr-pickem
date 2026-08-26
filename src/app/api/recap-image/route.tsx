import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { onlyPublicPickRows } from "@/lib/pool-action-visibility";
import type { EarlyLockSnapshot, FeaturedWindowRevealSnapshot, FreshSlateSnapshot, GameDaySlateSnapshot, PlayoffDayRecapSnapshot, PlayoffPublicRevealSnapshot, SundayRevealSnapshot, WeeklyRecapSnapshot } from "@/lib/weekly-recap";

export const dynamic = "force-dynamic";

const INK = "#171719";
const PAPER = "#fffdf8";
const PARCHMENT = "#f0e5cf";
const RULE_BLUE = "#9cc6ea";
const MARGIN_RED = "#d56b66";
const TEAL = "#007e72";
const MUTED = "#596579";

type SlateGame = { away: string; home: string; time: string; favorite: "away" | "home" | null; spread: number | null };
type PublicRow = { name: string; wins: number; picks: string[] };

function teamCode(name: string) {
  return name.split(" ").map((word) => word[0]).join("").slice(0, 3).toUpperCase();
}

function officialLine(game: SlateGame) {
  if (!game.favorite || game.spread === null) return "LINE PENDING";
  return `${teamCode(game.favorite === "away" ? game.away : game.home)} -${game.spread}`;
}

function SlateImage({
  games,
  title,
  subtitle,
  footer,
  official,
}: {
  games: SlateGame[];
  title: string;
  subtitle: string;
  footer: string;
  official: boolean;
}) {
  return (
    <div style={{ background: PAPER, color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "42px 50px", width: "100%" }}>
      <div style={{ alignItems: "baseline", borderBottom: `5px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 16 }}>
        <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 48, fontWeight: 800 }}>The Slate</span>
        <span style={{ color: official ? TEAL : MUTED, display: "flex", fontFamily: "Arial", fontSize: 18, fontWeight: 800, letterSpacing: 2 }}>{official ? "OFFICIAL LINES" : "PRELIMINARY LINES"}</span>
      </div>
      <div style={{ borderBottom: "1px solid #c8c1b5", display: "flex", fontFamily: "Arial", fontSize: 18, fontWeight: 800, letterSpacing: 2, padding: "14px 2px" }}>{title.toUpperCase()}</div>
      <div style={{ color: "#32445f", display: "flex", fontFamily: "Arial", fontSize: 15, lineHeight: 1.3, margin: "14px 0", padding: "0 2px" }}>
        <span style={{ display: "flex", flex: 1 }}><b>PICK&apos;EM</b>&nbsp; Click a team name to choose against the spread.</span>
        <span style={{ display: "flex", flex: 1 }}><b>SURVIVOR</b>&nbsp; Choose an outright winner with a poker chip.</span>
        <span style={{ display: "flex", flex: 1 }}><b>SAVE</b>&nbsp; Save selections at the bottom.</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {games.map((game, index) => (
          <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: index % 2 ? PAPER : PARCHMENT, borderBottom: "1px solid #d4cab7", borderTop: index === 0 ? `3px solid ${official ? TEAL : INK}` : "0 solid transparent", display: "flex", fontFamily: "Arial", fontSize: 22, minHeight: 64, padding: "0 14px" }}>
            <span style={{ color: MUTED, display: "flex", fontSize: 14, fontWeight: 800, width: 132 }}>{game.time}</span>
            <span style={{ display: "flex", flex: 1, fontWeight: 800 }}>{game.away}</span>
            <span style={{ color: official ? TEAL : INK, display: "flex", fontFamily: "monospace", fontSize: 21, fontWeight: 800, justifyContent: "center", width: 140 }}>{officialLine(game)}</span>
            <span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-end", textAlign: "right" }}>{game.home}</span>
          </div>
        ))}
      </div>
      <div style={{ borderTop: `3px solid ${INK}`, color: official ? TEAL : MUTED, display: "flex", fontFamily: "Arial", fontSize: 16, fontWeight: 800, marginTop: "auto", paddingTop: 14 }}>{footer}</div>
      <div style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 14, marginTop: 7 }}>Favorites left; home team ALL CAPS. Changes allowed until kickoff time.</div>
      <span style={{ display: "none" }}>{subtitle}</span>
    </div>
  );
}

function PadRows({ rows, compact = false }: { rows: PublicRow[]; compact?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>
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
  return (
    <div style={{ background: "#fffaf0", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "42px 52px", width: "100%" }}>
      <div style={{ alignItems: "baseline", borderBottom: `2px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}>
        <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 44, fontWeight: 800 }}>Pick&apos;em Pad</span>
        <span style={{ color: TEAL, display: "flex", fontFamily: "Arial", fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>{kicker}</span>
      </div>
      <div style={{ alignSelf: "center", borderBottom: `3px solid ${INK}`, display: "flex", fontFamily: "Georgia", fontSize: 25, fontWeight: 800, marginTop: 12, paddingBottom: 4 }}>{title.toUpperCase()}</div>
      <PadRows rows={rows} />
      <div style={{ borderTop: `2px solid ${INK}`, color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 16, marginTop: "auto", paddingTop: 14 }}>{note}</div>
    </div>
  );
}

export async function GET(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || (kind !== "summary" && kind !== "survivor" && kind !== "fresh" && kind !== "gameday" && kind !== "earlylock" && kind !== "reveal")) return new Response("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("push_reminders").select("category, recap_snapshot").eq("id", reminderId).maybeSingle();
  let snapshot = data?.recap_snapshot as WeeklyRecapSnapshot | PlayoffDayRecapSnapshot | PlayoffPublicRevealSnapshot | FeaturedWindowRevealSnapshot | FreshSlateSnapshot | GameDaySlateSnapshot | EarlyLockSnapshot | SundayRevealSnapshot | null;
  if (!snapshot) return new Response("Not found", { status: 404 });

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
    return new ImageResponse(<SlateImage games={snapshot.games} title={snapshot.day} subtitle="Early lock" footer="THIS INTERNATIONAL MATCHUP'S OFFICIAL LINE IS LOCKED EARLY." official />, { width: 1200, height: 800 });
  }

  if (kind === "reveal" && snapshot.kind === "sunday_reveal") {
    return new ImageResponse(<PublicPickemImage kicker={`SUNDAY ${snapshot.window.toUpperCase()} · PUBLIC RECEIPTS`} title={snapshot.week} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Future picks remain private." />, { width: 1200, height: 1200 });
  }

  if (kind === "reveal" && snapshot.kind === "playoff_public_reveal") {
    return new ImageResponse(<PublicPickemImage kicker="PLAYOFF · PUBLIC RECEIPTS" title={`${snapshot.round} · ${snapshot.window}`} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Later playoff picks remain private." />, { width: 1200, height: 1200 });
  }

  if (kind === "reveal" && snapshot.kind === "featured_window_reveal") {
    return new ImageResponse(<PublicPickemImage kicker="FEATURED WINDOW · PUBLIC RECEIPTS" title={`${snapshot.week} · ${snapshot.window}`} rows={onlyPublicPickRows(snapshot.rows)} note="Only selections from games already underway are shown. Future picks remain private." />, { width: 1200, height: 1200 });
  }

  if (snapshot.kind !== "weekly_recap" && snapshot.kind !== "playoff_day_recap") return new Response("Not found", { status: 404 });

  if (kind === "summary") {
    const title = snapshot.kind === "playoff_day_recap" ? snapshot.day : snapshot.week;
    return new ImageResponse(
      <div style={{ background: "#fffaf0", color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 48px", width: "100%" }}>
        <div style={{ alignItems: "baseline", borderBottom: `2px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 12 }}>
          <span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Pick&apos;em Pad</span>
          <span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, letterSpacing: 2 }}>FINAL RESULTS</span>
        </div>
        <div style={{ alignSelf: "center", borderBottom: `3px solid ${INK}`, display: "flex", fontFamily: "Georgia", fontSize: 24, fontWeight: 800, marginTop: 12, paddingBottom: 3 }}>{title.toUpperCase()}</div>
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
    return new ImageResponse(
      <div style={{ background: PAPER, color: INK, display: "flex", flexDirection: "column", height: "100%", padding: "38px 40px", width: "100%" }}>
        <div style={{ alignItems: "baseline", borderBottom: `3px solid ${INK}`, display: "flex", justifyContent: "space-between", paddingBottom: 13 }}><span style={{ display: "flex", fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Survivor Table</span><span style={{ color: MUTED, display: "flex", fontFamily: "Arial", fontSize: 16, fontWeight: 800, letterSpacing: 2 }}>{snapshot.week.toUpperCase()}</span></div>
        <div style={{ alignItems: "center", borderBottom: `2px solid ${INK}`, display: "flex", fontFamily: "Arial", fontSize: 15, fontWeight: 800, marginTop: 16, padding: "0 8px 10px" }}><span style={{ display: "flex", width: 62 }}>STATUS</span><span style={{ display: "flex", width: 170 }}>PLAYER</span>{Array.from({ length: snapshot.survivor.visibleWeeks }, (_, index) => <span key={index} style={{ display: "flex", justifyContent: "center", width: 54 }}>{index + 1}</span>)}</div>
        {snapshot.survivor.rows.map((row) => <div key={row.name} style={{ alignItems: "center", borderBottom: `1px solid ${RULE_BLUE}`, display: "flex", fontFamily: "Arial", fontSize: 18, minHeight: 42, padding: "0 8px" }}><span style={{ color: row.status === "IN" ? "#08785d" : "#b91c1c", display: "flex", fontSize: 13, fontWeight: 800, width: 62 }}>{row.status}</span><span style={{ display: "flex", fontFamily: "Georgia", fontWeight: 700, width: 170 }}>{row.name}</span>{row.picks.map((pick, pickIndex) => <span key={pickIndex} style={{ color: "#334155", display: "flex", fontFamily: "Arial", fontSize: 12, fontWeight: 800, justifyContent: "center", width: 54 }}>{pick ?? "·"}</span>)}</div>)}
        <div style={{ borderTop: `2px solid ${INK}`, display: "flex", fontFamily: "Arial", fontSize: 16, marginTop: "auto", paddingTop: 13 }}>{snapshot.survivor.championCrownedInRecapWeek ? `Congratulations, ${snapshot.survivor.championName ?? "champion"}!` : `${snapshot.survivor.in} in · ${snapshot.survivor.out} out · The table begins with 10 weeks and expands with the season.`}</div>
      </div>,
      { width: 1200, height: 1200 },
    );
  }

  return new Response("Not found", { status: 404 });
}
