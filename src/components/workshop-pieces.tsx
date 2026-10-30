"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import AtsResultStamp from "@/components/ats-result-stamp";
import { BowlCrest, BowlMegaphone } from "@/components/bowl-pool-marks";
import BowlScoreTile from "@/components/bowl-score-tile";
import FootballLoader from "@/components/football-loader";
import SeasonClosedBanner from "@/components/season-closed-banner";
import SurvivorPokerChip, { TOSS_DEFAULTS } from "@/components/survivor-poker-chip";
import { STROKE_JITTER_DEFAULTS, strokeJitter } from "@/lib/stroke-jitter";

/**
 * The pieces on the Workshop board: the real components with sample data, and the settings each one can be tuned with. A setting changes only
 * the Workshop (each is a CSS variable or prop whose live value is what players see), so it can be tried here and then copied into the code.
 * Nothing here reads or writes pool data.
 */

export type Knob = { key: string; label: string; min: number; max: number; step: number; unit: string; live: number };

// The live value of every knob is the one the app uses today; the board starts there.
export const KNOBS: Record<string, Knob[]> = {
  submit: [{ key: "--receipt-attention-cycle", label: "Sheen + press every", min: 2, max: 30, step: 0.5, unit: "s", live: 12 }],
  highlight: [
    { key: "--selection-sweep-ms", label: "Sweep length", min: 150, max: 2000, step: 10, unit: "ms", live: 600 },
    { key: "--selection-sweep-delay", label: "Delay", min: 0, max: 600, step: 5, unit: "ms", live: 0 },
    { key: "jitterX", label: "Wander sideways", min: 0, max: 0.5, step: 0.005, unit: "em", live: STROKE_JITTER_DEFAULTS.x },
    { key: "jitterY", label: "Wander up/down", min: 0, max: 0.5, step: 0.005, unit: "em", live: STROKE_JITTER_DEFAULTS.y },
    { key: "jitterTurn", label: "Wander turn", min: 0, max: 5, step: 0.05, unit: "deg", live: STROKE_JITTER_DEFAULTS.turn },
  ],
  chip: [
    { key: "leanMin", label: "Axis lean min", min: 0, max: 45, step: 0.5, unit: "deg", live: TOSS_DEFAULTS.leanMin },
    { key: "leanMax", label: "Axis lean max", min: 0, max: 45, step: 0.5, unit: "deg", live: TOSS_DEFAULTS.leanMax },
    { key: "msMin", label: "Toss length min", min: 200, max: 3000, step: 10, unit: "ms", live: TOSS_DEFAULTS.msMin },
    { key: "msMax", label: "Toss length max", min: 200, max: 3000, step: 10, unit: "ms", live: TOSS_DEFAULTS.msMax },
  ],
  pennant: [{ key: "--megaphone-raise-ms", label: "Raise length", min: 150, max: 2000, step: 10, unit: "ms", live: 620 }],
  tile: [{ key: "pace", label: "Time per flip", min: 40, max: 400, step: 5, unit: "ms", live: 140 }],
  wins: [{ key: "paceWins", label: "Time per flip", min: 40, max: 400, step: 5, unit: "ms", live: 140 }],
  football: [
    { key: "--football-spin-s", label: "Time per turn", min: 0.3, max: 6, step: 0.05, unit: "s", live: 1.8 },
    { key: "--football-tilt", label: "Tilt", min: 0, max: 90, step: 1, unit: "deg", live: 45 },
    { key: "--football-wobble", label: "Wobble size", min: 0, max: 10, step: 0.1, unit: "deg", live: 0 },
    { key: "--football-wobble-s", label: "Wobble pace", min: 0.3, max: 5, step: 0.1, unit: "s", live: 0.3 },
    { key: "--football-scale", label: "Size", min: 0.5, max: 2.5, step: 0.05, unit: "x", live: 1 },
  ],
  crest: [
    { key: "--crest-rule-ms", label: "Rule draw length", min: 150, max: 3000, step: 10, unit: "ms", live: 2840 },
    { key: "--crest-rule-delay", label: "Delay", min: 0, max: 1000, step: 10, unit: "ms", live: 1000 },
  ],
};
export type Values = Record<string, number>;
const ALL_KNOBS = Object.values(KNOBS).flat();
export const cssValue = (knob: Knob, value: number) => `${value}${knob.unit === "x" ? "" : knob.unit}`;
/** The CSS variables of one piece, for its stage's style. */
const cssVars = (group: string, values: Values) => Object.fromEntries(KNOBS[group].filter((knob) => knob.key.startsWith("--")).map((knob) => [knob.key, cssValue(knob, values[knob.key])])) as CSSProperties;

const CHIP_TEAMS: Array<[string, string]> = [
  ["ARI", "Arizona Cardinals"], ["ATL", "Atlanta Falcons"], ["BAL", "Baltimore Ravens"], ["BUF", "Buffalo Bills"], ["CAR", "Carolina Panthers"], ["CHI", "Chicago Bears"],
  ["CIN", "Cincinnati Bengals"], ["CLE", "Cleveland Browns"], ["DAL", "Dallas Cowboys"], ["DEN", "Denver Broncos"], ["DET", "Detroit Lions"], ["GB", "Green Bay Packers"],
  ["HOU", "Houston Texans"], ["IND", "Indianapolis Colts"], ["JAX", "Jacksonville Jaguars"], ["KC", "Kansas City Chiefs"], ["LV", "Las Vegas Raiders"], ["LAC", "Los Angeles Chargers"],
  ["LAR", "Los Angeles Rams"], ["MIA", "Miami Dolphins"], ["MIN", "Minnesota Vikings"], ["NE", "New England Patriots"], ["NO", "New Orleans Saints"], ["NYG", "New York Giants"],
  ["NYJ", "New York Jets"], ["PHI", "Philadelphia Eagles"], ["PIT", "Pittsburgh Steelers"], ["SEA", "Seattle Seahawks"], ["SF", "San Francisco 49ers"], ["TB", "Tampa Bay Buccaneers"],
  ["TEN", "Tennessee Titans"], ["WAS", "Washington Commanders"],
];
const PENNANT_TEAMS = {
  ORE: { full_name: "Oregon Ducks", short_name: "Oregon", abbreviation: "ORE", primary_color: "154733", secondary_color: "fee123" },
  TROY: { full_name: "Troy Trojans", short_name: "Troy", abbreviation: "TROY", primary_color: "8a2432", secondary_color: "b1b3b3" },
  MRSH: { full_name: "Marshall Thundering Herd", short_name: "Marshall", abbreviation: "MRSH", primary_color: "00b140", secondary_color: "ffffff" },
  WKU: { full_name: "Western Kentucky Hilltoppers", short_name: "Western Kentucky", abbreviation: "WKU", primary_color: "c8102e", secondary_color: "ffffff" },
  BAMA: { full_name: "Alabama Crimson Tide", short_name: "Alabama", abbreviation: "BAMA", primary_color: "9e1b32", secondary_color: "ffffff" },
  MICH: { full_name: "Michigan Wolverines", short_name: "Michigan", abbreviation: "MICH", primary_color: "00274c", secondary_color: "ffcb05" },
  OSU: { full_name: "Ohio State Buckeyes", short_name: "Ohio State", abbreviation: "OSU", primary_color: "bb0000", secondary_color: "666666" },
  TEX: { full_name: "Texas Longhorns", short_name: "Texas", abbreviation: "TEX", primary_color: "bf5700", secondary_color: "ffffff" },
} as const;
/** The loading football has 108 frames in one turn. Paused, a frame is picked by hand; playing, it runs as it does for players. */
export const FOOTBALL_FRAMES = 108;

const CHIP_STATES = [["available", "Available"], ["picked", "Picked"], ["official", "Official"], ["unavailable", "Unavailable"]] as const;
const CHIP_SIZES = [["summary", "Small"], ["slate", "Slate"], ["ticket", "Ticket"]] as const;

/** Everything the Commissioner can set on the board. Every copy of a piece shows the same settings. */
export type Settings = {
  knobs: Values;
  chip: { team: string; state: (typeof CHIP_STATES)[number][0]; size: (typeof CHIP_SIZES)[number][0]; spinning: boolean };
  stamp: { result: "win" | "loss"; variant: "ticket" | "mark"; tilted: "yes" | "no" };
  pennantTeam: keyof typeof PENNANT_TEAMS;
  strokeText: string;
  submitState: "unsaved" | "saved";
  tiles: { remaining: string; wins: string };
  crest: { title: string; season: string; suffix: string };
  football: { paused: boolean; frame: number };
  view: { labels: boolean };
};

export const liveKnobs = (): Values => Object.fromEntries(ALL_KNOBS.map((knob) => [knob.key, knob.live]));
export const defaultSettings = (): Settings => ({
  knobs: liveKnobs(),
  chip: { team: "KC", state: "available", size: "ticket", spinning: false },
  stamp: { result: "win", variant: "ticket", tilted: "no" },
  pennantTeam: "ORE",
  strokeText: "Chiefs",
  submitState: "unsaved",
  tiles: { remaining: "12", wins: "7" },
  crest: { title: "BOWL CARD", season: "2026", suffix: "Special" },
  football: { paused: false, frame: 1 },
  view: { labels: false },
});
/** What a saved copy of the settings must fit to be used (see mergeSaved). */
export const SAVED_RULES = {
  limits: { ...Object.fromEntries(ALL_KNOBS.map((knob) => [`knobs.${knob.key}`, [knob.min, knob.max]])), "football.frame": [1, FOOTBALL_FRAMES] },
  choices: {
    "chip.team": CHIP_TEAMS.map(([key]) => key),
    "chip.state": CHIP_STATES.map(([key]) => key),
    "chip.size": CHIP_SIZES.map(([key]) => key),
    "stamp.result": ["win", "loss"],
    "stamp.variant": ["ticket", "mark"],
    "stamp.tilted": ["yes", "no"],
    pennantTeam: Object.keys(PENNANT_TEAMS),
    submitState: ["unsaved", "saved"],
  },
} as { limits: Record<string, [number, number]>; choices: Record<string, string[]> };

/** The settings changed from their live values, as the text the Commissioner copies and sends. */
export function changedSummary(values: Values) {
  const changed = ALL_KNOBS.filter((knob) => values[knob.key] !== knob.live);
  return {
    count: changed.length,
    text: changed.length
      ? changed.map((knob) => `${knob.label} (${knob.key}): ${cssValue(knob, values[knob.key])}, live ${cssValue(knob, knob.live)}`).join("\n")
      : "Every setting is at its live value.",
  };
}

type Update = (change: (current: Settings) => Settings) => void;
/** What a piece is given to draw one copy of itself: the shared settings, how many times this copy has been played, and its own name. */
type Draw = { settings: Settings; update: Update; plays: number; play: () => void; copy: string };

export type Piece = {
  id: string;
  title: string;
  note: string;
  /** Shown larger than live inside its tile so its detail is easy to see. */
  zoom?: number;
  dark?: boolean;
  /** A tap on the tile plays it; a piece with its own button (the chip) leaves this off. */
  tapToPlay?: boolean;
  knobGroup?: string;
  style?: (settings: Settings) => CSSProperties;
  draw: (draw: Draw) => ReactNode;
  controls?: (settings: Settings, update: Update) => ReactNode;
  /** Extra buttons in its settings panel (the football's play and step). */
  actions?: (settings: Settings, update: Update) => ReactNode;
};

function Knobs({ group, values, update }: { group: string; values: Values; update: Update }) {
  return (
    <div className="asset-knobs">
      {KNOBS[group].map((knob) => (
        <label className="asset-knob" key={knob.key}>
          <span>{knob.label}</span>
          <input max={knob.max} min={knob.min} onChange={(event) => { const value = Number(event.target.value); update((current) => ({ ...current, knobs: { ...current.knobs, [knob.key]: value } })); }} step={knob.step} type="range" value={values[knob.key]} />
          <output>{values[knob.key]}{knob.unit === "x" ? "x" : knob.unit}</output>
        </label>
      ))}
    </div>
  );
}
export const knobsFor = (group: string, settings: Settings, update: Update) => <Knobs group={group} update={update} values={settings.knobs} />;

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="asset-choice" role="group">
      <span>{label}</span>
      <div>
        {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, maxLength = 24, numeric = false }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; numeric?: boolean }) {
  return (
    <label className="asset-choice">
      <span>{label}</span>
      <input className="asset-text" inputMode={numeric ? "numeric" : undefined} maxLength={maxLength} onChange={(event) => onChange(numeric ? event.target.value.replace(/\D/g, "") : event.target.value)} type="text" value={value} />
    </label>
  );
}

const stepFrame = (frame: number, by: number) => ((frame - 1 + by + FOOTBALL_FRAMES) % FOOTBALL_FRAMES) + 1;

export const PIECES: Piece[] = [
  {
    id: "chip",
    title: "Survivor poker chip",
    note: "One Survivor chip: choose its team, state and size, and tap it to toss it. Each toss leans its axis and runs for a random time within the limits.",
    zoom: 1.5,
    knobGroup: "chip",
    draw: ({ settings: { chip, knobs }, plays, play }) => (
      <button aria-label="Toss the chip" className={`asset-chip-button is-${chip.size}`} onClick={play} type="button">
        <SurvivorPokerChip
          abbreviation={chip.team}
          animate={plays > 0}
          idleSpin={chip.spinning}
          key={`${plays}-${chip.team}-${chip.size}`}
          official={chip.state === "official"}
          selected={chip.state === "picked" || chip.state === "official"}
          showEdge
          size={chip.size}
          teamName={CHIP_TEAMS.find(([key]) => key === chip.team)?.[1] ?? chip.team}
          tossRange={{ leanMin: Math.min(knobs.leanMin, knobs.leanMax), leanMax: Math.max(knobs.leanMin, knobs.leanMax), msMin: Math.min(knobs.msMin, knobs.msMax), msMax: Math.max(knobs.msMin, knobs.msMax) }}
          unavailable={chip.state === "unavailable"}
        />
      </button>
    ),
    controls: ({ chip }, update) => <>
      <label className="asset-choice">
        <span>Team</span>
        <select className="asset-select" onChange={(event) => { const team = event.target.value; update((current) => ({ ...current, chip: { ...current.chip, team } })); }} value={chip.team}>
          {CHIP_TEAMS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
        </select>
      </label>
      <Choice label="State" onChange={(state) => update((current) => ({ ...current, chip: { ...current.chip, state } }))} options={CHIP_STATES} value={chip.state} />
      <Choice label="Size" onChange={(size) => update((current) => ({ ...current, chip: { ...current.chip, size } }))} options={CHIP_SIZES} value={chip.size} />
      <Choice label="Idle spin" onChange={(spin) => update((current) => ({ ...current, chip: { ...current.chip, spinning: spin === "on" } }))} options={[["off", "Off"], ["on", "On"]] as const} value={chip.spinning ? "on" : "off"} />
    </>,
  },
  {
    id: "submit",
    title: "Submit button",
    note: "The receipt's Submit button. While picks are unsaved a sheen sweeps across it and then it presses itself, once per cycle. Tap it to start the cycle over.",
    zoom: 1.5,
    tapToPlay: true,
    knobGroup: "submit",
    style: (settings) => cssVars("submit", settings.knobs),
    draw: ({ settings, plays }) => (
      <div className="asset-submit slate-receipt-ticket" key={plays}>
        {/* the tile itself is the button that replays it; this one is only the look */}
        <button aria-hidden="true" className={`slate-receipt-print ${settings.submitState === "unsaved" ? "needs-attention" : ""}`} tabIndex={-1} type="button">SUBMIT</button>
      </div>
    ),
    controls: ({ submitState }, update) => <Choice label="Picks" onChange={(value) => update((current) => ({ ...current, submitState: value }))} options={[["unsaved", "Unsaved"], ["saved", "Saved"]] as const} value={submitState} />,
  },
  {
    id: "highlight",
    title: "Pick highlight",
    note: "The pen stroke that marks a Slate pick, sweeping in from the left. Each stroke wanders a little at random within the wander limits; tap it to draw a new one.",
    zoom: 1.4,
    tapToPlay: true,
    knobGroup: "highlight",
    style: (settings) => cssVars("highlight", settings.knobs),
    draw: ({ settings: { strokeText, knobs }, plays, copy }) => (
      <span className="asset-highlight" key={plays}>
        <span className="slate-team-label slate-team-label--selected slate-team-label--from-left slate-team-label--new" style={strokeJitter(`asset-${copy}-${plays}`, { x: knobs.jitterX, y: knobs.jitterY, turn: knobs.jitterTurn })}><span>{strokeText || "Chiefs"}</span></span>
      </span>
    ),
    controls: ({ strokeText }, update) => <TextField label="Name" maxLength={18} onChange={(value) => update((current) => ({ ...current, strokeText: value }))} value={strokeText} />,
  },
  {
    id: "pennant",
    title: "Bowl Pool megaphone",
    note: "A cheerleader's megaphone in the school's colors, raised when a Bowl Pool team is picked. Tap it to raise it again.",
    zoom: 2,
    tapToPlay: true,
    knobGroup: "pennant",
    style: (settings) => cssVars("pennant", settings.knobs),
    draw: ({ settings: { pennantTeam }, plays }) => <span className="bowl-team-pick is-new" key={`${plays}-${pennantTeam}`}><BowlMegaphone side="left" team={PENNANT_TEAMS[pennantTeam]} /></span>,
    controls: ({ pennantTeam }, update) => (
      <label className="asset-choice">
        <span>School</span>
        <select className="asset-select" onChange={(event) => { const team = event.target.value as keyof typeof PENNANT_TEAMS; update((current) => ({ ...current, pennantTeam: team })); }} value={pennantTeam}>
          {Object.values(PENNANT_TEAMS).map((team) => <option key={team.abbreviation} value={team.abbreviation}>{team.short_name}</option>)}
        </select>
      </label>
    ),
  },
  {
    id: "tile",
    title: "Games remaining tile",
    note: "The large split-flap counter on the Bowl Card: how many bowl games are left. Live, it picks a pace between 120 and 160 ms a flip. Tap it to flip again.",
    zoom: 1.6,
    tapToPlay: true,
    knobGroup: "tile",
    draw: ({ settings: { tiles, knobs }, plays }) => <BowlScoreTile key={`${plays}-${knobs.pace}-${tiles.remaining}`} large pace={knobs.pace} settled value={Number(tiles.remaining || 0)} />,
    controls: ({ tiles }, update) => <TextField label="Games left" maxLength={2} numeric onChange={(remaining) => update((current) => ({ ...current, tiles: { ...current.tiles, remaining } }))} value={tiles.remaining} />,
  },
  {
    id: "wins",
    title: "Player wins tile",
    note: "The small split-flap counter beside each player on the Bowl Card: their wins. Live, it picks a pace between 120 and 160 ms a flip. Tap it to flip again.",
    zoom: 2,
    tapToPlay: true,
    knobGroup: "wins",
    draw: ({ settings: { tiles, knobs }, plays }) => <BowlScoreTile key={`${plays}-${knobs.paceWins}-${tiles.wins}`} pace={knobs.paceWins} settled value={Number(tiles.wins || 0)} />,
    controls: ({ tiles }, update) => <TextField label="Player wins" maxLength={2} numeric onChange={(wins) => update((current) => ({ ...current, tiles: { ...current.tiles, wins } }))} value={tiles.wins} />,
  },
  {
    id: "football",
    title: "Loading football",
    note: "The loading screen: the ball turning slowly and smoothly on its long axis, tipped nose-up. Tap it to pause; paused, drag the ball to turn it by hand or step through its 108 frames. With reduced motion it holds still.",
    zoom: 1.3,
    dark: true,
    tapToPlay: true,
    knobGroup: "football",
    style: ({ knobs, football }) => ({ ...cssVars("football", knobs), "--scrub-i": FOOTBALL_FRAMES - football.frame + 0.5 }) as CSSProperties,
    draw: ({ settings: { knobs, football }, update }) => {
      const drag = (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.buttons !== 1) return;
        const by = Math.round(event.movementX / 3);
        if (by) update((current) => ({ ...current, football: { paused: true, frame: stepFrame(current.football.frame, by) } }));
      };
      // Paused, the ball turns under a dragging finger instead of the board moving.
      return (
        <div className={`asset-football ${football.paused ? "is-scrubbing" : ""} ${knobs["--football-wobble"] > 0 ? "has-wobble" : ""}`} data-own-gestures={football.paused ? "" : undefined} onPointerMove={football.paused ? drag : undefined}>
          <FootballLoader />
        </div>
      );
    },
    controls: ({ football }, update) => (
      <label className="asset-knob">
        <span>Frame</span>
        <input aria-label="Football frame" max={FOOTBALL_FRAMES} min={1} onChange={(event) => { const frame = Number(event.target.value); update((current) => ({ ...current, football: { paused: true, frame } })); }} step={1} type="range" value={football.frame} />
        <output>{football.paused ? `${football.frame}/${FOOTBALL_FRAMES}` : "playing"}</output>
      </label>
    ),
    actions: ({ football }, update) => <>
      <button className="asset-replay" onClick={() => update((current) => ({ ...current, football: { ...current.football, paused: !current.football.paused } }))} type="button">{football.paused ? "Play" : "Pause"}</button>
      <button className="asset-replay" onClick={() => update((current) => ({ ...current, football: { paused: true, frame: stepFrame(current.football.frame, -1) } }))} type="button">Step back</button>
      <button className="asset-replay" onClick={() => update((current) => ({ ...current, football: { paused: true, frame: stepFrame(current.football.frame, 1) } }))} type="button">Step on</button>
    </>,
  },
  {
    id: "stamp",
    title: "Result stamp",
    note: "The W or L stamped on a settled pick, as on the ticket and the Slate. Tap it to switch between W and L.",
    zoom: 2.2,
    tapToPlay: true,
    draw: ({ settings: { stamp }, plays }) => {
      const result = plays % 2 === 0 ? stamp.result : stamp.result === "win" ? "loss" : "win";
      return <span className="asset-stamp"><AtsResultStamp result={result} tilted={stamp.tilted === "yes"} variant={stamp.variant} /></span>;
    },
    controls: ({ stamp }, update) => <>
      <Choice label="Result" onChange={(result) => update((current) => ({ ...current, stamp: { ...current.stamp, result } }))} options={[["win", "W"], ["loss", "L"]] as const} value={stamp.result} />
      <Choice label="Style" onChange={(variant) => update((current) => ({ ...current, stamp: { ...current.stamp, variant } }))} options={[["ticket", "Ticket"], ["mark", "Slate mark"]] as const} value={stamp.variant} />
      <Choice label="Tilted" onChange={(tilted) => update((current) => ({ ...current, stamp: { ...current.stamp, tilted } }))} options={[["no", "No"], ["yes", "Yes"]] as const} value={stamp.tilted} />
    </>,
  },
  {
    id: "crest",
    title: "Bowl crest",
    note: "The Bowl Pool heading: gold rules that draw out from the stars, varsity lettering, and the season. Tap it to draw the rules again.",
    tapToPlay: true,
    knobGroup: "crest",
    style: (settings) => cssVars("crest", settings.knobs),
    draw: ({ settings: { crest }, plays }) => (
      <span className="asset-row" key={plays}>
        <BowlCrest seasonSuffix={crest.suffix} seasonYear={Number(crest.season) || 2026} title={crest.title || "BOWL CARD"} />
      </span>
    ),
    controls: ({ crest }, update) => <>
      <TextField label="Title" maxLength={14} onChange={(title) => update((current) => ({ ...current, crest: { ...current.crest, title: title.toUpperCase() } }))} value={crest.title} />
      <TextField label="Season" maxLength={4} numeric onChange={(season) => update((current) => ({ ...current, crest: { ...current.crest, season } }))} value={crest.season} />
      <TextField label="Ends with" maxLength={12} onChange={(suffix) => update((current) => ({ ...current, crest: { ...current.crest, suffix } }))} value={crest.suffix} />
    </>,
  },
  {
    id: "season-over",
    title: "Season over banner",
    zoom: 0.62,
    note: "What players see once the season is over.",
    draw: () => <div className="asset-banner"><SeasonClosedBanner /></div>,
  },
  {
    id: "eliminated",
    title: "Out of the race banner",
    zoom: 0.62,
    note: "What players see once they are out of the playoff race.",
    draw: () => <div className="asset-banner"><SeasonClosedBanner eliminated /></div>,
  },
];
export const pieceById = (id: string) => PIECES.find((piece) => piece.id === id);
