"use client";

import { useMemo, useState } from "react";
import MyTicket, { type TicketPick } from "@/components/my-ticket";
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
  week: string;
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
  emailImage: "slate" | "reveal" | "recap";
  selections: PlayerSelections;
  survivorSelection?: { gameIndex: number; side: Side } | null;
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

const blankSelections: PlayerSelections = {
  Tyler: [null, null, null, null, null, null],
  Zac: [null, null, null, null, null, null],
  Gary: [null, null, null, null, null, null],
};

const scenarios: Record<string, Scenario> = {
  open: {
    title: "Week 4 - fresh ticket",
    week: "Week 4",
    timing: "Wednesday - 3:05 AM ET",
    explanation: "Week 4 has just become active. The Slate and ticket move together; the new ticket is blank until Tyler saves selections.",
    activeGames: [], lockedGames: [], finalGames: [], final: false, maxPicks: 2,
    emailTitle: "Week 4 is open", emailCopy: "The fresh Slate email shows the current preliminary lines and sends players directly to their new ticket.", emailImage: "slate", selections: blankSelections, survivorSelection: null,
  },
  saturday: {
    title: "Week 4 - Saturday before kickoff",
    week: "Week 4",
    timing: "Saturday - 3:00 PM ET",
    explanation: "Three weeks are in the books. Week 4 is open; the London game carries its earlier official-line deadline.",
    activeGames: [], lockedGames: [], finalGames: [], final: false, maxPicks: 2,
    emailTitle: "Week 4 is open", emailCopy: "The fresh Slate email shows every preliminary line and sends players directly to their picks.", emailImage: "slate", selections: regularSelections, survivorSelection: { gameIndex: 0, side: "left" },
  },
  sunday: {
    title: "Week 4 - Sunday afternoon",
    week: "Week 4",
    timing: "Sunday - 3:00 PM ET",
    explanation: "All Sunday lines are official. London is final, the 1 PM window is live and public, and later games remain editable.",
    activeGames: [0, 1, 2], lockedGames: [0, 1, 2, 3, 4], finalGames: [0], final: false, maxPicks: 2,
    emailTitle: "Sunday public-pick window", emailCopy: "The reveal email contains the live public receipt only after kickoff, so no player sees a pick early.", emailImage: "reveal", selections: regularSelections, survivorSelection: { gameIndex: 0, side: "left" },
  },
  final: {
    title: "Week 4 - Monday final",
    week: "Week 4",
    timing: "Tuesday - 9:00 AM ET",
    explanation: "Every score is final. W/L stamps and the public record remain visible permanently for an easy audit.",
    activeGames: [0, 1, 2, 3, 4, 5], lockedGames: [0, 1, 2, 3, 4, 5], finalGames: [0, 1, 2, 3, 4, 5], final: true, maxPicks: 2,
    emailTitle: "Week 4 recap", emailCopy: "The recap links to the finished Pick'em Pad, shows only players who began the week eligible, and includes Survivor only while it is still active.", emailImage: "recap", selections: regularSelections, survivorSelection: { gameIndex: 0, side: "left" },
  },
  handoff: {
    title: "Week 5 - safe handoff",
    week: "Week 5",
    timing: "Wednesday - 3:05 AM ET",
    explanation: "Week 4 is complete and preserved in the historical Pad. One atomic handoff activates Week 5, so both the Slate and the personal ticket now show a fresh Week 5 together.",
    activeGames: [], lockedGames: [], finalGames: [], final: false, maxPicks: 2,
    emailTitle: "Week 5 is open", emailCopy: "The next Slate is announced only after Week 5 is active and its schedule is loaded.", emailImage: "slate", selections: blankSelections, survivorSelection: null,
  },
  playoff: {
    title: "Wild Card - Sunday afternoon",
    week: "Wild Card round",
    timing: "Wild Card Sunday - 3:00 PM ET",
    explanation: "Six games are in the round. Players may prepare every available selection early; only started games are sealed, revealed, and eligible for scoring.",
    activeGames: [0, 1, 2], lockedGames: [0, 1, 2], finalGames: [0], final: false, isPlayoff: true, maxPicks: 6,
    emailTitle: "Wild Card public-pick window", emailCopy: "The playoff reveal uses the same privacy gate: only games that have started are public, while later-day picks remain private and editable.", emailImage: "reveal", selections: playoffSelections,
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

function rehearsalTicketPicks(scenario: Scenario): TicketPick[] {
  return scenario.selections.Tyler.flatMap((selection, index) => {
    if (!selection || index >= scenario.maxPicks) return [];
    const game = games[index];
    const label = selection === "left" ? game.left : game.right;
    const spread = Number(game.line.replace(/[^0-9.]/g, ""));
    return [{
      gameId: game.id,
      team: label,
      kickoff: game.kickoff,
      spread: `${selection === "left" ? "-" : "+"}${spread.toFixed(1)}`,
      lineLocked: scenario.lockedGames.includes(index),
      resultMark: scenario.finalGames.includes(index) ? (resultFor(game, selection, true) === "win" ? "W" : "L") : "",
    } satisfies TicketPick];
  });
}

function rehearsalSurvivorPick(scenario: Scenario) {
  if (!scenario.survivorSelection || scenario.isPlayoff) return null;
  const { gameIndex, side } = scenario.survivorSelection;
  const game = games[gameIndex];
  const team = side === "left" ? game.left : game.right;
  const straightUpWinner = game.score.left > game.score.right ? "left" : "right";
  return {
    abbreviation: abbreviations[team],
    team,
    kickoff: game.kickoff,
    resultMark: scenario.finalGames.includes(gameIndex) ? (side === straightUpWinner ? "W" as const : "L" as const) : "" as const,
  };
}

function EmailSampleImage({ rows, scenario }: { rows: PickemScoreboardRow[]; scenario: Scenario }) {
  if (scenario.emailImage === "slate") {
    return <div aria-label="Sample Slate image included in this email" className="mt-6 overflow-hidden border border-[#b7aea0] bg-[#fffdf8]" role="img">
      <div className="flex items-end justify-between border-b-2 border-[#171719] px-4 py-3">
        <strong className="font-serif text-xl">The Slate</strong>
        <span className="text-[10px] font-black tracking-[0.14em] text-slate-600">PRELIMINARY LINES</span>
      </div>
      {games.slice(0, 4).map((game, index) => <div className={`grid grid-cols-[4.8rem_1fr_auto_1fr] items-center gap-2 border-b border-[#d8cfbf] px-3 py-2 text-[11px] ${index % 2 === 0 ? "bg-[#f0e5cf]" : ""}`} key={game.id}>
        <span className="font-bold text-slate-500">{game.kickoff.replace(" ET", "")}</span><strong>{game.right}</strong><strong className="font-mono">{game.line}</strong><strong className="text-right">{game.left}</strong>
      </div>)}
      <p className="px-4 py-3 text-[10px] font-bold text-slate-500">SAMPLE IMAGE · CURRENT LINES MAY MOVE BEFORE OFFICIAL LOCK</p>
    </div>;
  }

  const publicRows = rows.map((row) => ({ ...row, picks: row.picks.filter((pick) => pick.label && !pick.isHidden) })).filter((row) => scenario.emailImage === "recap" || row.picks.length > 0);
  return <div aria-label={`Sample ${scenario.emailImage === "recap" ? "final recap" : "public picks"} image included in this email`} className="mt-6 overflow-hidden border border-[#b7aea0] bg-[#fffaf0]" role="img">
    <div className="flex items-end justify-between border-b-2 border-[#171719] px-4 py-3">
      <strong className="font-serif text-xl">Pick&apos;em Pad</strong>
      <span className="text-[10px] font-black tracking-[0.14em] text-[#008c82]">{scenario.emailImage === "recap" ? "FINAL RESULTS" : "PUBLIC RECEIPTS"}</span>
    </div>
    {publicRows.map((row) => <div className="grid grid-cols-[2rem_5rem_1fr] items-center border-b border-[#9cc6ea] px-3 py-2 text-xs" key={row.id}>
      <strong className="text-right">{row.wins}</strong><strong className="border-l-2 border-[#d56b66] pl-2 font-serif">{row.firstName}</strong><span className="font-semibold text-slate-700">{row.picks.map((pick) => `${pick.label} ${pick.spread ?? ""}${pick.resultMark === "win" ? " W" : pick.resultMark === "loss" ? " L" : ""}`).join(" · ") || "—"}</span>
    </div>)}
    <p className="px-4 py-3 text-[10px] text-slate-500">SAMPLE IMAGE · {scenario.emailImage === "recap" ? "FINAL W/L STAMPS REMAIN MEMORIALIZED" : "FUTURE SELECTIONS REMAIN PRIVATE"}</p>
  </div>;
}

function EmailPreview({ rows, scenario }: { rows: PickemScoreboardRow[]; scenario: Scenario }) {
  const isReveal = scenario.emailImage === "reveal";
  return <section className="mx-auto mt-6 max-w-xl border border-[#c8c1b5] bg-white p-5 shadow-sm sm:mt-8 sm:p-8">
    <p className="text-[10px] font-black tracking-[0.18em] text-slate-600">EMAIL PREVIEW - NEVER SENT</p>
    <p className="mt-4 text-xs font-bold tracking-[0.12em] text-slate-600">JOE BARR MEMORIAL PICK&apos;EM</p>
    <h2 className="mt-2 font-serif text-3xl font-bold text-[#171719]">{scenario.emailTitle}</h2>
    <p className="mt-4 text-base leading-7 text-slate-700">{scenario.emailCopy}</p>
    <EmailSampleImage rows={rows} scenario={scenario} />
    <div className="mt-6 border-y border-[#c8c1b5] bg-[#f4ede1] px-4 py-4 text-sm leading-6 text-slate-700">
      <p className="font-bold text-[#171719]">What the player receives</p>
      <p className="mt-1">{isReveal ? "A public Pick'em receipt for started games, with every later game still hidden." : scenario.final ? "A final Pad snapshot with W/L stamps, standings movement, and an audit-safe link back to the pool." : "A current Slate snapshot and one clear button to review or make selections."}</p>
    </div>
    <a className="mt-6 inline-block bg-[#007e72] px-4 py-3 text-sm font-bold text-white" href="/board">Open Pick&apos;em</a>
    <p className="mt-6 text-xs leading-5 text-slate-500">This preview is sample content. It does not create a reminder, email a player, or expose a private pick.</p>
  </section>;
}

export default function PreviewPage() {
  const [scenarioKey, setScenarioKey] = useState("open");
  const [view, setView] = useState<"ticket" | "slate" | "pad" | "email">("ticket");
  const scenario = scenarios[scenarioKey];
  const rows = useMemo(() => rehearsalScoreboardRows(scenario), [scenario]);
  const ticketPicks = useMemo(() => rehearsalTicketPicks(scenario), [scenario]);
  const survivorPick = useMemo(() => rehearsalSurvivorPick(scenario), [scenario]);

  return <main className="min-h-screen bg-[#e9e2d3] pb-8 text-[#171719]">
    <div className="mx-auto max-w-5xl border-x border-[#1d1d1f] bg-[#fffdf8] px-4 py-5 sm:px-5 sm:py-8 md:px-10">
      <header className="-mx-4 border-y-4 border-[#1d1d1f] px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10">
        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_33rem] md:gap-8">
          <div className="min-w-0">
            <p className="text-xs font-black tracking-[0.18em] text-slate-600">SAFE PLAYER WALKTHROUGH</p>
            <h1 className="mt-1 font-serif text-3xl font-bold sm:text-4xl">{view === "ticket" ? "Personal ticket" : view === "slate" ? "The Slate" : view === "pad" ? "Pick'em Pad" : "Email preview"}</h1>
            <label className="mt-4 block text-xs font-bold tracking-[0.16em] text-slate-600" htmlFor="rehearsal-scenario">VIEW REHEARSAL</label>
            <select className="mt-1 border border-[#1d1d1f] bg-white px-3 py-1.5 text-sm font-semibold text-[#171719]" id="rehearsal-scenario" onChange={(event) => setScenarioKey(event.target.value)} value={scenarioKey}>
              <option value="open">Week 4 - fresh blank ticket</option>
              <option value="saturday">Week 4 - Saturday before kickoff</option>
              <option value="sunday">Week 4 - Sunday 3 PM ET</option>
              <option value="final">Week 4 - Monday final</option>
              <option value="handoff">Week 5 - safe handoff</option>
              <option value="playoff">Wild Card Sunday - partial locks</option>
            </select>
            <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Rehearsal view">
              {(["ticket", "slate", "pad", "email"] as const).map((option) => <button className={`border px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] ${view === option ? "border-[#007e72] bg-[#007e72] text-white" : "border-[#1d1d1f] bg-white text-[#171719]"}`} key={option} onClick={() => setView(option)} type="button">{option === "pad" ? "Pick'em Pad" : option === "email" ? "Email" : option === "ticket" ? "Ticket" : "Slate"}</button>)}
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

      {view === "ticket" ? <section className="mx-auto mt-5 w-full max-w-[var(--standings-module-width)] sm:mt-8" aria-label="Rehearsal personal ticket">
        <MyTicket isPlayoff={scenario.isPlayoff} maxPicks={scenario.maxPicks} picks={ticketPicks} survivorAvailable={!scenario.isPlayoff} survivorPick={survivorPick} survivorStatus="active" week={scenario.week} />
        <p className="mt-4 border-t border-[#b9b09d] pt-4 text-xs leading-5 text-slate-600">The ticket follows the active scoring period. Final selections keep their W/L stamps until the safe handoff; then the next week opens as a new ticket while the completed record stays in the historical Pad.</p>
      </section> : null}

      {view === "slate" ? <section className="mx-auto mt-5 w-full max-w-4xl sm:mt-8" aria-labelledby="slate-heading">
        <div className="border-y-2 border-[#1d1d1f] px-3 py-2 text-center"><h2 className="text-xs font-black tracking-[0.18em] text-[#171719] sm:text-sm" id="slate-heading">{scenario.isPlayoff ? "WILD CARD ROUND - ATS SLATE" : `SUNDAY - ${scenario.week.toUpperCase()} ATS SLATE`}</h2></div>
        <div>{games.map((game, index) => <SlateGameRow alternate={index % 2 === 0} game={rehearsalSlateGame(game, index, scenario)} hasStarted={scenario.activeGames.includes(index) || scenario.finalGames.includes(index)} key={game.id} />)}</div>
      </section> : null}

      {view === "pad" ? <section className="mx-auto mt-5 w-full max-w-4xl sm:mt-8" aria-label="Rehearsal Pick'em Pad">
        <PickemScoreboard isPlayoff={scenario.isPlayoff} maxPicks={scenario.maxPicks} rows={rows} viewerPlayerId="tyler" week={scenario.week} />
        <p className="mt-4 border-t border-[#b9b09d] pt-4 text-xs leading-5 text-slate-600">The rehearsal calculates wins from final W marks only. A submitted pick is never treated as a win before its game is final.</p>
      </section> : null}

      {view === "email" ? <EmailPreview rows={rows} scenario={scenario} /> : null}
    </div>
  </main>;
}
