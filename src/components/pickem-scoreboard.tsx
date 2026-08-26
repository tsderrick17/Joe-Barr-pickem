import PlayerTrophyName from "@/components/player-trophy-name";
import AtsResultStamp from "@/components/ats-result-stamp";
import { scorepadAbbreviation } from "@/lib/scorepad-abbreviations";

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

type Props = {
  isPlayoff?: boolean;
  rows: PickemScoreboardRow[];
  viewerPlayerId: string;
  maxPicks: number;
  week: string;
  hideEliminatedRows?: boolean;
  onToggleEliminatedRows?: () => void;
};

export default function PickemScoreboard({
  isPlayoff = false,
  rows,
  maxPicks,
  week,
  hideEliminatedRows = false,
  onToggleEliminatedRows,
}: Props) {
  const hasEliminatedRows = rows.some((row) => row.playoffEliminated);
  const displayedRows = hideEliminatedRows ? rows.filter((row) => !row.playoffEliminated) : rows;

  return (
    <section className={`pickem-ledger pickem-scoreboard-ledger py-4 sm:py-5 ${isPlayoff ? "playoff-scoreboard" : ""}`}>
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
      </div>
      <div className={`pickem-standings-table pickem-ledger-table ${isPlayoff ? "playoff-scoreboard-scroll" : ""}`}>
        <table className={`${isPlayoff ? "min-w-[48rem]" : "w-full table-fixed"} border-collapse text-left tabular-nums`}>
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
                  <td className="pickem-standings-wins pickem-ledger-wins">{row.wins}{row.playoffEliminated ? <span className="mt-0.5 block -rotate-6 border border-red-700 px-0.5 py-px font-sans text-[8px] font-black tracking-[0.08em] text-red-800" title="Mathematically eliminated from the playoff race">OUT</span> : null}</td>
                  <td className="pickem-standings-name pickem-ledger-player"><span><PlayerTrophyName name={row.firstName} showTrophy={row.trophies?.some((title) => title.includes("Pick'em Champion"))} titles={row.trophies} /></span></td>
                  {row.playoffEliminated ? (
                    <td className="pickem-ledger-pick" colSpan={maxPicks}>
                      <span aria-label="Mathematically eliminated from the Pick'em playoff race" className="pickem-eliminated-stamp" title="Mathematically eliminated from the Pick'em playoff race">ELIMINATED</span>
                    </td>
                  ) : Array.from({ length: maxPicks }, (_, pickNumber) => {
                    const pick = row.picks[pickNumber];
                    return (
                      <td className={`pickem-ledger-pick break-words ${isPlayoff ? "playoff-scoreboard-pick" : ""}`} key={pickNumber}>
                        {pick?.label ? (
                          <span>
                            {isPlayoff ? (pick.abbreviation ? scorepadAbbreviation(pick.abbreviation) : pick.label) : <><span className="scoreboard-team-name-full">{pick.label}</span>{pick.abbreviation ? <span aria-label={pick.label} className="scoreboard-team-name-short">{scorepadAbbreviation(pick.abbreviation)}</span> : null}</>}
                            {pick.spread ? <strong className={`ml-1 font-mono text-[13px] ${pick.isLineLocked ? "official-line-color" : "text-slate-700"}`}>{pick.spread}</strong> : null}
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
    </section>
  );
}
