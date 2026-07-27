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
  partial: {
    title: "Early game locked",
    explanation:
      "The 1:00 PM matchup is frozen after kickoff while the 4:25 PM matchup remains editable.",
    instruction:
      "Try the early game, then the late game. Only the late ATS pick should respond.",
    survivorStamp: "KC locked",
    survivorDeck:
      "The early Survivor selection is preserved. It cannot be replaced after kickoff.",
    boardStatus: "1 locked · 1 open",
    lockedGames: [0],
    startedGames: [0],
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
    title: "Final scores posted",
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

function ResultMarker({ result }: { result: AtsResult }) {
  if (!result) return null;

  return (
    <strong
      aria-label={`Against the spread: ${result}`}
      className={`ml-1 text-base font-black ${
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
    scenarios.pending.initialAtsPicks,
  );
  const [survivorPick, setSurvivorPick] = useState<string | null>(
    scenarios.pending.initialSurvivorPick,
  );
  const scenario = scenarios[scenarioKey];

  function chooseScenario(nextKey: string) {
    const nextScenario = scenarios[nextKey];
    setScenarioKey(nextKey);
    setAtsPicks([...nextScenario.initialAtsPicks]);
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
  const isEditable = scenario.lockedGames.length < games.length;

  return (
    <main className="min-h-screen bg-[#f5f0e6] px-4 py-6 text-[#171719] sm:px-8 sm:py-10">
      <div className="mx-auto w-full max-w-4xl">
        <header className="border-b-2 border-[#1d1d1f] pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                Dummy data · Safe preview
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
                <option value="pending">1 · Lines not final</option>
                <option value="open">2 · Slate open</option>
                <option value="partial">3 · Early game locked</option>
                <option value="live">4 · Games in progress</option>
                <option value="final">5 · Final scores posted</option>
                <option value="eliminated">6 · Survivor eliminated</option>
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
              {games.map((game, index) => {
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
              {games.map((game, index) => {
                const locked = scenario.lockedGames.includes(index);
                const started = scenario.startedGames.includes(index);
                const displayedLine =
                  scenarioKey === "pending"
                    ? game.line
                    : `${game.line}${started ? scenarioKey === "live" ? " · LIVE" : " · LOCKED" : ""}`;

                return (
                  <article
                    className="grid grid-cols-[3.25rem_minmax(0,1fr)_3.75rem_minmax(0,1fr)] items-center gap-2 border-b border-[#c8c1b5] py-2 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.75rem_minmax(0,1fr)] sm:gap-3"
                    key={game.id}
                  >
                    <div className="text-center text-[10px] font-bold leading-3 text-slate-600 sm:text-xs">
                      <p>{game.kickoff.replace("Sunday · ", "")}</p>
                      <p className="mt-1 text-[8px] font-black tracking-[0.1em] text-slate-500">ET</p>
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
                      {game.leftTeam}
                      {atsPicks[index] === "left" ? (
                        <ResultMarker result={scenario.atsResults[index]} />
                      ) : null}
                    </button>
                    <div className="text-center text-[10px] font-bold leading-4 text-slate-700 sm:text-xs">
                      <strong className={`block font-mono text-sm sm:text-base ${scenarioKey === "pending" ? "text-zinc-900" : "text-teal-700"}`}>
                        {displayedLine}
                      </strong>
                      <span>{game.kickoff}</span>
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
                      {game.rightTeam}
                      {atsPicks[index] === "right" ? (
                        <ResultMarker result={scenario.atsResults[index]} />
                      ) : null}
                    </button>
                  </article>
                );
              })}
            </div>
          </section>

          <section
            aria-live="polite"
            className="rounded-xl border border-slate-300 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.12em]">
                  {isEditable ? "Shared save preview" : "Read-only receipt"}
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
                  selectedAtsCount !== games.length
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
