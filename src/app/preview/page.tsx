"use client";

import { useState } from "react";
import PickemScoreboard, { type PickemScoreboardRow } from "@/components/pickem-scoreboard";
import SlateGameRow, { type SlateGameRowData } from "@/components/slate-game-row";
import { countPickemWins } from "@/lib/standings";

type Side = "left" | "right";
type Result = "win" | "loss" | null;

type RehearsalGame = {
  id: string;
  kickoff: string;
  finalDate: string;
  left: string;
  right: string;
  line: string;
  score: { left: number; right: number };
  atsWinner: Side;
  pickers: { left: string[]; right: string[] };
};

type Scenario = {
  title: string;
  timing: string;
  explanation: string;
  activeGames: number[];
  lockedGames: number[];
  finalGames: number[];
  final: boolean;
};

const games: RehearsalGame[] = [
  {
    id: "jax-chi",
    kickoff: "Sun 9:30 AM ET · London",
    finalDate: "9/27",
    left: "Jaguars",
    right: "Bears",
    line: "JAX −2.5",
    score: { left: 24, right: 17 },
    atsWinner: "left",
    pickers: { left: ["Tyler", "Gary"], right: ["Zac"] },
  },
  {
    id: "kc-buf",
    kickoff: "Sun 1:00 PM ET",
    finalDate: "9/27",
    left: "Chiefs",
    right: "Bills",
    line: "KC −3.0",
    score: { left: 20, right: 23 },
    atsWinner: "right",
    pickers: { left: ["Tyler"], right: [] },
  },
  {
    id: "pit-bal",
    kickoff: "Sun 1:00 PM ET",
    finalDate: "9/27",
    left: "Ravens",
    right: "Steelers",
    line: "BAL −4.5",
    score: { left: 27, right: 20 },
    atsWinner: "left",
    pickers: { left: [], right: ["Gary"] },
  },
  {
    id: "sf-lar",
    kickoff: "Sun 4:25 PM ET",
    finalDate: "9/27",
    left: "49ers",
    right: "Rams",
    line: "SF −2.5",
    score: { left: 21, right: 28 },
    atsWinner: "right",
    pickers: { left: [], right: [] },
  },
  {
    id: "dal-phi",
    kickoff: "Sun 8:20 PM ET",
    finalDate: "9/27",
    left: "Eagles",
    right: "Cowboys",
    line: "PHI −3.5",
    score: { left: 30, right: 21 },
    atsWinner: "left",
    pickers: { left: ["Zac"], right: [] },
  },
  {
    id: "det-gb",
    kickoff: "Mon 8:15 PM ET",
    finalDate: "9/28",
    left: "Lions",
    right: "Packers",
    line: "DET −1.5",
    score: { left: 17, right: 24 },
    atsWinner: "right",
    pickers: { left: [], right: [] },
  },
];

const scenarios: Record<string, Scenario> = {
  open: {
    title: "Week 4 · Saturday rehearsal",
    timing: "Saturday · 3:00 PM ET",
    explanation:
      "Three weeks are in the books. Week 4 is open, with the London kickoff clearly called out before the regular Sunday slate.",
    activeGames: [],
    lockedGames: [],
    finalGames: [],
    final: false,
  },
  sunday: {
    title: "Week 4 · Sunday afternoon",
    timing: "Sunday · 3:00 PM ET",
    explanation:
      "All Sunday lines locked at 8 AM ET and are teal. London is final, the 1 PM games are live, and late games remain open.",
    activeGames: [0, 1, 2],
    lockedGames: [0, 1, 2, 3, 4],
    finalGames: [0],
    final: false,
  },
  final: {
    title: "Week 4 · Final scores posted",
    timing: "Tuesday · 9:00 AM ET",
    explanation:
      "Every game is final. Scores, ATS W/L marks, and the names behind each selection remain visible for a clean audit.",
    activeGames: [0, 1, 2, 3, 4, 5],
    lockedGames: [0, 1, 2, 3, 4, 5],
    finalGames: [0, 1, 2, 3, 4, 5],
    final: true,
  },
};

const priorWins: Record<string, number> = { Tyler: 4, Zac: 3, Gary: 3 };
const playerSelections: Record<string, Array<Side | null>> = {
  Tyler: ["left", "left", null, null, null, null],
  Zac: ["right", null, null, null, "left", null],
  Gary: ["left", null, "right", null, null, null],
};

function resultFor(game: RehearsalGame, side: Side, gameFinal: boolean): Result {
  if (!gameFinal) return null;
  return game.atsWinner === side ? "win" : "loss";
}

const rehearsalKickoffs = [
  "2026-09-27T13:30:00Z",
  "2026-09-27T17:00:00Z",
  "2026-09-27T17:00:00Z",
  "2026-09-27T20:25:00Z",
  "2026-09-28T00:20:00Z",
  "2026-09-29T00:15:00Z",
];

function rehearsalSlateGame(game: RehearsalGame, index: number, scenario: Scenario): SlateGameRowData {
  const final = scenario.finalGames.includes(index);
  const live = scenario.activeGames.includes(index) && !final;
  const locked = scenario.lockedGames.includes(index);
  const spread = Number(game.line.replace(/[^0-9.]/g, ""));

  return {
    id: game.id,
    kickoffAt: rehearsalKickoffs[index],
    lineLockAt: index === 0 ? "2026-09-26T22:00:00Z" : "2026-09-27T12:00:00Z",
    isInternational: index === 0,
    status: final ? "final" : live ? "live" : "scheduled",
    awayTeam: game.right,
    homeTeam: game.left,
    awayTeamId: `${game.id}-away`,
    homeTeamId: `${game.id}-home`,
    favoriteTeamId: `${game.id}-home`,
    officialSpread: locked ? spread : null,
    preliminarySpread: locked ? null : spread,
    awayScore: final ? game.score.right : null,
    homeScore: final ? game.score.left : null,
    awayResult: final ? resultFor(game, "right", true) : null,
    homeResult: final ? resultFor(game, "left", true) : null,
    awayPickers: final || live ? game.pickers.right : [],
    homePickers: final || live ? game.pickers.left : [],
  };
}

function rehearsalScoreboardRows(scenario: Scenario): PickemScoreboardRow[] {
  return Object.keys(priorWins).map((name) => {
    const selections = playerSelections[name];
    const picks = selections.map((selection, index) => {
      if (!selection) return { label: null, isHidden: false, resultMark: "" };
      const game = games[index];
      const started = scenario.activeGames.includes(index) || scenario.finalGames.includes(index);
      const visible = name === "Tyler" || started;
      const spread = Number(game.line.replace(/[^0-9.]/g, ""));
      return {
        label: visible ? (selection === "left" ? game.left : game.right) : null,
        isHidden: !visible,
        resultMark: scenario.final ? resultFor(game, selection, true) ?? "" : "",
        spread: visible ? `${selection === "left" ? "-" : "+"}${spread.toFixed(1)}` : null,
        isLineLocked: scenario.lockedGames.includes(index),
      };
    });
    const weekWins = countPickemWins(games.map((game, index) => ({ result: selections[index] ? resultFor(game, selections[index]!, scenario.final) : null })));
    return { id: name.toLowerCase(), firstName: name, wins: priorWins[name] + weekWins, picks };
  }).sort((a, b) => b.wins - a.wins || a.firstName.localeCompare(b.firstName));
}

function ResultMark({ result }: { result: Result }) {
  if (!result) return null;
  return <strong className={`relative -top-1 -ml-px inline-block -rotate-[10deg] ${result === "win" ? "text-green-700" : "text-red-700"}`}>{result === "win" ? "W" : "L"}</strong>;
}

export default function PreviewPage() {
  const [scenarioKey, setScenarioKey] = useState("open");
  const [showStandings, setShowStandings] = useState(false);
  const scenario = scenarios[scenarioKey];
  const rehearsalRows = rehearsalScoreboardRows(scenario);
  const standings = Object.keys(priorWins).map((name) => {
    const weeklyPicks = playerSelections[name];
    const weekWins = countPickemWins(
      games.map((game, index) => ({ result: weeklyPicks[index] ? resultFor(game, weeklyPicks[index], scenario.final) : null })),
    );
    return { name, priorWins: priorWins[name], weekWins, total: priorWins[name] + weekWins };
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return (
    <main className="min-h-screen bg-[#e9e2d3] pb-8 text-[#171719]">
      <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 py-5 sm:px-5 sm:py-8 md:px-10">
        <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10">
          <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_33rem] md:gap-8">
            <div className="min-w-0">
              <h1 className="font-serif text-3xl font-bold sm:text-4xl">{showStandings ? "Lead Pipe Locks" : "The Slate"}</h1>
              <label className="mt-4 block text-xs font-bold tracking-[0.16em] text-slate-600" htmlFor="rehearsal-scenario">VIEW REHEARSAL</label>
              <select className="mt-1 border border-[#1d1d1f] bg-white px-3 py-1.5 text-sm font-semibold text-[#171719]" id="rehearsal-scenario" onChange={(event) => setScenarioKey(event.target.value)} value={scenarioKey}>
                <option value="open">Week 4 · Saturday before kickoff</option>
                <option value="sunday">Week 4 · Sunday 3 PM ET</option>
                <option value="final">Week 4 · Final scores posted</option>
              </select>
              <button className="ml-3 text-sm font-semibold underline" onClick={() => setShowStandings((current) => !current)} type="button">{showStandings ? "View rehearsal Slate" : "View rehearsal Standings"}</button>
            </div>
            <aside className="border-t border-[#b7aea0] pt-4 text-left text-xs leading-5 text-slate-700 md:self-stretch md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <p className="font-bold tracking-[0.12em] text-[#171719]">HOW TO PLAY</p>
              <div className="mt-2 grid gap-3 border-t border-[#b7aea0] pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] sm:gap-5">
                <div><p>Lines lock at 8 AM ET on gameday, unless otherwise noted.</p><p className="mt-1"><span className="font-semibold text-[#00756e]">Teal lines</span> are official and will not change.</p></div>
                <div className="border-t border-[#b7aea0] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0"><p>Favorites left; home team ALL CAPS.</p><p className="mt-1">Choose TWO teams and click Save below.</p><p className="mt-1">Changes allowed until kickoff time.</p></div>
              </div>
              <p className="mt-3 border-t border-[#b7aea0] pt-3 font-semibold">EARLY GAME: London kickoff is Sunday at 9:30 AM ET.</p>
            </aside>
          </div>
        </header>

        <section className="mt-5 border-l-4 border-green-800 bg-[#edf7ef] px-4 py-3 text-green-950">
          <p className="font-bold">Rehearsal only · no live records are involved.</p>
          <p className="mt-1 text-sm">{scenario.timing} — {scenario.explanation}</p>
        </section>

        {!showStandings ? <div className="mx-auto mt-5 w-full max-w-4xl space-y-6 sm:mt-8 sm:space-y-9"><section aria-labelledby="slate-heading">
          <div className="border-y-2 border-[#1d1d1f] px-3 py-2 text-center"><h2 className="text-xs font-black tracking-[0.18em] text-[#171719] sm:text-sm" id="slate-heading">SUNDAY · WEEK 4 ATS SLATE</h2></div>

          <div>{games.map((game, index) => (
            <SlateGameRow
              alternate={index % 2 === 0}
              game={rehearsalSlateGame(game, index, scenario)}
              hasStarted={scenario.activeGames.includes(index) || scenario.finalGames.includes(index)}
              key={game.id}
            />
          ))}</div>
          {false ? <><div>{games.map((game, index) => {
            const gameStarted = scenario.activeGames.includes(index);
            const started = scenario.lockedGames.includes(index);
            const gameFinal = scenario.finalGames.includes(index);
            const leftResult = resultFor(game, "left", gameFinal);
            const rightResult = resultFor(game, "right", gameFinal);
            return <article className={`grid grid-cols-[4.25rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)] items-center gap-2 border-b border-[#c8c1b5] py-3 pl-1 pr-3 sm:grid-cols-[7rem_minmax(0,1fr)_7rem_minmax(0,1fr)] sm:gap-4 sm:pl-2 sm:pr-4 ${index % 2 === 1 ? "bg-[#eee4d1]" : "bg-[#fffdf8]"}`} key={game.id}>
              <div className="text-center text-[10px] font-bold leading-4 text-slate-600 sm:text-xs">{gameFinal ? <p className="font-mono font-bold text-slate-700">{game.finalDate}</p> : index === 0 ? <><p>Sun 9:30 AM ET</p><p>📍 London</p>{gameStarted ? <p className="mt-1 text-[8px] font-black tracking-[0.1em] text-red-700">LIVE</p> : null}</> : <><p>{game.kickoff}</p>{gameStarted ? <p className="mt-1 text-[8px] font-black tracking-[0.1em] text-red-700">LIVE</p> : null}</>}</div>
              <TeamCell team={game.left} score={gameFinal ? game.score.left : null} result={leftResult} pickers={gameStarted ? game.pickers.left : []} align="left" />
              <div className={`text-center font-mono text-sm font-black sm:text-base ${started ? "text-teal-700" : "text-zinc-900"}`}><p>{game.line}</p>{index === 0 && !started ? <p className="mt-1 whitespace-nowrap text-[7px] font-black leading-3 tracking-[-0.02em] text-teal-700">LOCKS 9/26 · 6 PM ET</p> : null}</div>
              <TeamCell team={game.right} score={gameFinal ? game.score.right : null} result={rightResult} pickers={gameStarted ? game.pickers.right : []} align="right" />
            </article>;
          })}</div></> : null}
        </section></div> : <section className="mx-auto mt-5 w-full max-w-4xl sm:mt-8" aria-labelledby="standings-heading">
          <PickemScoreboard maxPicks={2} rows={rehearsalRows} viewerPlayerId="tyler" />
          {false ? <>
          <div className="flex items-end justify-between border-y-2 border-[#1d1d1f] px-1 py-3 sm:px-3"><div><p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-600">Lead Pipe Locks</p><h2 className="font-serif text-3xl font-black" id="standings-heading">Through Week {scenario.final ? "4" : "3"}</h2></div><p className="text-right text-xs text-slate-600">Weeks 1–3 are simulated.<br />Week 4 adds only when final.</p></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[38rem] border-collapse text-left"><thead><tr className="border-b-2 border-[#1d1d1f] text-[11px] font-black uppercase tracking-[0.14em] text-slate-600"><th className="px-3 py-3">Rank</th><th className="px-3 py-3">Player</th><th className="px-3 py-3 text-center">Wk 1–3</th><th className="px-3 py-3 text-center">Wk 4</th><th className="px-3 py-3 text-center">Total wins</th><th className="px-3 py-3">Week 4 receipt</th></tr></thead><tbody>{standings.map((row, index) => <tr className={`border-b border-[#c8c1b5] ${row.name === "Tyler" ? "bg-[#fffaf0]" : index % 2 ? "bg-[#f0eadc]" : ""}`} key={row.name}><td className="px-3 py-4 font-serif text-xl">{index + 1}</td><td className="px-3 py-4 font-serif text-xl">{row.name}</td><td className="px-3 py-4 text-center font-bold">{row.priorWins}</td><td className="px-3 py-4 text-center font-bold">{scenario.final ? row.weekWins : "—"}</td><td className="px-3 py-4 text-center font-serif text-xl font-bold">{row.total}</td><td className="px-3 py-4 text-sm">{scenario.final ? <WeekReceipt name={row.name} /> : <span className="text-slate-500">Picks reveal at each kickoff</span>}</td></tr>)}</tbody></table></div>
          </> : null}
        </section>}

        <p className="mx-auto mt-7 max-w-4xl border-t border-[#b9b09d] pt-4 text-xs leading-5 text-slate-600">Rehearsal integrity check: Week 4 totals are calculated from only the displayed final W marks—never from the number of submitted picks. This page is sample data only.</p>
      </div>
    </main>
  );
}

function TeamCell({ team, score, result, pickers, align }: { team: string; score: number | null; result: Result; pickers: string[]; align: "left" | "right" }) {
  return <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}><p className="text-sm font-bold leading-tight sm:text-base">{team}<ResultMark result={result} />{score !== null ? <span className="ml-1 font-mono">{score}</span> : null}</p>{pickers.length ? <p className="mt-1 text-[11px] leading-4 text-slate-600">Picked by {pickers.join(", ")}</p> : null}</div>;
}

function WeekReceipt({ name }: { name: string }) {
  const selections = playerSelections[name];
  return <span className="text-slate-700">{games.map((game, index) => {
    const selection = selections[index];
    if (!selection) return null;
    return <span className="mr-3 inline-block" key={game.id}>{selection === "left" ? game.left : game.right}<ResultMark result={resultFor(game, selection, true)} /></span>;
  })}</span>;
}
