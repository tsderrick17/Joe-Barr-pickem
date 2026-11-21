"use client";

import { useState } from "react";
import AllTimeTable, { type AllTimeRow } from "@/components/all-time-table";
import TrophyTurntable from "@/components/trophy-turntable";
import { Chips } from "@/components/clubhouse/chips";

type Pool = "pickem" | "survivor" | "bowl";
const POOL_LABEL: Record<Pool, string> = { pickem: "Pick’em", survivor: "Survivor", bowl: "Bowl Pool" };
export type Champions = { season: string } & Record<Pool, string>;

/**
 * A season's plaque, kept quiet: satin brass with indented corners on walnut, one engraved keyline, the year over a diamond
 * rule, and each champion at the end of a dotted leader.
 */
function Plaque({ year }: { year: Champions }) {
  return (
    <article aria-label={`${year.season} champions`} className="lab-plaque">
      <div className="lab-plaque-plate">
        <p className="lab-plaque-season">{year.season}</p>
        <span aria-hidden="true" className="lab-plaque-rule" />
        <dl>
          {(["pickem", "survivor", "bowl"] as const).map((pool) => (
            <div key={pool}>
              <dt>{POOL_LABEL[pool]}</dt>
              <dd>{year[pool]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

type RealSeason = { seasonYear: number; pickem: Array<{ name: string }> | null; survivor: Array<{ name: string }> | null; bowl: Array<{ name: string }> | null };
type RealPlayer = AllTimeRow;
const names = (list: Array<{ name: string }> | null) => (list?.length ? list.map((champion) => champion.name).join(" & ") : "—");

/**
 * The Trophy Room on the pool's real champions and records (the Trophy Room page's own read): the trophies on their turning table, a plaque
 * for every season that has a champion (side by side, up to three a row), and the All-Time Table with its Record / Other Stats switch.
 */
export function RealTrophyRoom({ trophies, players }: { trophies: RealSeason[]; players: RealPlayer[] }) {
  const seasons = [...trophies].sort((a, b) => b.seasonYear - a.seasonYear).map((year) => ({ season: String(year.seasonYear), pickem: names(year.pickem), survivor: names(year.survivor), bowl: names(year.bowl) }));
  return (
    <div className="lab-room-stack lab-wall-table">
      <TrophyTurntable seasons={trophies} />
      <PlaquesShelf seasons={seasons} scenes={false} />
      <AllTimeTable heading="Records" players={players} />
    </div>
  );
}

/** The plaques, one for every season, and the pennant a new champion is given. */
export function PlaquesShelf({ seasons, scenes = true }: { seasons: Champions[]; scenes?: boolean }) {
  const [scene, setScene] = useState<"plaques" | "crowning">("plaques");
  const [crownings, setCrownings] = useState(0);
  return (
    <div className="lab-room-stack">
      {scenes ? <div className="lab-room-controls">
        <Chips label="Scene" onChange={(next) => { setScene(next); if (next === "crowning") setCrownings((count) => count + 1); }} options={[["plaques", "The plaques"], ["crowning", "A champion is crowned"]] as const} value={scene} />
      </div> : null}
      <div className="lab-case lab-wall">
        {scene === "crowning" ? (
          <div className="lab-crowning" key={crownings}>
            <span aria-hidden="true" className="lab-crowning-rod" />
            <div className="lab-pennant" role="img" aria-label="2026 Pick'em champion: Earl">
              <span>2026 CHAMPION</span>
              <strong>EARL</strong>
              <small>PICK’EM</small>
            </div>
          </div>
        ) : null}
        <section aria-label="Plaques" className="lab-wall-part">
          <h4>Plaques <small>one for every season</small></h4>
          <div className="lab-case-shelf">
            {seasons.length ? seasons.map((year) => <Plaque key={year.season} year={year} />) : <p className="lab-wall-empty">No champions yet.</p>}
          </div>
        </section>
        {scenes ? <div className="lab-case-countdown"><span>THE 2027 SEASON OPENS AUG 1</span><strong>172 DAYS</strong><small>sample date: Feb 10</small></div> : null}
      </div>
    </div>
  );
}
