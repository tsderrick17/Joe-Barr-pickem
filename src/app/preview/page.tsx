"use client";

import { useState } from "react";

type Side = "left" | "right";
type AtsResult = "win" | "loss" | null;

type PreviewGame = {
  id: string;
  kickoff: string;
  leftAbbreviation: string;
  leftTeam: string;
  rightAbbreviation: string;
  rightTeam: string;
  line: string;
};

type Scenario = {
  title: string;
  explanation: string;
  instruction: string;
  survivorStamp: string;
  survivorDeck: string;
  boardStatus: string;
  lockedGames: number[];
  startedGames: number[];
  initialAtsPicks: Array<Side | null>;
  initialSurvivorPick: string | null;
  atsResults: AtsResult[];
  survivorResult: "advanced" | "eliminated" | null;
};

function HelmetIcon(_props: { abbreviation: string; faces: "left" | "right"; unavailable?: boolean }) {
  void _props;
  return null;
}

const games: PreviewGame[] = [
  {
    id: "kc-buf",
    kickoff: "Sunday · 1:00 PM ET",
    leftAbbreviation: "KC",
    leftTeam: "Chiefs",
    rightAbbreviation: "BUF",
    rightTeam: "Bills",
    line: "KC −2.5",
  },
  {
    id: "gb-chi",
    kickoff: "Sunday · 4:25 PM ET",
    leftAbbreviation: "GB",
    leftTeam: "Packers",
    rightAbbreviation: "CHI",
    rightTeam: "Bears",
    line: "GB −3.0",
  },
];

const defaultHomeHelmetColors: Record<string, string> = {
  BUF: "#ffffff",
  CHI: "#0b162a",
  GB: "#ffb612",
  KC: "#e31837",
};

const scenarios: Record<string, Scenario> = {
  pending: {
    title: "Lines not final",
    explanation:
      "The board shows preliminary lines without pretending they are official. Both contests remain editable.",
    instruction:
      "Check that the preliminary label is unmistakable and the favorite/underdog order stays aligned.",
    survivorStamp: "Pick needed",
    survivorDeck:
      "Choose one outright winner. Spreads never apply to Survivor.",
    boardStatus: "Preliminary lines",
    lockedGames: [],
    startedGames: [],
    initialAtsPicks: [null, null],
    initialSurvivorPick: null,
    atsResults: [null, null],
    survivorResult: null,
  },
  open: {
    title: "Slate open",
    explanation:
      "This is the normal picking state. Tap ATS teams and one Survivor helmet, then watch the shared save summary update.",
    instruction:
      "Try changing every pick. The left helmet and left ATS team are the favorite in both sections.",
    survivorStamp: "Pick selected",
    survivorDeck:
      "One straight-up winner. Your selected helmet is saved with the ATS slate.",
    boardStatus: "Open for picks",
    lockedGames: [],
    startedGames: [],
    initialAtsPicks: ["left", "right"],
    initialSurvivorPick: "kc-buf-left",
    atsResults: [null, null],
    survivorResult: null,
  },
  international: {
    title: "International game · Saturday line lock",
    explanation:
      "The London game kicks off Sunday at 9:30 AM ET, so its official line locks Saturday at 6 PM ET while picks remain editable until kickoff.",
    instruction:
      "The first game's teal spread is final. You can still change that selection until Sunday morning; every other game remains a normal live line.",
    survivorStamp: "Pick selected",
    survivorDeck:
      "The Survivor selection is still editable until the 9:30 AM ET kickoff.",
    boardStatus: "International line locked · Saturday 6 PM ET",
    lockedGames: [],
    startedGames: [],
    initialAtsPicks: ["left", "right"],
    initialSurvivorPick: "kc-buf-left",
    atsResults: [null, null],
    survivorResult: null,
  },
  partial: {
    title: "Sunday 3:00 PM ET",
    explanation:
      "The early Sunday window is in progress and read-only; late afternoon and prime-time games remain available.",
    instruction:
      "Early picks stay visible and fixed. Later games remain editable until their listed kickoff.",
    survivorStamp: "KC locked",
    survivorDeck:
      "The early Survivor selection is preserved. It cannot be replaced after kickoff.",
    boardStatus: "1 locked · 1 open",
    lockedGames: [0, 1, 2],
    startedGames: [0, 1, 2],
    initialAtsPicks: ["left", "right"],
    initialSurvivorPick: "kc-buf-left",
    atsResults: [null, null],
    survivorResult: null,
  },
  live: {
    title: "Games in progress",
    explanation:
      "Started games are read-only and still unsettled. Live scores never become wins or losses prematurely.",
    instruction:
      "Confirm that picks are visible but no ATS or Survivor result is declared yet.",
    survivorStamp: "In progress",
    survivorDeck:
      "KC 17 · BUF 14 — straight-up result remains pending until the game is final.",
    boardStatus: "Live · read-only",
    lockedGames: [0, 1],
    startedGames: [0, 1],
    initialAtsPicks: ["left", "right"],
    initialSurvivorPick: "kc-buf-left",
    atsResults: [null, null],
    survivorResult: null,
  },
  final: {
    title: "Week final — scored",
    explanation:
      "ATS results and the straight-up Survivor result are judged separately and shown explicitly.",
    instruction:
      "Notice that Survivor advances because KC won outright; the spread is irrelevant to that result.",
    survivorStamp: "Advanced",
    survivorDeck:
      "KC won outright. The Survivor entry advances to next week.",
    boardStatus: "Final · scored",
    lockedGames: [0, 1],
    startedGames: [0, 1],
    initialAtsPicks: ["left", "right"],
    initialSurvivorPick: "kc-buf-left",
    atsResults: ["win", "loss"],
    survivorResult: "advanced",
  },
  eliminated: {
    title: "Survivor eliminated",
    explanation:
      "The Survivor clipping stays visible as a permanent receipt while the separate ATS contest remains intact.",
    instruction:
      "Check whether elimination feels clear without making the entire page feel punitive or broken.",
    survivorStamp: "Eliminated",
    survivorDeck:
      "BUF was selected and lost outright. No future Survivor pick is permitted.",
    boardStatus: "ATS final · Survivor out",
    lockedGames: [0, 1],
    startedGames: [0, 1],
    initialAtsPicks: ["right", "left"],
    initialSurvivorPick: "kc-buf-right",
    atsResults: ["loss", "win"],
    survivorResult: "eliminated",
  },
  archived: {
    title: "Completed week archive",
    explanation:
      "A past week becomes a compact, read-only receipt with the original picks, locked lines, and results retained.",
    instruction:
      "Review whether you can reconstruct exactly what was picked and how it scored without extra explanation.",
    survivorStamp: "Week complete",
    survivorDeck:
      "Historical receipt · KC selected · advanced.",
    boardStatus: "Archived · read-only",
    lockedGames: [0, 1],
    startedGames: [0, 1],
    initialAtsPicks: ["left", "right"],
    initialSurvivorPick: "kc-buf-left",
    atsResults: ["win", "win"],
    survivorResult: "advanced",
  },
};

const rehearsalGames: PreviewGame[] = [
  ...games,
  { id: "pit-bal", kickoff: "Sunday 1:00 PM ET", leftAbbreviation: "PIT", leftTeam: "Steelers", rightAbbreviation: "BAL", rightTeam: "Ravens", line: "BAL -2.5" },
  { id: "sf-lar", kickoff: "Sunday 4:25 PM ET", leftAbbreviation: "SF", leftTeam: "49ers", rightAbbreviation: "LAR", rightTeam: "Rams", line: "SF -3.5" },
  { id: "dal-phi", kickoff: "Sunday 4:25 PM ET", leftAbbreviation: "PHI", leftTeam: "Eagles", rightAbbreviation: "DAL", rightTeam: "Cowboys", line: "PHI -4.0" },
  { id: "den-sea", kickoff: "Sunday 4:25 PM ET", leftAbbreviation: "DEN", leftTeam: "Broncos", rightAbbreviation: "SEA", rightTeam: "Seahawks", line: "DEN -1.5" },
  { id: "nyj-mia", kickoff: "Sunday 8:20 PM ET", leftAbbreviation: "MIA", leftTeam: "Dolphins", rightAbbreviation: "NYJ", rightTeam: "Jets", line: "MIA -2.0" },
  { id: "det-min", kickoff: "Monday 8:15 PM ET", leftAbbreviation: "DET", leftTeam: "Lions", rightAbbreviation: "MIN", rightTeam: "Vikings", line: "DET -2.5" },
];

// Final ATS results belong to the matchup, not to the people who selected it.
// Every completed game therefore shows both a W and an L on the Slate.
const rehearsalAtsWinners: Side[] = [
  "left",
  "right",
  "right",
  "left",
  "left",
  "right",
  "left",
  "right",
];

function ResultMarker({ result }: { result: AtsResult }) {
  if (!result) return null;

  return (
    <strong
      aria-label={`Against the spread: ${result}`}
      className={`absolute right-0 -top-1 text-sm font-black leading-none sm:text-base ${
        result === "win" ? "text-green-700" : "text-red-700"
      }`}
    >
      {result === "win" ? "W" : "L"}
    </strong>
  );
}

export default function PreviewPage() {
  const [scenarioKey, setScenarioKey] = useState("pending");
  const [atsPicks, setAtsPicks] = useState<Array<Side | null>>(
    () => rehearsalGames.map((_, index) => scenarios.pending.initialAtsPicks[index] ?? null),
  );
  const [survivorPick, setSurvivorPick] = useState<string | null>(
    scenarios.pending.initialSurvivorPick,
  );
  const scenario = scenarios[scenarioKey];

  function chooseScenario(nextKey: string) {
    const nextScenario = scenarios[nextKey];
    setScenarioKey(nextKey);
    setAtsPicks(rehearsalGames.map((_, index) => nextScenario.initialAtsPicks[index] ?? null));
    setSurvivorPick(nextScenario.initialSurvivorPick);
  }

  function chooseAts(index: number, side: Side) {
    if (scenario.lockedGames.includes(index)) return;
    setAtsPicks((current) =>
      current.map((pick, pickIndex) =>
        pickIndex === index ? (pick === side ? null : side) : pick,
      ),
    );
  }

  function chooseSurvivor(game: PreviewGame, side: Side, index: number) {
    if (scenario.lockedGames.includes(index) || scenario.survivorResult !== null) return;

    const selection = `${game.id}-${side}`;
    setSurvivorPick((current) => current === selection ? null : selection);
  }

  const selectedAtsCount = atsPicks.filter(Boolean).length;
  const isEditable = !["live", "final", "eliminated", "archived"].includes(scenarioKey);
  const isFinalState = ["final", "eliminated", "archived"].includes(scenarioKey);
  const demoStandings = [
    { name: "Tyler", wins: isFinalState ? 1 : 0, picks: ["Chiefs -2.5", "Bears +3.0"], marks: isFinalState ? ["W", "L"] : ["", ""] },
    { name: "Zac", wins: isFinalState ? 1 : 0, picks: ["Bills +2.5", "Packers -3.0"], marks: isFinalState ? ["L", "W"] : ["", ""] },
    { name: "Gary", wins: isFinalState ? 1 : 0, picks: ["Steelers +2.5", "Eagles -4.0"], marks: isFinalState ? ["W", "L"] : ["", ""] },
  ];

  return (
    <main className="min-h-screen bg-[#f5f0e6] px-4 py-6 text-[#171719] sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b-2 border-[#1d1d1f] pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                Demo Week 1 · Safe preview
              </p>
              <h1 className="mt-1 font-serif text-3xl font-black leading-none sm:text-4xl">
                The Slate
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Switch between season moments and test the decisions before real
                games begin. Nothing here changes player records.
              </p>
            </div>
            <label className="block min-w-0 sm:w-64">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                Season scenario
              </span>
              <select
                className="w-full rounded-lg border border-slate-400 bg-white px-3 py-2.5 text-sm font-bold"
                onChange={(event) => chooseScenario(event.target.value)}
                value={scenarioKey}
              >
                <option value="international">International - Saturday line lock</option>
                <option value="pending">1 · Lines not final</option>
                <option value="open">2 · Slate open</option>
                <option value="partial">3 · Early game locked</option>
                <option value="live">4 · Games in progress</option>
                <option value="final">5 · Final scores posted</option>
                <option value="archived">7 · Completed week archive</option>
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.12em]">
                {scenario.title}
              </p>
              <p className="mt-1 text-sm leading-5 text-slate-700">
                {scenario.explanation}
              </p>
            </div>
            <div className="border-l border-[#b9b09d] pl-3 text-sm leading-5 text-slate-700">
              <strong className="block text-[10px] uppercase tracking-[0.12em]">
                What to critique
              </strong>
              {scenario.instruction}
            </div>
          </div>
        </header>

        <div className="mx-auto mt-6 w-full max-w-4xl space-y-6 sm:mt-8">
          {false ? <section
            aria-labelledby="preview-survivor-heading"
            className="newspaper-clipping survivor-clipping p-2.5 sm:p-3"
          >
            <div className="flex items-center justify-between gap-3 border-b-2 border-[#1d1d1f] pb-1.5">
              <h2
                className="font-serif text-xl font-black leading-none sm:text-2xl"
                id="preview-survivor-heading"
              >
                The Survivor Wire
              </h2>
              <p className="text-right text-[9px] font-black uppercase tracking-[0.1em] text-[#29251d] sm:text-[10px]">
                Straight-up · Demo week
              </p>
            </div>

            <div className="mt-2 divide-y divide-[#1d1d1f] border-y border-[#1d1d1f]">
              {rehearsalGames.map((game, index) => {
                const leftSelection = `${game.id}-left`;
                const rightSelection = `${game.id}-right`;
                const leftSelected = survivorPick === leftSelection;
                const rightSelected = survivorPick === rightSelection;
                const locked =
                  scenario.lockedGames.includes(index) ||
                  scenario.survivorResult !== null;

                return (
                  <article className="relative py-1" key={game.id}>
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-0 top-0 h-1"
                      style={{
                        backgroundImage: `linear-gradient(90deg, ${
                          defaultHomeHelmetColors[game.leftAbbreviation] ?? "#111111"
                        } 0 50%, ${
                          defaultHomeHelmetColors[game.rightAbbreviation] ?? "#111111"
                        } 50% 100%)`,
                      }}
                    />
                    <p className="sr-only">{game.kickoff}</p>
                    <div className="grid grid-cols-2 divide-x divide-[#1d1d1f]">
                      <button
                        aria-label={`Choose ${game.leftTeam} as the straight-up Survivor winner`}
                        aria-pressed={leftSelected}
                        className={`flex min-h-14 items-center justify-center px-2 py-1.5 transition ${
                          leftSelected
                            ? "bg-[#1d1d1f]"
                            : "bg-white hover:bg-zinc-100"
                        } disabled:cursor-not-allowed`}
                        disabled={locked}
                        onClick={() => chooseSurvivor(game, "left", index)}
                        title={locked ? `${game.leftTeam} is unavailable` : `Choose ${game.leftTeam}`}
                        type="button"
                      >
                        <HelmetIcon
                          abbreviation={game.leftAbbreviation}
                          faces="right"
                          unavailable={locked}
                        />
                      </button>
                      <button
                        aria-label={`Choose ${game.rightTeam} as the straight-up Survivor winner`}
                        aria-pressed={rightSelected}
                        className={`flex min-h-14 items-center justify-center px-2 py-1.5 transition ${
                          rightSelected
                            ? "bg-[#1d1d1f]"
                            : "bg-white hover:bg-zinc-100"
                        } disabled:cursor-not-allowed`}
                        disabled={locked}
                        onClick={() => chooseSurvivor(game, "right", index)}
                        title={locked ? `${game.rightTeam} is unavailable` : `Choose ${game.rightTeam}`}
                        type="button"
                      >
                        <HelmetIcon
                          abbreviation={game.rightAbbreviation}
                          faces="left"
                          unavailable={locked}
                        />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section> : null}

          <section
            aria-labelledby="preview-ats-heading"
          >
            <div className="flex items-end justify-between gap-3 border-y-2 border-[#1d1d1f] px-3 py-2 text-center sm:px-4">
              <h2
                className="text-xs font-black tracking-[0.18em] text-[#171719] sm:text-sm"
                id="preview-ats-heading"
              >
                SUNDAY · ATS SLATE
              </h2>
              <p className="text-[10px] font-bold uppercase text-slate-600">
                {scenario.boardStatus}
              </p>
            </div>

            <div>
              {rehearsalGames.map((game, index) => {
                const locked = scenario.lockedGames.includes(index) || !isEditable;
                const lineLocked = scenarioKey !== "pending" && (scenarioKey !== "international" || index === 0);
                const leftResult: AtsResult = isFinalState
                  ? rehearsalAtsWinners[index] === "left" ? "win" : "loss"
                  : null;
                const rightResult: AtsResult = isFinalState
                  ? rehearsalAtsWinners[index] === "right" ? "win" : "loss"
                  : null;
                const displayedLine =
                  scenarioKey === "pending"
                    ? game.line
                    : scenarioKey === "international" && index === 0
                      ? game.line
                    : game.line;

                return (
                  <article
                    className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.75rem_minmax(0,1fr)] items-center gap-2 border-b border-[#c8c1b5] py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.75rem_minmax(0,1fr)] sm:gap-3"
                    key={game.id}
                  >
                    <div className="text-center text-[10px] font-bold leading-3 text-slate-600 sm:text-xs">
                      {isFinalState ? <p className="font-mono font-bold text-slate-700">{game.kickoff.startsWith("Monday") ? "9/14" : "9/13"}</p> : <><p>{game.kickoff.replace("Sunday · ", "")}</p><p className="mt-1 text-[8px] font-black tracking-[0.1em] text-slate-500">ET</p></>}
                    </div>
                    <button
                      className={`min-w-0 text-left text-sm font-bold leading-tight tracking-tight sm:text-base ${
                        atsPicks[index] === "left"
                          ? "bg-[#1d1d1f] px-2 py-1.5 text-white sm:px-3 sm:py-2"
                          : "hover:underline"
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                      disabled={locked}
                      onClick={() => chooseAts(index, "left")}
                      type="button"
                    >
                      <span className="relative inline-block pr-3">
                        {game.leftTeam}
                        <ResultMarker result={leftResult} />
                      </span>
                    </button>
                    <div className="text-center text-[10px] font-bold leading-4 text-slate-700 sm:text-xs">
                      <strong className={`block font-mono text-sm sm:text-base ${lineLocked ? "text-teal-700" : "text-zinc-900"}`}>
                        {displayedLine}
                      </strong>
                    </div>
                    <button
                      className={`min-w-0 text-right text-sm font-bold leading-tight tracking-tight sm:text-base ${
                        atsPicks[index] === "right"
                          ? "bg-[#1d1d1f] px-2 py-1.5 text-white sm:px-3 sm:py-2"
                          : "hover:underline"
                      } disabled:cursor-not-allowed disabled:opacity-70`}
                      disabled={locked}
                      onClick={() => chooseAts(index, "right")}
                      type="button"
                    >
                      <span className="relative inline-block pr-3">
                        {game.rightTeam}
                        <ResultMarker result={rightResult} />
                      </span>
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section aria-labelledby="preview-standings-heading">
            <p className="mb-3 text-xs font-black tracking-[0.2em] text-slate-600" id="preview-standings-heading">PICK&apos;EM THIS WEEK</p>
            <div className="border-y-2 border-[#1d1d1f]">
              <table className="w-full table-fixed border-collapse text-left">
                <thead><tr className="border-b-2 border-[#1d1d1f] text-xs tracking-[0.14em]"><th className="w-12 px-2 py-3 sm:w-20 sm:px-3">WINS</th><th className="w-20 px-2 py-3 sm:w-40 sm:px-3"><span className="sr-only">Player</span></th><th className="px-2 py-3 sm:px-3">PICK 1</th><th className="px-2 py-3 sm:px-3">PICK 2</th></tr></thead>
                <tbody>{demoStandings.map((row) => <tr className={`border-b border-[#91afd0] last:border-b-0 ${row.name === "Tyler" ? "bg-[#fffaf0]" : ""}`} key={row.name}><td className="px-2 py-3 font-serif text-xl sm:px-3 sm:py-4 sm:text-2xl">{row.wins}</td><td className="px-2 py-3 font-serif text-base sm:px-3 sm:py-4 sm:text-xl">{row.name}</td>{row.picks.map((pick, index) => <td className="break-words px-2 py-3 text-sm leading-tight sm:px-3 sm:py-4 sm:text-base" key={pick}>{scenarioKey === "pending" || (scenarioKey === "partial" && row.name !== "Tyler") ? <span title="Pick submitted and hidden until kickoff">🔒</span> : <><span>{pick.split(" ").slice(0, -1).join(" ")} <strong className={isFinalState ? "font-mono text-teal-700" : "font-mono text-slate-700"}>{pick.split(" ").at(-1)}</strong></span>{row.marks[index] ? <strong className={`ml-2 ${row.marks[index] === "W" ? "text-green-800" : "text-red-700"}`}>{row.marks[index]}</strong> : null}</>}</td>)}</tr>)}</tbody>
              </table>
            </div>
          </section>

          <section
            aria-live="polite"
            className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em]">
                  {isEditable ? "Shared save preview" : "Full slate · read only"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedAtsCount} of {games.length} ATS picks ·{" "}
                  ATS selections can be changed until kickoff.
                </p>
              </div>
              <button
                className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={
                  !isEditable ||
                  selectedAtsCount !== rehearsalGames.length
                }
                onClick={() =>
                  window.alert(
                    "Demo only: the real Slate would save these ATS selections here.",
                  )
                }
                type="button"
              >
                Save full slate
              </button>
            </div>
            <p className="mt-3 border-t border-slate-200 pt-3 text-[11px] leading-4 text-slate-500">
              Integrity preview: kickoff is checked on the server; locked picks
              cannot be rewritten; official changes retain an audit trail.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
