import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { EarlyLockSnapshot, FreshSlateSnapshot, GameDaySlateSnapshot, WeeklyRecapSnapshot } from "@/lib/weekly-recap";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || (kind !== "summary" && kind !== "survivor" && kind !== "fresh" && kind !== "gameday" && kind !== "earlylock")) return new Response("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("push_reminders").select("category, recap_snapshot").eq("id", reminderId).maybeSingle();
  let snapshot = data?.recap_snapshot as WeeklyRecapSnapshot | FreshSlateSnapshot | GameDaySlateSnapshot | EarlyLockSnapshot | null;
  if (!snapshot) return new Response("Not found", { status: 404 });

  if (snapshot.kind === "weekly_recap" && kind === "survivor") {
    snapshot = {
      ...snapshot,
      survivor: {
        ...snapshot.survivor,
        rows: snapshot.survivor.rows.filter((row) => row.status === "IN" || row.eliminatedInRecapWeek),
      },
    };
  }

  if (kind === "fresh" && snapshot.kind === "fresh_slate") return new ImageResponse(
    <div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "48px 56px", width: "100%" }}>
      <div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 22 }}><span style={{ fontFamily: "Georgia", fontSize: 46, fontWeight: 800 }}>The Slate</span><span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, paddingTop: 18 }}>PRELIMINARY LINES</span></div>
      <div style={{ color: "#475569", display: "flex", fontSize: 24, fontWeight: 700, marginTop: 18 }}>{snapshot.week.toUpperCase()}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>{snapshot.games.map((game, index) => <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: index % 2 ? "#eee4d1" : "#fffdf8", borderBottom: "1px solid #c8c1b5", display: "flex", fontSize: 18, minHeight: 54, padding: "0 16px" }}><span style={{ color: "#475569", display: "flex", fontSize: 13, fontWeight: 700, width: 132 }}>{game.time}</span><span style={{ display: "flex", flex: 1, fontWeight: 800 }}>{game.away}</span><span style={{ color: "#171719", display: "flex", fontFamily: "monospace", fontSize: 19, fontWeight: 800, justifyContent: "center", width: 150 }}>{game.favorite && game.spread !== null ? `${game.favorite === "away" ? game.away.slice(0, 3).toUpperCase() : game.home.slice(0, 3).toUpperCase()} -${game.spread}` : "LINE PENDING"}</span><span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-end", textAlign: "right" }}>{game.home}</span></div>)}</div>
      <div style={{ borderTop: "3px solid #171719", color: "#475569", display: "flex", fontSize: 18, fontWeight: 800, marginTop: "auto", paddingTop: 18 }}>PRELIMINARY LINES MAY MOVE BEFORE OFFICIAL LOCK.</div>
    </div>,
    { width: 1200, height: 1200 },
  );

  if (kind === "gameday" && snapshot.kind === "game_day") return new ImageResponse(
    <div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "48px 56px", width: "100%" }}>
      <div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 22 }}><span style={{ fontFamily: "Georgia", fontSize: 46, fontWeight: 800 }}>The Slate</span><span style={{ fontSize: 22, fontWeight: 700, letterSpacing: 2, paddingTop: 18 }}>OFFICIAL LINES</span></div>
      <div style={{ color: "#475569", display: "flex", fontSize: 24, fontWeight: 700, marginTop: 18 }}>{snapshot.day.toUpperCase()}</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 16 }}>{snapshot.games.map((game, index) => <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: index % 2 ? "#eee4d1" : "#fffdf8", borderBottom: "1px solid #c8c1b5", display: "flex", fontSize: 26, minHeight: 86, padding: "0 20px" }}><span style={{ color: "#475569", display: "flex", fontSize: 17, fontWeight: 700, width: 165 }}>{game.time}</span><span style={{ display: "flex", flex: 1, fontWeight: 800 }}>{game.away}</span><span style={{ color: "#007e72", display: "flex", fontFamily: "monospace", fontSize: 28, fontWeight: 800, justifyContent: "center", width: 145 }}>{game.favorite === "away" ? game.away.slice(0, 3).toUpperCase() : game.home.slice(0, 3).toUpperCase()} −{game.spread}</span><span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-end", textAlign: "right" }}>{game.home}</span></div>)}</div>
      <div style={{ borderTop: "3px solid #171719", color: "#007e72", display: "flex", fontSize: 18, fontWeight: 800, marginTop: "auto", paddingTop: 18 }}>TEAL LINES ARE OFFICIAL</div>
    </div>,
    { width: 1200, height: 1200 },
  );

  if (kind === "earlylock" && snapshot.kind === "early_lock") return new ImageResponse(<div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "70px 80px", width: "100%" }}><div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 22 }}><span style={{ fontFamily: "Georgia", fontSize: 48, fontWeight: 800 }}>The Slate</span><span style={{ color: "#007e72", fontSize: 20, fontWeight: 800, letterSpacing: 2, paddingTop: 20 }}>EARLY LOCK</span></div><div style={{ color: "#475569", display: "flex", fontSize: 24, fontWeight: 700, marginTop: 22 }}>{snapshot.day.toUpperCase()}</div>{snapshot.games.map((game) => <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: "#eee4d1", borderBottom: "1px solid #c8c1b5", borderTop: "4px solid #007e72", display: "flex", fontSize: 30, marginTop: 22, minHeight: 120, padding: "0 24px" }}><span style={{ display: "flex", flex: 1, fontWeight: 800 }}>{game.away}</span><span style={{ color: "#007e72", display: "flex", fontFamily: "monospace", fontSize: 34, fontWeight: 800, justifyContent: "center", width: 170 }}>{game.favorite === "away" ? game.away.slice(0, 3).toUpperCase() : game.home.slice(0, 3).toUpperCase()} −{game.spread}</span><span style={{ display: "flex", flex: 1, fontWeight: 800, justifyContent: "flex-end" }}>{game.home}</span></div>)}<div style={{ borderTop: "3px solid #171719", display: "flex", fontSize: 21, marginTop: "auto", paddingTop: 18 }}>This international matchup’s official line is locked early.</div></div>, { width: 1200, height: 800 });

  if (snapshot.kind !== "weekly_recap") return new Response("Not found", { status: 404 });

  if (kind === "summary") return new ImageResponse(
    <div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "48px 56px", width: "100%" }}>
      <div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 22 }}><span style={{ fontFamily: "Georgia", fontSize: 46, fontWeight: 800 }}>Pick&apos;em Summary</span><span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, paddingTop: 16 }}>{snapshot.week.toUpperCase()}</span></div>
      <div style={{ color: "#475569", display: "flex", fontSize: 19, fontWeight: 800, letterSpacing: 2, marginTop: 20 }}>THIS WEEK</div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 8 }}>{snapshot.weeklySummary.map((row, index) => <div key={row.name} style={{ alignItems: "center", background: index % 2 ? "#eee4d1" : "#fffdf8", borderBottom: "1px solid #c8c1b5", display: "flex", fontSize: 23, minHeight: 48, padding: "0 14px" }}><span style={{ display: "flex", fontFamily: "Georgia", fontWeight: 700, width: 180 }}>{row.name}</span><span style={{ display: "flex", flex: 1, gap: 12 }}>{row.picks.join(" · ") || "—"}</span><span style={{ color: "#08785d", display: "flex", fontWeight: 800 }}>{row.wins} W</span></div>)}</div>
      <div style={{ borderTop: "3px solid #171719", display: "flex", flexDirection: "column", marginTop: 28, paddingTop: 16 }}><span style={{ fontFamily: "Georgia", fontSize: 29, fontWeight: 800 }}>Lead Pipe Locks</span>{snapshot.standings.map((row, index) => <div key={row.name} style={{ display: "flex", fontSize: 21, marginTop: 6 }}><span style={{ color: "#475569", display: "flex", width: 42 }}>{index + 1}</span><span style={{ display: "flex", flex: 1, fontWeight: 700 }}>{row.name}</span><span style={{ color: "#08785d", display: "flex", fontWeight: 800 }}>{row.wins} W</span></div>)}</div>
    </div>,
    { width: 1200, height: 1200 },
  );

  if (kind === "survivor") return new ImageResponse(<div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "42px 42px", width: "100%" }}><div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 18 }}><span style={{ fontFamily: "Georgia", fontSize: 42, fontWeight: 800 }}>Survivor Board</span><span style={{ fontSize: 20, fontWeight: 700, letterSpacing: 2, paddingTop: 14 }}>{snapshot.week.toUpperCase()}</span></div><div style={{ alignItems: "center", borderBottom: "2px solid #171719", display: "flex", fontSize: 16, fontWeight: 800, marginTop: 18, padding: "0 8px 10px" }}><span style={{ display: "flex", width: 170 }}>PLAYER</span>{Array.from({ length: snapshot.survivor.visibleWeeks }, (_, index) => <span key={index} style={{ display: "flex", justifyContent: "center", width: 54 }}>{index + 1}</span>)}<span style={{ display: "flex", justifyContent: "flex-end", marginLeft: "auto", width: 65 }}>STATUS</span></div>{snapshot.survivor.rows.map((row, index) => <div key={row.name} style={{ alignItems: "center", background: index % 2 ? "#eee4d1" : "#fffdf8", borderBottom: "1px solid #c8c1b5", display: "flex", fontSize: 18, minHeight: 44, padding: "0 8px" }}><span style={{ display: "flex", fontFamily: "Georgia", fontWeight: 700, width: 170 }}>{row.name}</span>{row.picks.map((pick, pickIndex) => <span key={pickIndex} style={{ color: "#334155", display: "flex", fontSize: 13, fontWeight: 800, justifyContent: "center", width: 54 }}>{pick ?? "·"}</span>)}<span style={{ color: row.status === "IN" ? "#08785d" : "#b91c1c", display: "flex", fontSize: 14, fontWeight: 800, justifyContent: "flex-end", marginLeft: "auto", width: 65 }}>{row.status}</span></div>)}<div style={{ borderTop: "3px solid #171719", display: "flex", fontSize: 17, marginTop: "auto", paddingTop: 14 }}>{snapshot.survivor.in} in · {snapshot.survivor.out} out · The board starts at 10 weeks and expands as the season does.</div></div>, { width: 1200, height: 1200 });

  return new Response("Not found", { status: 404 });
}
