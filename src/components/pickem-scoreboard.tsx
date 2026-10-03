import { useId, useState } from "react";
import PlayerTrophyName from "@/components/player-trophy-name";
import AtsResultStamp from "@/components/ats-result-stamp";
import { scorepadAbbreviation } from "@/lib/scorepad-abbreviations";
import SeasonSnapshot from "@/components/season-snapshot";

export type PickemScoreboardPick = {
  label: string | null;
  abbreviation?: string | null;
  isHidden: boolean;
  resultMark: string;
  spread?: string | null;
  isLineLocked?: boolean;
};

export type PickemScoreboardRow = {
  id: string;
  firstName: string;
  wins: number;
  playoffEliminated?: boolean;
  trophies?: string[];
  picks: PickemScoreboardPick[];
};

function compactPickLabel(label: string, abbreviation?: string | null) {
  if (abbreviation) return scorepadAbbreviation(abbreviation);
  const words = label.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/).filter(Boolean);
  const fallback = words.length > 1 ? words.map((word) => word[0]).join("") : (words[0] ?? "NFL");
  return scorepadAbbreviation(fallback.slice(0, 3));
}

type Props = {
  isPlayoff?: boolean;
  rows: PickemScoreboardRow[];
  viewerPlayerId: string;
  maxPicks: number;
  week: string;
  hideEliminatedRows?: boolean;
  onToggleEliminatedRows?: () => void;
  isCommissioner?: boolean;
  seasonSnapshotReleased?: boolean;
};

/** Two half-circle arrows chasing each other with a gap between them. */
function FlipIcon({ spin }: { spin: number }) {
  const markerId = `flip-arrow-${useId().replace(/:/g, "")}`;
  return <svg aria-hidden="true" className={spin ? "pad-flip-icon is-spinning" : "pad-flip-icon"} fill="none" height="18" key={spin} viewBox="0 0 24 24" width="18">
    <defs>
      <marker id={markerId} markerHeight="5" markerUnits="userSpaceOnUse" markerWidth="5" orient="auto" refX="6" refY="5" viewBox="0 0 10 10">
        <path d="M2.2 1.6 L7 5 L2.2 8.4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.2" />
      </marker>
    </defs>
    <path d="M4.48 9.26 A8 8 0 0 1 18.2 7.2" markerEnd={`url(#${markerId})`} stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
    <path d="M19.52 14.74 A8 8 0 0 1 5.8 16.8" markerEnd={`url(#${markerId})`} stroke="currentColor" strokeLinecap="round" strokeWidth="1.6" />
  </svg>;
}

export default function PickemScoreboard({
  isPlayoff = false,
  rows,
  maxPicks,
  week,
  hideEliminatedRows = false,
  onToggleEliminatedRows,
  isCommissioner = false,
  seasonSnapshotReleased = false,
}: Props) {
  const hasEliminatedRows = rows.some((row) => row.playoffEliminated);
  const displayedRows = hideEliminatedRows ? rows.filter((row) => !row.playoffEliminated) : rows;
  const isDensePlayoffRound = isPlayoff && maxPicks >= 4;
  // Commissioners always; players from Week 6 until the Aug 1 season reset.
  const showSeasonSnapshot = isCommissioner || seasonSnapshotReleased;
  const snapshotRefreshKey = rows.map((row) => `${row.id}:${row.wins}:${row.picks.map((pick) => pick.resultMark).join(",")}`).join("|");
  // Commissioners can turn the pad over to see the season chart on its back.
  const [flipped, setFlipped] = useState(false);
  const [spin, setSpin] = useState(0);
  const flipButton = showSeasonSnapshot ? <button aria-label={flipped ? "Show the Pick'em Pad" : "Show the Season Snapshot"} aria-pressed={flipped} className="pad-flip-button" onClick={() => { setFlipped((current) => !current); setSpin((current) => current + 1); }} title={flipped ? "Back to the pad" : "Season Snapshot"} type="button"><FlipIcon spin={spin} /></button> : null;

  return (
    <section className={`pickem-ledger pickem-scoreboard-ledger py-4 sm:py-5 ${isPlayoff ? "playoff-scoreboard" : ""} ${isDensePlayoffRound ? "playoff-scoreboard--dense" : ""} ${showSeasonSnapshot ? "has-pad-flip" : ""} ${flipped ? "is-flipped" : ""}`}>
      <div className="pad-flip-inner">
      <div className="pad-face pad-front" aria-hidden={flipped} inert={flipped}>
      <div className="pickem-ledger-masthead">
        <div className="flex items-center gap-2">
          <h2>{isPlayoff ? "Playoff Ledger" : "Pick'em Pad"}</h2>
          {hasEliminatedRows && onToggleEliminatedRows ? <button
            aria-label={hideEliminatedRows ? "Show eliminated Pick'em players" : "Hide eliminated Pick'em players"}
            className="survivor-title-toggle survivor-elimination-toggle"
            onClick={onToggleEliminatedRows}
            title={hideEliminatedRows ? "Show eliminated players" : "Hide eliminated players"}
            type="button"
          >{hideEliminatedRows ? "+ OUT" : "− OUT"}</button> : null}
        </div>
        {isPlayoff ? <p className="pickem-ledger-period">{week.toUpperCase()}</p> : null}
        {flipButton}
      </div>
      <div className={`pickem-standings-table pickem-ledger-table ${isPlayoff ? "playoff-scoreboard-scroll" : ""}`}>
        <table className={`pickem-ledger-grid ${isPlayoff ? (isDensePlayoffRound ? "is-playoff-dense" : "is-playoff") : "is-regular"}`} data-picks={maxPicks}>
          {!isPlayoff ? <colgroup>
            <col className="pickem-ledger-wins-column" />
            <col className="pickem-ledger-player-column" />
            {Array.from({ length: maxPicks }, (_, index) => <col key={index} />)}
          </colgroup> : null}
          {!isPlayoff ? <thead>
            <tr className="pickem-ledger-week-row"><th colSpan={maxPicks + 2}><span>{week}</span></th></tr>
          </thead> : null}
          <tbody>
            {displayedRows.map((row) => {
              return (
                <tr className={`pickem-standings-row pickem-ledger-row ${row.playoffEliminated ? "is-eliminated" : ""}`} key={row.id}>
                  <td className="pickem-standings-wins pickem-ledger-wins">{row.wins}</td>
                  <td className="pickem-standings-name pickem-ledger-player"><span><PlayerTrophyName name={row.firstName} showTrophy={row.trophies?.some((title) => title.includes("Pick'em Champion"))} titles={row.trophies} /></span></td>
                  {row.playoffEliminated ? (
                    <td className="pickem-ledger-pick" colSpan={maxPicks}>
                      <span aria-label="Mathematically eliminated from the Pick'em playoff race" className="pickem-eliminated-stamp" title="Mathematically eliminated from the Pick'em playoff race">ELIMINATED</span>
                    </td>
                  ) : Array.from({ length: maxPicks }, (_, pickNumber) => {
                    const pick = row.picks[pickNumber];
                    return (
                      <td className={`pickem-ledger-pick ${isPlayoff ? "playoff-scoreboard-pick" : ""}`} key={pickNumber}>
                        {pick?.label ? (
                          <span>
                            {isPlayoff ? compactPickLabel(pick.label, pick.abbreviation) : <><span className="scoreboard-team-name-full">{pick.label}</span><span aria-label={pick.label} className="scoreboard-team-name-short">{compactPickLabel(pick.label, pick.abbreviation)}</span></>}
                            {pick.spread ? <strong className={`pickem-ledger-spread ${pick.isLineLocked ? "official-line-color" : "is-open"}`}>{pick.spread}</strong> : null}
                            <AtsResultStamp className="ml-1.5" result={pick.resultMark} />
                          </span>
                        ) : pick?.isHidden ? (
                          <span aria-label="Selection submitted and hidden until kickoff" title="Selection submitted — revealed at kickoff">🔒</span>
                        ) : null}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </div>
      {showSeasonSnapshot ? <div className="pad-face pad-back" aria-hidden={!flipped} inert={!flipped}><SeasonSnapshot active={flipped} flipButton={flipButton} isPlayoff={isPlayoff} refreshKey={snapshotRefreshKey} standings={rows.map((row) => ({ id: row.id, firstName: row.firstName, wins: row.wins, eliminated: row.playoffEliminated }))} /></div> : null}
      </div>
    </section>
  );
}
