"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import AtsResultStamp from "@/components/ats-result-stamp";
import { BowlCrest, BowlPennant } from "@/components/bowl-pool-marks";
import BowlScoreTile from "@/components/bowl-score-tile";
import ChipPlayground from "@/components/chip-playground";
import FootballLoader from "@/components/football-loader";
import SeasonClosedBanner from "@/components/season-closed-banner";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

/**
 * Every custom piece of the pool in one place, live: the real components with sample data. The sliders change only
 * this page (each value is a CSS variable or prop whose default is what players see), so a setting can be tried here
 * and then copied into the code. Nothing on this page reads or writes pool data.
 */

type Knob = { key: string; label: string; min: number; max: number; step: number; unit: string; live: number };

// The live value of every knob is the one the app uses today; the page starts there.
const KNOBS: Record<string, Knob[]> = {
  submit: [{ key: "--receipt-attention-cycle", label: "Sheen + press every", min: 2, max: 30, step: 0.5, unit: "s", live: 15 }],
  highlight: [
    { key: "--selection-sweep-ms", label: "Sweep length", min: 150, max: 2000, step: 10, unit: "ms", live: 720 },
    { key: "--selection-sweep-delay", label: "Delay", min: 0, max: 600, step: 5, unit: "ms", live: 35 },
  ],
  chip: [{ key: "tossMs", label: "Toss length", min: 300, max: 2500, step: 20, unit: "ms", live: 900 }],
  pennant: [{ key: "--pennant-raise-ms", label: "Raise length", min: 150, max: 2000, step: 10, unit: "ms", live: 620 }],
  tile: [{ key: "pace", label: "Time per flip", min: 40, max: 400, step: 5, unit: "ms", live: 140 }],
  football: [
    { key: "--football-spin-s", label: "Time per turn", min: 0.15, max: 2, step: 0.01, unit: "s", live: 0.42 },
    { key: "--football-tilt", label: "Tilt", min: 0, max: 90, step: 1, unit: "deg", live: 50 },
    { key: "--football-wobble", label: "Wobble size", min: 0, max: 10, step: 0.1, unit: "deg", live: 1.4 },
    { key: "--football-wobble-s", label: "Wobble pace", min: 0.3, max: 5, step: 0.1, unit: "s", live: 1.9 },
    { key: "--football-scale", label: "Size", min: 0.5, max: 2.5, step: 0.05, unit: "x", live: 1 },
  ],
  crest: [
    { key: "--crest-rule-ms", label: "Rule draw length", min: 150, max: 3000, step: 10, unit: "ms", live: 720 },
    { key: "--crest-rule-delay", label: "Delay", min: 0, max: 1000, step: 10, unit: "ms", live: 120 },
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

function AssetCard({ title, note, children, actions, knobs, style, dark = false, wide = false }: { title: string; note: string; children: ReactNode; actions?: ReactNode; knobs?: ReactNode; style?: CSSProperties; dark?: boolean; wide?: boolean }) {
  return (
    <article className={`asset-card ${wide ? "is-wide" : ""}`}>
      <div>
        <h3>{title}</h3>
        <p>{note}</p>
      </div>
      <div className={`asset-stage ${dark ? "is-dark" : ""}`} style={style}>{children}</div>
      {knobs}
      {actions ? <div className="asset-actions">{actions}</div> : null}
    </article>
  );
}

const OREGON = { full_name: "Oregon Ducks", short_name: "Oregon", abbreviation: "ORE", primary_color: "154733", secondary_color: "fee123" };
const TROY = { full_name: "Troy Trojans", short_name: "Troy", abbreviation: "TROY", primary_color: "8a2432", secondary_color: "b1b3b3" };
const MARSHALL = { full_name: "Marshall Thundering Herd", short_name: "Marshall", abbreviation: "MRSH", primary_color: "00b140", secondary_color: "ffffff" };

export default function CommissionerAssets() {
  const [values, setValues] = useState<Values>(initial);
  // Bumping a key remounts a demo, which restarts its animation from the beginning.
  const [keys, setKeys] = useState({ submit: 0, highlight: 0, pennant: 0, tile: 0, chip: 0, crest: 0, football: 0 });
  const [copied, setCopied] = useState(false);
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
      <div className="pickem-ledger-masthead">
        <h2 id="commissioner-assets-title">Assets</h2>
      </div>
      <div className="commissioner-assets">
        <AssetCard actions={actions("submit", "submit")} knobs={knobs("submit")} note="The receipt's Submit button. While picks are unsaved a sheen sweeps across it and then it presses itself, once per cycle." style={cssVars("submit", values)} title="Submit button">
          <div className="asset-submit slate-receipt-ticket" key={keys.submit}>
            <button className="slate-receipt-print needs-attention" type="button">SUBMIT</button>
          </div>
        </AssetCard>

        <AssetCard actions={actions("highlight", "highlight")} knobs={knobs("highlight")} note="The pen stroke that marks a Slate pick, sweeping in from the left when a team is picked." style={cssVars("highlight", values)} title="Pick highlight">
          <span className="asset-highlight" key={keys.highlight}>
            <span className="slate-team-label slate-team-label--selected slate-team-label--from-left slate-team-label--new"><span>Kansas City Chiefs</span></span>
          </span>
        </AssetCard>

        <AssetCard actions={actions("chip", "chip")} knobs={knobs("chip")} note="The Survivor chip, in the sizes the pool uses. Toss the Raiders chip (click) or turn it by hand (drag)." title="Survivor poker chips">
          <span key={keys.chip} style={{ display: "contents" }}>
            <span className="asset-chip"><SurvivorPokerChip abbreviation="KC" size="slate" teamName="Kansas City Chiefs" /></span>
            <span className="asset-chip"><SurvivorPokerChip abbreviation="BUF" selected size="slate" teamName="Buffalo Bills" /></span>
            <SurvivorPokerChip abbreviation="DAL" official size="ticket" teamName="Dallas Cowboys" />
            <SurvivorPokerChip abbreviation="SF" size="summary" teamName="San Francisco 49ers" unavailable />
          </span>
          <ChipPlayground tossMs={values.tossMs} />
        </AssetCard>

        <AssetCard actions={actions("pennant", "pennant")} knobs={knobs("pennant")} note="A felt pennant in the school's colors, raised beside a Bowl Pool pick." style={cssVars("pennant", values)} title="Bowl Pool pennants">
          <span key={keys.pennant} style={{ display: "contents" }}>
            {[OREGON, TROY, MARSHALL].map((team) => (
              <span className="bowl-team-pick is-new" key={team.abbreviation}><BowlPennant side="left" team={team} /></span>
            ))}
          </span>
        </AssetCard>

        <AssetCard actions={actions("tile", "tile")} knobs={knobs("tile")} note="The split-flap counter on the Bowl Card: the large Games Remaining tile and a player's wins. Live, each tile picks a pace between 120 and 160 ms." title="Split-flap tiles">
          <span key={`${keys.tile}-${values.pace}`} style={{ display: "contents" }}>
            <BowlScoreTile large pace={values.pace} settled value={12} />
            <BowlScoreTile landDelay={300} pace={values.pace} settled value={7} />
          </span>
        </AssetCard>

        <AssetCard actions={actions("football")} dark knobs={knobs("football")} note="The loading screen: the ball in a tight spiral, tipped nose-up, with a small wobble. With reduced motion it holds still." style={cssVars("football", values)} title="Loading football">
          <FootballLoader />
        </AssetCard>

        <AssetCard note="The upright W and L stamped on a settled pick, as on the ticket and the Slate." title="Result stamps">
          <AtsResultStamp result="win" tilted={false} variant="ticket" />
          <AtsResultStamp result="loss" tilted={false} variant="ticket" />
          <AtsResultStamp result="win" />
          <AtsResultStamp result="loss" />
        </AssetCard>

        <AssetCard actions={actions("crest", "crest")} knobs={knobs("crest")} note="The Bowl Pool heading: gold rules that draw out from the stars, varsity lettering, and the season." style={cssVars("crest", values)} title="Bowl crest">
          <span key={keys.crest} style={{ display: "contents" }}>
            <BowlCrest seasonYear={2026} seasonSuffix="Special" title="BOWL CARD" />
          </span>
        </AssetCard>

        <AssetCard note="What players see once the season is over, and once they are out of the playoff race." title="Season closed banners" wide>
          <div className="asset-banners">
            <SeasonClosedBanner />
            <SeasonClosedBanner eliminated />
          </div>
        </AssetCard>

        <article className="asset-card asset-settings">
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
