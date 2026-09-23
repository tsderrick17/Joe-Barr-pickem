import { ImageResponse } from "next/og";
import sharp from "sharp";
import type { CSSProperties, ReactNode } from "react";
import type { EarlyLockSnapshot, FeaturedWindowRevealSnapshot, FreshSlateSnapshot, GameDaySlateSnapshot, PlayoffDayRecapSnapshot, PlayoffPublicRevealSnapshot, SundayRevealSnapshot, WeeklyRecapSnapshot } from "./weekly-recap";
import type { BowlDailyRecapSnapshot, BowlLineLockSnapshot } from "./bowl-pool-recap";
import { onlyPublicPickRows } from "./pool-action-visibility.js";
import { slateImagePresentation } from "./slate-image-order";
import { emailArtworkOptions, type EmailArtworkOptions } from "./email-artwork-options";

export type EmailArtworkSnapshot = WeeklyRecapSnapshot | PlayoffDayRecapSnapshot | SundayRevealSnapshot | PlayoffPublicRevealSnapshot | FeaturedWindowRevealSnapshot | FreshSlateSnapshot | GameDaySlateSnapshot | EarlyLockSnapshot | BowlDailyRecapSnapshot | BowlLineLockSnapshot;
const INK = "#171719";
const PAPER = "#fffdf8";
const TEAL = "#008c82";
const MUTED = "#596579";
const RULE = "#c8d8e3";
const WIDTH = 760;
const column: CSSProperties = { display: "flex", flexDirection: "column", flexShrink: 0 };
const row: CSSProperties = { display: "flex", alignItems: "center", flexShrink: 0 };
type PublicRow = { playerId?: string; name: string; wins: number; picks: string[] };

function compactSlateDay(value: string) {
  const parts = value.replace(",", "").split(" ");
  if (parts.length !== 3) return value;
  const [weekday, month, day] = parts;
  return weekday.slice(0, 3) + ", " + month.slice(0, 3) + " " + day;
}

function safePublicRows(value: unknown): PublicRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === "object").map((item) => ({ playerId: typeof item.playerId === "string" ? item.playerId : undefined, name: String(item.name ?? ""), wins: Number(item.wins) || 0, picks: Array.isArray(item.picks) ? item.picks.filter((pick: unknown): pick is string => typeof pick === "string") : [] }));
}

function Card({ title, subtitle, children, note }: { title: string; subtitle: string; children: ReactNode; note?: string }) {
  return <div style={{ ...column, background: PAPER, color: INK, width: WIDTH, padding: 24, fontFamily: "sans-serif", fontSize: 24 }}>
    <div style={{ ...column, borderBottom: `3px solid ${INK}`, paddingBottom: 12 }}>
      <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>{title}</span>
      <span style={{ color: TEAL, fontSize: 20, marginTop: 4 }}>{subtitle}</span>
    </div>
    {children}
    {note ? <div style={{ ...row, color: MUTED, borderTop: `2px solid ${INK}`, fontSize: 18, lineHeight: 1.35, paddingTop: 12, marginTop: 12 }}>{note}</div> : null}
  </div>;
}

function PickChips({ picks, alignTwo }: { picks: string[]; alignTwo: boolean }) {
  const wrapColumns = picks.length >= 6 ? 3 : picks.length >= 4 ? 2 : picks.length;
  const chip = (pick: string, index: number) => {
    const won = /(?:^| )W$/.test(pick);
    const lost = /(?:^| )L$/.test(pick) || /NO PICK.*LOSS/.test(pick);
    return <span key={index} style={{ display: "flex", background: won ? "#e2f1e8" : lost ? "#f8e8e4" : "#eef0f3", color: won ? "#076449" : lost ? "#9d302a" : INK, borderRadius: 4, padding: "5px 8px", fontSize: 22 }}>{pick}</span>;
  };
  if (!picks.length) return <div style={{ ...row, flex: 1, padding: "8px 0" }}><span style={{ color: MUTED, fontSize: 20 }}>No selections</span></div>;
  if (alignTwo && picks.length === 2) return <div style={{ ...row, flex: 1, minWidth: 0, padding: "8px 0" }}>{picks.map((pick, index) => <span key={index} style={{ display: "flex", flex: "1 1 0%", minWidth: 0, paddingRight: index === 0 ? 6 : 0, overflow: "hidden" }}>{chip(pick, index)}</span>)}</div>;
  if (picks.length === 1) return <div style={{ ...row, flex: 1, padding: "8px 0" }}>{chip(picks[0], 0)}</div>;
  const rows = Array.from({ length: Math.ceil(picks.length / wrapColumns) }, (_, rowIndex) => picks.slice(rowIndex * wrapColumns, (rowIndex + 1) * wrapColumns));
  return <div style={{ ...column, flex: 1, width: "100%", minWidth: 0, padding: "8px 0", flexWrap: "wrap" }}>{rows.map((pickRow, rowIndex) => <div key={rowIndex} style={{ ...row, width: "100%", minWidth: 0, marginBottom: rowIndex < rows.length - 1 ? 6 : 0 }}>{pickRow.map((pick, columnIndex) => <span key={columnIndex} style={{ display: "flex", flex: "1 1 0%", minWidth: 0, paddingRight: columnIndex < wrapColumns - 1 ? 6 : 0 }}>{chip(pick, rowIndex * wrapColumns + columnIndex)}</span>)}</div>)}</div>;
}

function PickemTable({ standings, selections, recap, minHeight }: { standings: PublicRow[]; selections: PublicRow[]; recap: boolean; minHeight: number }) {
  const identity = (item: PublicRow) => item.playerId ?? item.name;
  const picksByPlayer = new Map(selections.map((item) => [identity(item), item]));
  // Keep everyone in the standings, including players with no selections.
  const rows = [...standings, ...selections.filter((item) => !standings.some((standing) => identity(standing) === identity(item)))].sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
  const alignTwoPicks = Math.max(0, ...rows.map((item) => (picksByPlayer.get(identity(item))?.picks ?? item.picks).length)) === 2;
  return <div style={column}>
    <div style={{ ...row, color: MUTED, fontSize: 16, fontWeight: 700, padding: "12px 0 8px", borderBottom: `1px solid ${INK}` }}>
      <span style={{ width: 40 }}>RK</span><span style={{ width: 180 }}>PLAYER</span><span style={{ width: 68 }}>TOTAL</span>{recap ? <span style={{ width: 64 }}>+WINS</span> : null}<span style={{ flex: 1 }}>SELECTIONS</span>
    </div>
    {rows.map((standing, index) => {
      const selection = picksByPlayer.get(identity(standing));
      const rank = rows.findIndex((item) => item.wins === standing.wins) + 1;
      return <div key={`${standing.name}-${index}`} style={{ ...row, minHeight, borderBottom: `1px solid ${RULE}`, background: index % 2 ? "#f5f2e9" : PAPER }}>
        <span style={{ width: 40, color: MUTED, fontSize: 20 }}>{rank}</span>
        <span style={{ width: 180, padding: "8px 10px 8px 0", fontWeight: 700, fontSize: 25 }}>{standing.name}</span>
        <span style={{ width: 68, fontWeight: 700, fontSize: 28 }}>{standing.wins}</span>
        {recap ? <span style={{ width: 64, color: TEAL, fontWeight: 700 }}>{selection?.wins ?? 0}</span> : null}
        <PickChips alignTwo={alignTwoPicks} picks={selection?.picks ?? standing.picks} />
      </div>;
    })}
    {!rows.length ? <div style={{ ...row, padding: "16px 0", color: MUTED }}>No public selections yet.</div> : null}
  </div>;
}

function artworkTree(snapshot: EmailArtworkSnapshot, kind: string, options: EmailArtworkOptions) {
  // Keep the two presets visibly distinct after email clients scale the PNG:
  // compact is a tight ledger, while comfortable gives each record room to
  // breathe instead of differing by only a few rendered pixels.
  const minHeight = options.density === "comfortable" ? 68 : 48;
  if (kind === "summary" && (snapshot.kind === "weekly_recap" || snapshot.kind === "playoff_day_recap")) {
    const champions = snapshot.kind === "playoff_day_recap" ? snapshot.championsCrowned : [];
    return <Card title="Pick'em Pad" subtitle={`${snapshot.kind === "weekly_recap" ? snapshot.week : snapshot.day} · Final results`}>
      {champions.length ? <div style={{ ...row, background: "#e2f1e8", color: TEAL, padding: 12, marginTop: 12 }}>Champion{champions.length > 1 ? "s" : ""}: {champions.join(" & ")}</div> : null}
      <PickemTable standings={safePublicRows(snapshot.standings)} selections={safePublicRows(snapshot.weeklySummary)} recap minHeight={minHeight} />
    </Card>;
  }
  if (kind === "reveal" && (snapshot.kind === "sunday_reveal" || snapshot.kind === "featured_window_reveal" || snapshot.kind === "playoff_public_reveal")) {
    const rows = onlyPublicPickRows(safePublicRows(snapshot.rows));
    return <Card title="Pick'em Pad" subtitle={`${snapshot.kind === "playoff_public_reveal" ? snapshot.round : snapshot.week} · ${snapshot.window} picks`} note="TOTAL = season wins · Only started games are shown. Later picks remain private.">
      <PickemTable standings={rows} selections={rows} recap={false} minHeight={minHeight} />
    </Card>;
  }
  if (kind === "survivor" && snapshot.kind === "weekly_recap") {
    const rows = snapshot.survivor.rows.filter((item) => item.status === "IN" || item.eliminatedInRecapWeek);
    const lastWeek = Math.min(snapshot.weekNumber, snapshot.survivor.visibleWeeks);
    const firstWeek = Math.max(1, lastWeek - 5);
    const weeks = Array.from({ length: lastWeek - firstWeek + 1 }, (_, i) => firstWeek + i);
    const survivorFooter = `${snapshot.survivor.in} ${snapshot.survivor.in === 1 ? "entry remains" : "entries remain"}.${firstWeek > 1 ? " Earlier weeks are on the website." : ""}`;
    return <Card title="Survivor" subtitle={`${snapshot.week} · ${snapshot.survivor.championCrownedInRecapWeek ? `Champion: ${snapshot.survivor.championName}` : "The remaining field"}`} note={survivorFooter}>
      <div style={{ ...row, color: MUTED, fontSize: 16, padding: "12px 0 8px" }}><span style={{ width: 196 }}>PLAYER / STATUS</span>{weeks.map((week) => <span key={week} style={{ display: "flex", flex: 1, justifyContent: "center" }}>WK {week}</span>)}</div>
      {rows.map((item, index) => <div key={index} style={{ ...row, minHeight, borderBottom: `1px solid ${RULE}` }}><div style={{ ...column, width: 196, padding: "8px 8px 8px 0" }}><span style={{ fontWeight: 700 }}>{item.name}</span><span style={{ fontSize: 16, color: item.status === "IN" ? TEAL : "#9d302a" }}>{item.status === "IN" ? "STILL IN" : "ELIMINATED"}</span></div>{weeks.map((week) => { const pick = item.picks[week - 1] ?? "-"; const lost = / L$/.test(pick); const empty = pick === "-"; return <span key={week} style={{ display: "flex", flex: 1, justifyContent: "center", textAlign: "center", fontSize: 18 }}><span style={{ background: empty ? "transparent" : lost ? "#f8e8e4" : "#e2f1e8", borderRadius: 4, color: empty ? MUTED : lost ? "#9d302a" : "#076449", padding: empty ? 0 : "5px 8px" }}>{pick}</span></span>; })}</div>)}
    </Card>;
  }
  if ((kind === "fresh" && snapshot.kind === "fresh_slate") || (kind === "gameday" && snapshot.kind === "game_day") || (kind === "earlylock" && snapshot.kind === "early_lock")) {
    const official = snapshot.kind !== "fresh_slate";
    return <Card title="The Slate" subtitle={`${snapshot.kind === "fresh_slate" ? snapshot.week : snapshot.day} · ${official ? "Official lines" : "Preliminary lines"}`} note={`${official ? "Teal lines are locked." : "Preliminary lines may change."} Favorites left; home team ALL CAPS. Picks close at kickoff.`}>
      {snapshot.games.map((game, index) => {
        const presentation = slateImagePresentation({ ...game, home: game.home.toUpperCase() });
        return <div key={index} style={{ ...row, minHeight: Math.max(minHeight, 72), padding: "10px 0", borderBottom: `1px solid ${RULE}`, background: index % 2 ? "#f5f2e9" : PAPER }}>
          <div style={{ ...column, width: 110, fontSize: 17, color: MUTED, paddingRight: 12 }}>{"day" in game ? <span>{compactSlateDay(String(game.day))}</span> : null}<span>{game.time}</span></div>
          <span style={{ display: "flex", flex: 1, fontWeight: 700 }}>{presentation.leftTeam}</span>
          <span style={{ display: "flex", width: 110, justifyContent: "center", fontSize: game.spread == null ? 16 : 26, color: official ? TEAL : INK, fontWeight: 700 }}>{presentation.line}</span>
          <span style={{ display: "flex", flex: 1, fontWeight: 700 }}>{presentation.rightTeam}</span>
        </div>;
      })}
    </Card>;
  }
  if ((kind === "bowl" && snapshot.kind === "bowl_daily_recap") || (kind === "bowl-lines" && snapshot.kind === "bowl_line_lock")) {
    return <Card title="NCAA Bowl Pool" subtitle={`${snapshot.day} · ${snapshot.kind === "bowl_daily_recap" ? "Final results" : "Official lines"}`}>
      {snapshot.games.map((game, index) => <div key={index} style={{ ...column, padding: "12px 0", borderBottom: `1px solid ${RULE}` }}><span style={{ fontSize: 18, color: MUTED }}>{game.name}</span><div style={{ ...row, marginTop: 6 }}><span style={{ flex: 1 }}>{game.favorite}{"favoriteScore" in game ? ` ${game.favoriteScore ?? "—"}` : ""}</span><span style={{ width: 95, textAlign: "center", color: TEAL }}>{game.line}</span><span style={{ flex: 1 }}>{game.underdog}{"underdogScore" in game ? ` ${game.underdogScore ?? "—"}` : ""}</span></div></div>)}
      {snapshot.kind === "bowl_daily_recap" ? <PickemTable standings={snapshot.rows.map((item) => ({ ...item, picks: item.results }))} selections={snapshot.rows.map((item) => ({ ...item, picks: item.results }))} recap={false} minHeight={minHeight} /> : null}
    </Card>;
  }
  throw new Error("This message does not contain that image.");
}

/** Preview and delivery both call this renderer. The card has intrinsic height;
 * the transparent working canvas is removed, rather than guessing the final height. */
export async function renderEmailArtwork(snapshot: EmailArtworkSnapshot, kind: string, value?: unknown) {
  const tree = artworkTree(snapshot, kind, emailArtworkOptions(value));
  // Bound from the entire snapshot, including wrapped names/picks and long
  // playoff cards. No row-count height cap may silently truncate players.
  const canvasHeight = Math.max(1200, 600 + JSON.stringify(snapshot).length * 2);
  const response = new ImageResponse(<div style={{ display: "flex", alignItems: "flex-start", width: WIDTH, height: "100%" }}>{tree}</div>, { width: WIDTH, height: canvasHeight });
  const png = await sharp(Buffer.from(await response.arrayBuffer())).trim({ background: "#00000000", threshold: 0 }).png().toBuffer();
  return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png" } });
}
