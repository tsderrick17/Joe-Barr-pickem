"use client";

import AllTimeTable, { type AllTimeRow } from "@/components/all-time-table";
import TrophyTurntable from "@/components/trophy-turntable";

type Pool = "pickem" | "survivor" | "bowl";
const POOL_LABEL: Record<Pool, string> = { pickem: "Pick’em", survivor: "Survivor", bowl: "Bowl Pool" };
type Champions = { season: string } & Record<Pool, string>;

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
      <PlaquesShelf seasons={seasons} />
      <AllTimeTable heading="Records" players={players} />
    </div>
  );
}

/** The plaques, one for every season that has a champion, side by side. */
function PlaquesShelf({ seasons }: { seasons: Champions[] }) {
  return (
    <div className="lab-room-stack">
      <div className="lab-case lab-wall">
        <section aria-label="Plaques" className="lab-wall-part">
          <h4>Plaques</h4>
          <div className="lab-case-shelf">
            {seasons.length ? seasons.map((year) => <Plaque key={year.season} year={year} />) : <p className="lab-wall-empty">No champions yet.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
