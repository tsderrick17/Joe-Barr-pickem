"use client";

import { useCallback, useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import { gridArea, layoutPlaces, mergeSaved, WORKSHOP_LAYOUTS, WORKSHOP_ORDER, WORKSHOP_SAVED_KEY } from "@/lib/workshop-board.js";
import { changedSummary, defaultSettings, KNOBS, knobsFor, liveEase, liveKnobs, pieceById, SAVED_RULES, ZoomControl, type Piece, type Settings } from "@/components/workshop-pieces";
import { Sheet } from "@/components/commissioner/wheel-parts";

/**
 * The Workshop: every custom piece of the pool once, packed into one board with no gaps, each in a tile shaped for it (a map for a phone,
 * a tablet and a computer, in src/lib/workshop-board.js). Tapping a piece plays it. Its settings stay out of sight until its tune button is
 * tapped, which opens them in a sheet. Settings are remembered on this device; Your settings gives the text to send so a value becomes what
 * players see.
 */

type Update = (change: (current: Settings) => Settings) => void;

function readSettings(): Settings {
  try {
    const saved = window.localStorage.getItem(WORKSHOP_SAVED_KEY);
    return saved ? mergeSaved(defaultSettings(), JSON.parse(saved), SAVED_RULES) as Settings : defaultSettings();
  } catch { return defaultSettings(); }
}

const tuneIcon = (
  <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" viewBox="0 0 16 16" width="14">
    <path d="M2 4h12M2 8h12M2 12h12" /><circle cx="5" cy="4" fill="currentColor" r="1.6" /><circle cx="11" cy="8" fill="currentColor" r="1.6" /><circle cx="7" cy="12" fill="currentColor" r="1.6" />
  </svg>
);

// Each piece's grid area on a phone, a tablet and a computer, worked out once from the maps.
const PLACES = Object.fromEntries(Object.entries(WORKSHOP_LAYOUTS).map(([size, rows]) => [size, layoutPlaces(rows)])) as Record<keyof typeof WORKSHOP_LAYOUTS, Record<string, Parameters<typeof gridArea>[0]>>;
const areas = (id: string) => ({ "--at-phone": gridArea(PLACES.phone[id]), "--at-tablet": gridArea(PLACES.tablet[id]), "--at-desktop": gridArea(PLACES.desktop[id]) }) as CSSProperties;

/** One piece in its tile. Tapping plays it; the tune button opens its settings. */
function Tile({ piece, settings, update, labels, selected, onTune, playAll }: { piece: Piece; settings: Settings; update: Update; labels: boolean; selected: boolean; onTune: () => void; playAll: number }) {
  const [own, setOwn] = useState(0);
  const plays = own + playAll;   // Play everything plays every piece at once
  const play = () => setOwn((count) => count + 1);
  const tap = piece.tapToPlay ? {
    "aria-label": `Play the ${piece.title.toLowerCase()}`,
    onClick: play,
    onKeyDown: (event: KeyboardEvent) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); play(); } },
    role: "button",
    tabIndex: 0,
  } : {};
  return (
    <div className={`workshop-tile ${piece.dark ? "is-dark" : ""} ${selected ? "is-selected" : ""}`} data-piece={piece.id} style={areas(piece.id)}>
      <div className={`workshop-stage ${piece.tapToPlay ? "is-playable" : ""}`} style={{ ...piece.style?.(settings), "--asset-zoom": (piece.zoom ?? 1) * (settings.zoom[piece.id] ?? 1) } as CSSProperties} {...tap}>
        {piece.draw({ settings, update, plays, play, copy: "shelf" })}
      </div>
      {labels ? <span className="workshop-label">{piece.title}</span> : null}
      <button aria-label={`Tune the ${piece.title.toLowerCase()}`} className="workshop-tune" onClick={onTune} type="button">{tuneIcon}</button>
    </div>
  );
}

/** The settings of one piece. */
function TuneControls({ piece, settings, update }: { piece: Piece; settings: Settings; update: Update }) {
  const group = piece.knobGroup;
  const resetGroup = () => update((current) => ({
    ...current,
    knobs: group ? { ...current.knobs, ...Object.fromEntries(KNOBS[group].map((knob) => [knob.key, knob.live])) } : current.knobs,
    ease: piece.easeTarget ? { ...current.ease, [piece.easeTarget]: "live" } : current.ease,
  }));
  return (
    <div className="workshop-panel">
      <p>{piece.note}</p>
      <div className="workshop-panel-controls">
        {piece.controls?.(settings, update)}
        {group ? knobsFor(group, settings, update) : null}
        <ZoomControl piece={piece} settings={settings} update={update} />
      </div>
      {piece.actions || group || piece.easeTarget ? (
        <div className="asset-actions">
          {piece.actions?.(settings, update)}
          {group || piece.easeTarget ? <button className="asset-replay" onClick={resetGroup} type="button">Live values</button> : null}
        </div>
      ) : null}
    </div>
  );
}

export default function WorkshopBoard() {
  const [settings, setSettings] = useState<Settings>(readSettings);
  const update = useCallback<Update>((change) => setSettings(change), []);
  const [tuning, setTuning] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [playAll, setPlayAll] = useState(0);

  useEffect(() => {
    try { window.localStorage.setItem(WORKSHOP_SAVED_KEY, JSON.stringify(settings)); } catch { /* this device keeps nothing; the showroom still works */ }
  }, [settings]);

  const summary = changedSummary(settings);
  const copy = async () => {
    try { await navigator.clipboard.writeText(summary.text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); } catch { /* the text is on screen to copy by hand */ }
  };
  const tuned = tuning ? pieceById(tuning) : undefined;

  return (
    <div className="workshop">
      <div aria-label="Workshop" className="workshop-bar" role="group">
        <label className="workshop-switch">
          <input checked={settings.view.labels} onChange={(event) => { const labels = event.target.checked; update((current) => ({ ...current, view: { labels } })); }} type="checkbox" />
          Show names
        </label>
        <button className="asset-replay" onClick={() => setPlayAll((count) => count + 1)} type="button">Play everything</button>
        <button className="asset-replay" onClick={() => setSettingsOpen(true)} type="button">
          Your settings{summary.count ? <span className="workshop-count">{summary.count}</span> : null}
        </button>
      </div>

      <div aria-label="Every piece" className="workshop-board" role="group">
        {WORKSHOP_ORDER.map((id) => {
          const piece = pieceById(id);
          if (!piece) return null;
          return <Tile
            key={id}
            labels={settings.view.labels}
            onTune={() => setTuning(piece.id)}
            piece={piece}
            playAll={playAll}
            selected={tuning === piece.id}
            settings={settings}
            update={update}
          />;
        })}
      </div>

      <Sheet onClose={() => setTuning(null)} open={Boolean(tuned)} title={tuned ? `${tuned.title} settings` : "Settings"}>
        {tuned ? <TuneControls piece={tuned} settings={settings} update={update} /> : null}
      </Sheet>

      <Sheet onClose={() => setSettingsOpen(false)} open={settingsOpen} title="Your settings">
        <div className="workshop-settings">
          <p>Anything changed from the live value. Copy it and send it over to make it the new default.</p>
          <pre>{summary.text}</pre>
          <div className="asset-actions">
            <button className="asset-replay" disabled={!summary.count} onClick={() => void copy()} type="button">{copied ? "Copied" : "Copy settings"}</button>
            <button className="asset-replay" disabled={!summary.count} onClick={() => update((current) => ({ ...current, knobs: liveKnobs(), ease: liveEase() }))} type="button">Reset all</button>
          </div>
        </div>
      </Sheet>
    </div>
  );
}
