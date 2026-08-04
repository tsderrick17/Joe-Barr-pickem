"use client";

import { useMemo, useState } from "react";
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

type PlayerSelections = Record<string, Array<Side | null>>;

type Scenario = {
  title: string;
  timing: string;
  explanation: string;
  activeGames: number[];
  lockedGames: number[];
  finalGames: number[];
  final: boolean;
  isPlayoff?: boolean;
  maxPicks: number;
  emailTitle: string;
  emailCopy: string;
  selections: PlayerSelections;
};

const games: RehearsalGame[] = [
  { id: "jax-chi", kickoff: "Sun 9:30 AM ET - London", finalDate: "9/27", left: "Jaguars", right: "Bears", line: "JAX -2.5", score: { left: 24, right: 17 }, atsWinner: "left", pickers: { left: ["Tyler", "Gary"], right: ["Zac"] } },
  { id: "kc-buf", kickoff: "Sun 1:00 PM ET", finalDate: "9/27", left: "Chiefs", right: "Bills", line: "KC -3.0", score: { left: 20, right: 23 }, atsWinner: "right", pickers: { left: ["Tyler"], right: [] } },
  { id: "pit-bal", kickoff: "Sun 1:00 PM ET", finalDate: "9/27", left: "Ravens", right: "Steelers", line: "BAL -4.5", score: { left: 27, right: 20 }, atsWinner: "left", pickers: { left: [], right: ["Gary"] } },
  { id: "sf-lar", kickoff: "Sun 4:25 PM ET", finalDate: "9/27", left: "49ers", right: "Rams", line: "SF -2.5", score: { left: 21, right: 28 }, atsWinner: "right", pickers: { left: [], right: [] } },
  { id: "dal-phi", kickoff: "Sun 8:20 PM ET", finalDate: "9/27", left: "Eagles", right: "Cowboys", line: "PHI -3.5", score: { left: 30, right: 21 }, atsWinner: "left", pickers: { left: ["Zac"], right: [] } },
  { id: "det-gb", kickoff: "Mon 8:15 PM ET", finalDate: "9/28", left: "Lions", right: "Packers", line: "DET -1.5", score: { left: 17, right: 24 }, atsWinner: "right", pickers: { left: [], right: [] } },
];

const priorWins: Record<string, number> = { Tyler: 4, Zac: 3, Gary: 3 };

const regularSelections: PlayerSelections = {
  Tyler: ["left", "left", null, null, null, null],
  Zac: ["right", null, null, null, "left", null],
  Gary: ["left", null, "right", null, null, null],
};

const playoffSelections: PlayerSelections = {
  Tyler: ["left", "right", "left", "right", "left", "right"],
  Zac: ["right", "right", "left", "left", "right", "right"],
  Gary: ["left", "left", "right", "right", "left", "left"],
};

const scenarios: Record<string, Scenario> = {
  saturday: {
    title: "Week 4 - Saturday before kickoff",
    timing: "Saturday - 3:00 PM ET",
    explanation: "Three weeks are in the books. Week 4 is open; the London game carries its earlier official-line deadline.",
    activeGames: [], lockedGames: [], finalGames: [], final: false, maxPicks: 2,
    emailTitle: "Week 4 is open", emailCopy: "The fresh Slate email shows every preliminary line and sends players directly to their picks.", selections: regularSelections,
  },
  sunday: {
    title: "Week 4 - Sunday afternoon",
    timing: "Sunday - 3:00 PM ET",
    explanation: "All Sunday lines are official. London is final, the 1 PM window is live and public, and later games remain editable.",
    activeGames: [0, 1, 2], lockedGames: [0, 1, 2, 3, 4], finalGames: [0], final: false, maxPicks: 2,
    emailTitle: "Sunday public-pick window", emailCopy: "The reveal email contains the live public receipt only after kickoff, so no player sees a pick early.", selections: regularSelections,
  },
  final: {
    title: "Week 4 - Monday final",
    timing: "Tuesday - 9:00 AM ET",
    explanation: "Every score is final. W/L stamps and the public record remain visible permanently for an easy audit.",
    activeGames: [0, 1, 2, 3, 4, 5], lockedGames: [0, 1, 2, 3, 4, 5], finalGames: [0, 1, 2, 3, 4, 5], final: true, maxPicks: 2,
    emailTitle: "Week 4 recap", emailCopy: "The recap links to the finished Pick'em Pad, shows only players who began the week eligible, and includes Survivor only while it is still active.", selections: regularSelections,
  },
  playoff: {
    title: "Wild Card - Sunday afternoon",
    timing: "Wild Card Sunday - 3:00 PM ET",
    explanation: "Six games are in the round. Players may prepare every available selection early; only started games are sealed, revealed, and eligible for scoring.",
    activeGames: [0, 1, 2], lockedGames: [0, 1, 2], finalGames: [0], final: false, isPlayoff: true, maxPicks: 6,
    emailTitle: "Wild Card public-pick window", emailCopy: "The playoff reveal uses the same privacy gate: only games that have started are public, while later-day picks remain private and editable.", selections: playoffSelections,
  },
};

const rehearsalKickoffs = [
  "2026-09-27T13:30:00Z", "2026-09-27T17:00:00Z", "2026-09-27T17:00:00Z",
  "2026-09-27T20:25:00Z", "2026-09-28T00:20:00Z", "2026-09-29T00:15:00Z",
];

const abbreviations: Record<string, string> = {
  Bears: "CHI", Bills: "BUF", Chiefs: "KC", Cowboys: "DAL", Eagles: "PHI", Jaguars: "JAX",
  Lions: "DET", Packers: "GB", Rams: "LAR", Ravens: "BAL", Steelers: "PIT", "49ers": "SF",
};

function resultFor(game: RehearsalGame, side: Side, gameFinal: boolean): Result {
  if (!gameFinal) return null;
  return game.atsWinner === side ? "win" : "loss";
}

function rehearsalSlateGame(game: RehearsalGame, index: number, scenario: Scenario): SlateGameRowData {
  const final = scenario.finalGames.includes(index);
  const live = scenario.activeGames.includes(index) && !final;
  const locked = scenario.lockedGames.includes(index);
  const spread = Number(game.line.replace(/[^0-9.]/g, ""));
  return {
    id: game.id, kickoffAt: rehearsalKickoffs[index], lineLockAt: index === 0 ? "2026-09-26T22:00:00Z" : "2026-09-27T12:00:00Z",
    isInternational: index === 0, status: final ? "final" : live ? "live" : "scheduled",
    awayTeam: game.right, homeTeam: game.left, awayTeamAbbreviation: abbreviations[game.right], homeTeamAbbreviation: abbreviations[game.left],
    awayTeamId: `${game.id}-away`, homeTeamId: `${game.id}-home`, favoriteTeamId: `${game.id}-home`,
    officialSpread: locked ? spread : null, preliminarySpread: locked ? null : spread,
    awayScore: final ? game.score.right : null, homeScore: final ? game.score.left : null,
    awayResult: final ? resultFor(game, "right", true) : null, homeResult: final ? resultFor(game, "left", true) : null,
    awayPickers: final || live ? game.pickers.right : [], homePickers: final || live ? game.pickers.left : [],
  };
}

function rehearsalScoreboardRows(scenario: Scenario): PickemScoreboardRow[] {
  return Object.keys(priorWins).map((name) => {
    const selections = scenario.selections[name];
    const picks = Array.from({ length: scenario.maxPicks }, (_, index) => {
      const selection = selections[index] ?? null;
      if (!selection) return { label: null, isHidden: false, resultMark: "" };
      const game = games[index];
      const started = scenario.activeGames.includes(index) || scenario.finalGames.includes(index);
      const visible = name === "Tyler" || started;
      const spread = Number(game.line.replace(/[^0-9.]/g, ""));
      const label = selection === "left" ? game.left : game.right;
      return {
        label: visible ? label : null,
        abbreviation: abbreviations[label],
        isHidden: !visible,
                resultMark: scenario.finalGames.includes(index)
                  ? resultFor(game, selection, true) ?? ""
                  : "",
        spread: visible ? `${selection === "left" ? "-" : "+"}${spread.toFixed(1)}` : null,
        isLineLocked: scenario.lockedGames.includes(index),
      };
    });
    const weekWins = countPickemWins(games.map((game, index) => ({ result: selections[index] ? resultFor(game, selections[index]!, scenario.finalGames.includes(index)) : null })));
    return { id: name.toLowerCase(), firstName: name, wins: priorWins[name] + weekWins, picks };
  }).sort((a, b) => b.wins - a.wins || a.firstName.localeCompare(b.firstName));
}

function EmailPreview({ scenario }: { scenario: Scenario }) {
  const isReveal = scenario.title.includes("Sunday");
  return <section className="mx-auto mt-6 max-w-xl border border-[#c8c1b5] bg-white p-5 shadow-sm sm:mt-8 sm:p-8">
    <p className="text-[10px] font-black tracking-[0.18em] text-slate-600">EMAIL PREVIEW - NEVER SENT</p>
    <p className="mt-4 text-xs font-bold tracking-[0.12em] text-slate-600">JOE BARR MEMORIAL PICK&apos;EM</p>
    <h2 className="mt-2 font-serif text-3xl font-bold text-[#171719]">{scenario.emailTitle}</h2>
    <p className="mt-4 text-base leading-7 text-slate-700">{scenario.emailCopy}</p>
    <div className="mt-6 border-y border-[#c8c1b5] bg-[#f4ede1] px-4 py-4 text-sm leading-6 text-slate-700">
      <p className="font-bold text-[#171719]">What the player receives</p>
      <p className="mt-1">{isReveal ? "A public Pick'em receipt for started games, with every later game still hidden." : scenario.final ? "A final Pad snapshot with W/L stamps, standings movement, and an audit-safe link back to the pool." : "A current Slate snapshot and one clear button to review or make selections."}</p>
    </div>
    <a className="mt-6 inline-block bg-[#007e72] px-4 py-3 text-sm font-bold text-white" href="/board">Open Pick&apos;em</a>
    <p className="mt-6 text-xs leading-5 text-slate-500">This preview is sample content. It does not create a reminder, email a player, or expose a private pick.</p>
  </section>;
}

export default function PreviewPage() {
  const [scenarioKey, setScenarioKey] = useState("saturday");
  const [view, setView] = useState<"slate" | "pad" | "email">("slate");
  const scenario = scenarios[scenarioKey];
  const rows = useMemo(() => rehearsalScoreboardRows(scenario), [scenario]);

  return <main className="min-h-screen bg-[#e9e2d3] pb-8 text-[#171719]">
    <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 py-5 sm:px-5 sm:py-8 md:px-10">
      <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_33rem] md:gap-8">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.18em] text-slate-600">SAFE PLAYER WALKTHROUGH</p>
            <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">{view === "slate" ? "The Slate" : view === "pad" ? "Pick'em Pad" : "Email preview"}</h1>
            <label className="mt-4 block text-xs font-bold tracking-[0.16em] text-slate-600" htmlFor="rehearsal-scenario">VIEW REHEARSAL</label>
            <select className="mt-1 border border-[#1d1d1f] bg-white px-3 py-1.5 text-sm font-semibold text-[#171719]" id="rehearsal-scenario" onChange={(event) => setScenarioKey(event.target.value)} value={scenarioKey}>
              <option value="saturday">Week 4 - Saturday before kickoff</option>
              <option value="sunday">Week 4 - Sunday 3 PM ET</option>
              <option value="final">Week 4 - Monday final</option>
              <option value="playoff">Wild Card Sunday - partial locks</option>
            </select>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Rehearsal view">
              {(["slate", "pad", "email"] as const).map((option) => <button className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] ${view === option ? "border-[#007e72] bg-[#007e72] text-white" : "border-[#1d1d1f] bg-white text-[#171719]"}`} key={option} onClick={() => setView(option)} type="button">{option === "pad" ? "Pick'em Pad" : option === "email" ? "Email" : "Slate"}</button>)}
            </div>
          </div>
          <aside className="border-t border-[#b7aea0] pt-4 text-left text-xs leading-5 text-slate-700 md:self-stretch md:border-l md:border-t-0 md:pl-6 md:pt-0">
            <p className="font-bold tracking-[0.12em] text-[#171719]">WHAT THIS CHECKS</p>
            <div className="mt-2 grid gap-3 border-t border-[#b7aea0] pt-3 sm:grid-cols-2 sm:gap-5">
              <p>Privacy at kickoff, official line locks, visible public receipts, final-score W/L marks, and historical audit views.</p>
              <p className="border-t border-[#b7aea0] pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">The playoff rehearsal tests six selections in one round while preserving the rule that only started games are sealed.</p>
            </div>
          </aside>
        </div>
      </header>

      <section className="mt-5 border-l-4 border-green-800 bg-[#edf7ef] px-4 py-3 text-green-950">
        <p className="font-bold">Rehearsal only - no live records are involved.</p>
        <p className="mt-1 text-sm">{scenario.timing} - {scenario.explanation}</p>
      </section>

      {view === "slate" ? <section className="mx-auto mt-5 w-full max-w-4xl sm:mt-8" aria-labelledby="slate-heading">
        <div className="border-y-2 border-[#1d1d1f] px-3 py-2 text-center"><h2 className="text-xs font-black tracking-[0.18em] text-[#171719] sm:text-sm" id="slate-heading">{scenario.isPlayoff ? "WILD CARD ROUND - ATS SLATE" : "SUNDAY - WEEK 4 ATS SLATE"}</h2></div>
        <div>{games.map((game, index) => <SlateGameRow alternate={index % 2 === 0} game={rehearsalSlateGame(game, index, scenario)} hasStarted={scenario.activeGames.includes(index) || scenario.finalGames.includes(index)} key={game.id} />)}</div>
      </section> : null}

      {view === "pad" ? <section className="mx-auto mt-5 w-full max-w-4xl sm:mt-8" aria-label="Rehearsal Pick'em Pad">
        <PickemScoreboard isPlayoff={scenario.isPlayoff} maxPicks={scenario.maxPicks} rows={rows} viewerPlayerId="tyler" week={scenario.isPlayoff ? "Wild Card round" : "Week 4"} />
        <p className="mt-4 border-t border-[#b9b09d] pt-4 text-xs leading-5 text-slate-600">The rehearsal calculates wins from final W marks only. A submitted pick is never treated as a win before its game is final.</p>
      </section> : null}

      {view === "email" ? <EmailPreview scenario={scenario} /> : null}
    </div>
  </main>;
}
