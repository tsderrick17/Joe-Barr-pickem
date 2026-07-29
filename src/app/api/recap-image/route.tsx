import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { WeeklyRecapSnapshot } from "@/lib/weekly-recap";

export const dynamic = "force-dynamic";

function score(game: WeeklyRecapSnapshot["games"][number], side: "away" | "home") {
  const value = side === "away" ? game.awayScore : game.homeScore;
  const other = side === "away" ? game.homeScore : game.awayScore;
  return <span style={{ color: value > other ? "#08785d" : "#171719", fontWeight: 800 }}>{value}</span>;
}

export async function GET(request: NextRequest) {
  const reminderId = request.nextUrl.searchParams.get("reminder");
  const kind = request.nextUrl.searchParams.get("kind");
  if (!reminderId || (kind !== "slate" && kind !== "standings")) return new Response("Not found", { status: 404 });
  const { data } = await supabaseAdmin.from("push_reminders").select("category, recap_snapshot").eq("id", reminderId).maybeSingle();
  const snapshot = data?.category === "weekly_recap" ? data.recap_snapshot as WeeklyRecapSnapshot | null : null;
  if (!snapshot) return new Response("Not found", { status: 404 });

  if (kind === "slate") return new ImageResponse(
    <div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "48px 56px", width: "100%" }}>
      <div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 22 }}><span style={{ fontFamily: "Georgia", fontSize: 46, fontWeight: 800 }}>The Final Slate</span><span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, paddingTop: 16 }}>{snapshot.week.toUpperCase()}</span></div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 22 }}>{snapshot.games.map((game, index) => <div key={`${game.away}-${game.home}`} style={{ alignItems: "center", background: index % 2 ? "#eee4d1" : "#fffdf8", borderBottom: "1px solid #c8c1b5", display: "flex", fontSize: 25, minHeight: 82, padding: "0 22px" }}><span style={{ display: "flex", flex: 1, fontWeight: 700 }}>{game.away}</span><span style={{ display: "flex", fontFamily: "monospace", fontSize: 30, gap: 13, justifyContent: "center", width: 175 }}>{score(game, "away")}<span style={{ color: "#79716a" }}>–</span>{score(game, "home")}</span><span style={{ display: "flex", flex: 1, fontWeight: 700, justifyContent: "flex-end", textAlign: "right" }}>{game.home}</span></div>)}</div>
      <div style={{ borderTop: "3px solid #171719", display: "flex", fontSize: 18, marginTop: "auto", paddingTop: 18 }}>Final scores and official lines are now part of the season record.</div>
    </div>,
    { width: 1200, height: 1500 },
  );

  return new ImageResponse(
    <div style={{ background: "#fffdf8", color: "#171719", display: "flex", flexDirection: "column", height: "100%", padding: "48px 56px", width: "100%" }}>
      <div style={{ borderBottom: "6px solid #171719", display: "flex", justifyContent: "space-between", paddingBottom: 22 }}><span style={{ fontFamily: "Georgia", fontSize: 46, fontWeight: 800 }}>Lead Pipe Locks</span><span style={{ fontSize: 24, fontWeight: 700, letterSpacing: 3, paddingTop: 16 }}>STANDINGS</span></div>
      <div style={{ display: "flex", flexDirection: "column", marginTop: 24 }}>{snapshot.standings.slice(0, 10).map((row, index) => <div key={row.name} style={{ alignItems: "center", background: index % 2 ? "#eee4d1" : "#fffdf8", borderBottom: "1px solid #c8c1b5", display: "flex", fontSize: 30, minHeight: 64, padding: "0 18px" }}><span style={{ color: "#475569", display: "flex", fontFamily: "Georgia", width: 70 }}>{index + 1}</span><span style={{ display: "flex", flex: 1, fontFamily: "Georgia", fontWeight: 700 }}>{row.name}</span><span style={{ color: "#08785d", display: "flex", fontFamily: "Georgia", fontWeight: 800 }}>{row.wins} W</span></div>)}</div>
      <div style={{ background: "#edf7ef", borderLeft: "8px solid #08785d", display: "flex", flexDirection: "column", marginTop: 34, padding: "20px 24px" }}><span style={{ fontFamily: "Georgia", fontSize: 30, fontWeight: 800 }}>Survivor recap</span><span style={{ fontSize: 23, marginTop: 8 }}>{snapshot.survivor.in} still in · {snapshot.survivor.out} out{snapshot.survivor.latest ? ` · ${snapshot.survivor.latest}` : ""}</span></div>
      <div style={{ borderTop: "3px solid #171719", display: "flex", fontSize: 18, marginTop: "auto", paddingTop: 18 }}>Joe Barr Memorial Pick&apos;em · {snapshot.week}</div>
    </div>,
    { width: 1200, height: 1200 },
  );
}
