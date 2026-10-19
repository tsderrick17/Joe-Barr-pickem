"use client";

import { useState, type CSSProperties, type KeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import AtsResultStamp from "@/components/ats-result-stamp";
import { BowlCrest, BowlMegaphone } from "@/components/bowl-pool-marks";
import BowlScoreTile from "@/components/bowl-score-tile";
import FootballLoader from "@/components/football-loader";
import SeasonClosedBanner from "@/components/season-closed-banner";
import SurvivorPokerChip, { TOSS_DEFAULTS } from "@/components/survivor-poker-chip";
import { STROKE_JITTER_DEFAULTS, strokeJitter } from "@/lib/stroke-jitter";

/**
 * Every custom piece of the pool in one place, live: the real components with sample data. The sliders change only
 * this page (each value is a CSS variable or prop whose default is what players see), so a setting can be tried here
 * and then copied into the code. Nothing on this page reads or writes pool data.
 */

type Knob = { key: string; label: string; min: number; max: number; step: number; unit: string; live: number };

// The live value of every knob is the one the app uses today; the page starts there.
const KNOBS: Record<string, Knob[]> = {
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
type Values = Record<string, number>;
const initial = (): Values => Object.fromEntries(Object.values(KNOBS).flat().map((knob) => [knob.key, knob.live]));
const cssValue = (knob: Knob, value: number) => `${value}${knob.unit === "x" ? "" : knob.unit}`;
/** The CSS variables of one card, for its stage's style. */
const cssVars = (group: string, values: Values) => Object.fromEntries(KNOBS[group].filter((knob) => knob.key.startsWith("--")).map((knob) => [knob.key, cssValue(knob, values[knob.key])])) as CSSProperties;

function Knobs({ group, values, onChange }: { group: string; values: Values; onChange: (key: string, value: number) => void }) {
  return (
    <div className="asset-knobs">
      {KNOBS[group].map((knob) => (
        <label className="asset-knob" key={knob.key}>
          <span>{knob.label}</span>
          <input max={knob.max} min={knob.min} onChange={(event) => onChange(knob.key, Number(event.target.value))} step={knob.step} type="range" value={values[knob.key]} />
          <output>{values[knob.key]}{knob.unit === "x" ? "x" : knob.unit}</output>
        </label>
      ))}
    </div>
  );
}

function Choice<T extends string>({ label, options, value, onChange }: { label: string; options: Array<[T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="asset-choice" role="group">
      <span>{label}</span>
      <div>
        {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
      </div>
    </div>
  );
}

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
type ChipState = { team: string; state: "available" | "picked" | "official" | "unavailable"; size: "slate" | "ticket" | "summary"; spinning: boolean; tosses: number };
type StampState = { result: "win" | "loss"; variant: "ticket" | "mark"; tilted: "yes" | "no" };
/** The loading football has 108 frames in one turn. Paused, a frame is picked by hand; playing, it runs as it does for players. */
const FOOTBALL_FRAMES = 108;

function TextField({ label, value, onChange, maxLength = 24, numeric = false }: { label: string; value: string; onChange: (value: string) => void; maxLength?: number; numeric?: boolean }) {
  return (
    <label className="asset-choice">
      <span>{label}</span>
      <input className="asset-text" inputMode={numeric ? "numeric" : undefined} maxLength={maxLength} onChange={(event) => onChange(numeric ? event.target.value.replace(/\D/g, "") : event.target.value)} type="text" value={value} />
    </label>
  );
}

/** A card for one piece. With onPlay, clicking the piece itself runs its action; zoom shows it larger than live. */
function AssetCard({ title, note, children, actions, knobs, style, dark = false, wide = false, onPlay, zoom = 1 }: { title: string; note: string; children: ReactNode; actions?: ReactNode; knobs?: ReactNode; style?: CSSProperties; dark?: boolean; wide?: boolean; onPlay?: () => void; zoom?: number }) {
  const play = onPlay ? {
    "aria-label": `Play the ${title.toLowerCase()}`,
    onClick: onPlay,
    onKeyDown: (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onPlay(); } },
    role: "button",
    tabIndex: 0,
  } : {};
  return (
    <article className={`asset-card desk-card ${wide ? "is-wide" : ""}`}>
      <div>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className={`asset-stage ${dark ? "is-dark" : ""} ${onPlay ? "is-playable" : ""}`} style={{ ...style, "--asset-zoom": zoom } as CSSProperties} {...play}>{children}</div>
      {knobs}
      {actions ? <div className="asset-actions">{actions}</div> : null}
    </article>
  );
}


export default function CommissionerAssets() {
  const [values, setValues] = useState<Values>(initial);
  // Bumping a key remounts a demo, which restarts its animation from the beginning.
  const [keys, setKeys] = useState({ submit: 0, pennant: 0, tile: 0, crest: 0, football: 0 });
  const [copied, setCopied] = useState(false);
  const [chip, setChip] = useState<ChipState>({ team: "KC", state: "available", size: "ticket", spinning: false, tosses: 0 });
  const [stamp, setStamp] = useState<StampState>({ result: "win", variant: "ticket", tilted: "no" });
  const [pennantTeam, setPennantTeam] = useState<keyof typeof PENNANT_TEAMS>("ORE");
  const [stroke, setStroke] = useState(1);
  const [strokeText, setStrokeText] = useState("Chiefs");
  const [submitState, setSubmitState] = useState<"unsaved" | "saved">("unsaved");
  const [tiles, setTiles] = useState({ remaining: "12", wins: "7" });
  const [crestText, setCrestText] = useState({ title: "BOWL CARD", season: "2026", suffix: "Special" });
  // The football: playing, or paused on a chosen frame (1 to 108).
  const [football, setFootball] = useState({ paused: false, frame: 1 });
  const stepFootball = (by: number) => setFootball((current) => ({ paused: true, frame: ((current.frame - 1 + by + FOOTBALL_FRAMES) % FOOTBALL_FRAMES) + 1 }));
  const dragFootball = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.buttons !== 1) return;
    const by = Math.round(event.movementX / 3);
    if (by) stepFootball(by);
  };
  const toss = () => setChip((current) => ({ ...current, tosses: current.tosses + 1 }));
  const replay = (name: keyof typeof keys) => () => setKeys((current) => ({ ...current, [name]: current[name] + 1 }));
  const change = (key: string, value: number) => setValues((current) => ({ ...current, [key]: value }));
  const knobs = (group: string) => <Knobs group={group} onChange={change} values={values} />;
  const resetGroup = (group: string) => () => setValues((current) => ({ ...current, ...Object.fromEntries(KNOBS[group].map((knob) => [knob.key, knob.live])) }));
  const actions = (group: string, name?: keyof typeof keys) => <>
    {name ? <button className="asset-replay" onClick={replay(name)} type="button">Replay</button> : null}
    <button className="asset-replay" onClick={resetGroup(group)} type="button">Live values</button>
  </>;
  const changed = Object.values(KNOBS).flat().filter((knob) => values[knob.key] !== knob.live);
  const summary = changed.length
    ? changed.map((knob) => `${knob.label} (${knob.key}): ${cssValue(knob, values[knob.key])}, live ${cssValue(knob, knob.live)}`).join("\n")
    : "Every setting is at its live value.";
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* the text is on screen to copy by hand */ }
  };

  return (
    <section aria-labelledby="commissioner-assets-title" className="commissioner-panel">
      <div className="workshop-heading">
        <p className="club-eyebrow-dark">Every custom piece of the pool, live</p>
        <h2 id="commissioner-assets-title">Workshop</h2>
        <p>Touch anything: tap or drag a piece, change a setting, type your own words. Nothing here touches pool data. Copy what you like from Your settings at the bottom.</p>
      </div>
      <div className="commissioner-assets">
        <AssetCard actions={<button className="asset-replay" onClick={resetGroup("chip")} type="button">Live values</button>} knobs={<>
          <label className="asset-choice">
            <span>Team</span>
            <select className="asset-select" onChange={(event) => setChip((current) => ({ ...current, team: event.target.value }))} value={chip.team}>
              {CHIP_TEAMS.map(([key, name]) => <option key={key} value={key}>{name}</option>)}
            </select>
          </label>
          <Choice label="State" onChange={(state) => setChip((current) => ({ ...current, state }))} options={[["available", "Available"], ["picked", "Picked"], ["official", "Official"], ["unavailable", "Unavailable"]]} value={chip.state} />
          <Choice label="Size" onChange={(size) => setChip((current) => ({ ...current, size }))} options={[["summary", "Small"], ["slate", "Slate"], ["ticket", "Ticket"]]} value={chip.size} />
          <Choice label="Idle spin" onChange={(spin) => setChip((current) => ({ ...current, spinning: spin === "on" }))} options={[["off", "Off"], ["on", "On"]]} value={chip.spinning ? "on" : "off"} />
          {knobs("chip")}
        </>} note="One Survivor chip: choose its team, state and size, and click it to toss it. Each toss leans its axis and runs for a random time within the limits below." title="Survivor poker chip" zoom={1.5}>
          <button aria-label="Toss the chip" className={`asset-chip-button is-${chip.size}`} onClick={toss} type="button">
            <SurvivorPokerChip
              abbreviation={chip.team}
              animate={chip.tosses > 0}
              idleSpin={chip.spinning}
              key={`${chip.tosses}-${chip.team}-${chip.size}`}
              official={chip.state === "official"}
              selected={chip.state === "picked" || chip.state === "official"}
              showEdge
              size={chip.size}
              teamName={CHIP_TEAMS.find(([key]) => key === chip.team)?.[1] ?? chip.team}
              tossRange={{ leanMin: Math.min(values.leanMin, values.leanMax), leanMax: Math.max(values.leanMin, values.leanMax), msMin: Math.min(values.msMin, values.msMax), msMax: Math.max(values.msMin, values.msMax) }}
              unavailable={chip.state === "unavailable"}
            />
          </button>
        </AssetCard>

        <AssetCard actions={actions("submit")} knobs={<><Choice label="Picks" onChange={setSubmitState} options={[["unsaved", "Unsaved"], ["saved", "Saved"]]} value={submitState} />{knobs("submit")}</>} note="The receipt's Submit button. While picks are unsaved a sheen sweeps across it and then it presses itself, once per cycle. Click it to start the cycle over." onPlay={replay("submit")} style={cssVars("submit", values)} title="Submit button" zoom={1.5}>
          <div className="asset-submit slate-receipt-ticket" key={keys.submit}>
            <button className={`slate-receipt-print ${submitState === "unsaved" ? "needs-attention" : ""}`} type="button">SUBMIT</button>
          </div>
        </AssetCard>

        <AssetCard actions={actions("highlight")} knobs={<><TextField label="Name" maxLength={18} onChange={setStrokeText} value={strokeText} />{knobs("highlight")}</>} note="The pen stroke that marks a Slate pick, sweeping in from the left. Each stroke wanders a little at random within the wander limits; click it to draw a new one." onPlay={() => setStroke((current) => current + 1)} style={cssVars("highlight", values)} title="Pick highlight" zoom={1.4}>
          <span className="asset-highlight" key={stroke}>
            <span className="slate-team-label slate-team-label--selected slate-team-label--from-left slate-team-label--new" style={strokeJitter(`asset-${stroke}`, { x: values.jitterX, y: values.jitterY, turn: values.jitterTurn })}><span>{strokeText || "Chiefs"}</span></span>
          </span>
        </AssetCard>


        <AssetCard actions={actions("pennant")} knobs={<><label className="asset-choice"><span>School</span><select className="asset-select" onChange={(event) => setPennantTeam(event.target.value as keyof typeof PENNANT_TEAMS)} value={pennantTeam}>{Object.values(PENNANT_TEAMS).map((team) => <option key={team.abbreviation} value={team.abbreviation}>{team.short_name}</option>)}</select></label>{knobs("pennant")}</>} note="A cheerleader's megaphone in the school's colors, raised when a Bowl Pool team is picked. Click it to raise it again." onPlay={replay("pennant")} style={cssVars("pennant", values)} title="Bowl Pool megaphone" zoom={2}>
          <span className="bowl-team-pick is-new" key={`${keys.pennant}-${pennantTeam}`}><BowlMegaphone side="left" team={PENNANT_TEAMS[pennantTeam]} /></span>
        </AssetCard>

        <AssetCard actions={actions("tile")} knobs={<><TextField label="Games left" maxLength={2} numeric onChange={(remaining) => setTiles((current) => ({ ...current, remaining }))} value={tiles.remaining} /><TextField label="Player wins" maxLength={2} numeric onChange={(wins) => setTiles((current) => ({ ...current, wins }))} value={tiles.wins} />{knobs("tile")}</>} note="The split-flap counter on the Bowl Card: the large Games Remaining tile and a player's wins. Live, each tile picks a pace between 120 and 160 ms. Click them to flip again." onPlay={replay("tile")} title="Split-flap tiles" zoom={1.6}>
          <span className="asset-row" key={`${keys.tile}-${values.pace}-${tiles.remaining}-${tiles.wins}`}>
            <BowlScoreTile large pace={values.pace} settled value={Number(tiles.remaining || 0)} />
            <BowlScoreTile landDelay={300} pace={values.pace} settled value={Number(tiles.wins || 0)} />
          </span>
        </AssetCard>

        <AssetCard actions={<>
          <button className="asset-replay" onClick={() => setFootball((current) => ({ ...current, paused: !current.paused }))} type="button">{football.paused ? "Play" : "Pause"}</button>
          <button className="asset-replay" onClick={() => stepFootball(-1)} type="button">Step back</button>
          <button className="asset-replay" onClick={() => stepFootball(1)} type="button">Step on</button>
          {actions("football")}
        </>} dark knobs={<>
          <label className="asset-knob">
            <span>Frame</span>
            <input aria-label="Football frame" max={FOOTBALL_FRAMES} min={1} onChange={(event) => setFootball({ paused: true, frame: Number(event.target.value) })} step={1} type="range" value={football.frame} />
            <output>{football.paused ? `${football.frame}/${FOOTBALL_FRAMES}` : "playing"}</output>
          </label>
          {knobs("football")}
        </>} note="The loading screen: the ball turning slowly and smoothly on its long axis, tipped nose-up. Drag the ball to turn it by hand, pause it on any of its 108 frames, or step through them. With reduced motion it holds still." style={{ ...cssVars("football", values), "--scrub-i": FOOTBALL_FRAMES - football.frame + .5 } as CSSProperties} title="Loading football" zoom={1.3}>
          <div className={`asset-football ${football.paused ? "is-scrubbing" : ""} ${values["--football-wobble"] > 0 ? "has-wobble" : ""}`} onPointerMove={dragFootball}>
            <FootballLoader />
          </div>
        </AssetCard>

        <AssetCard knobs={<>
          <Choice label="Result" onChange={(result) => setStamp((current) => ({ ...current, result }))} options={[["win", "W"], ["loss", "L"]]} value={stamp.result} />
          <Choice label="Style" onChange={(variant) => setStamp((current) => ({ ...current, variant }))} options={[["ticket", "Ticket"], ["mark", "Slate mark"]]} value={stamp.variant} />
          <Choice label="Tilted" onChange={(tilted) => setStamp((current) => ({ ...current, tilted }))} options={[["no", "No"], ["yes", "Yes"]]} value={stamp.tilted} />
        </>} note="The W or L stamped on a settled pick, as on the ticket and the Slate. Click it to switch between W and L." onPlay={() => setStamp((current) => ({ ...current, result: current.result === "win" ? "loss" : "win" }))} title="Result stamp" zoom={2.6}>
          <span className="asset-stamp"><AtsResultStamp result={stamp.result} tilted={stamp.tilted === "yes"} variant={stamp.variant} /></span>
        </AssetCard>

        <AssetCard actions={actions("crest")} knobs={<><TextField label="Title" maxLength={14} onChange={(title) => setCrestText((current) => ({ ...current, title: title.toUpperCase() }))} value={crestText.title} /><TextField label="Season" maxLength={4} numeric onChange={(season) => setCrestText((current) => ({ ...current, season }))} value={crestText.season} /><TextField label="Ends with" maxLength={12} onChange={(suffix) => setCrestText((current) => ({ ...current, suffix }))} value={crestText.suffix} />{knobs("crest")}</>} note="The Bowl Pool heading: gold rules that draw out from the stars, varsity lettering, and the season. Click it to draw the rules again." onPlay={replay("crest")} style={cssVars("crest", values)} title="Bowl crest">
          <span className="asset-row" key={keys.crest}>
            <BowlCrest seasonYear={Number(crestText.season) || 2026} seasonSuffix={crestText.suffix} title={crestText.title || "BOWL CARD"} />
          </span>
        </AssetCard>

        <AssetCard note="What players see once the season is over, and once they are out of the playoff race." title="Season closed banners" wide>
          <div className="asset-banners">
            <SeasonClosedBanner />
            <SeasonClosedBanner eliminated />
          </div>
        </AssetCard>

        <article className="asset-card desk-card asset-settings">
          <div>
            <h3>Your settings</h3>
            <p>Anything changed from the live value. Copy it and send it over to make it the new default.</p>
          </div>
          <pre>{summary}</pre>
          <div className="asset-actions">
            <button className="asset-replay" disabled={!changed.length} onClick={() => void copy()} type="button">{copied ? "Copied" : "Copy settings"}</button>
            <button className="asset-replay" disabled={!changed.length} onClick={() => setValues(initial())} type="button">Reset all</button>
          </div>
        </article>
      </div>
    </section>
  );
}
