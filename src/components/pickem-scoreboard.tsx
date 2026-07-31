import PlayerTrophyName from "@/components/player-trophy-name";

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
};

export default function PickemScoreboard({ isPlayoff = false, rows, viewerPlayerId, maxPicks }: Props) {
  return (
    <section className={`pickem-ledger py-4 sm:py-5 ${isPlayoff ? "playoff-scoreboard" : ""}`}>
      <div className="pickem-ledger-masthead">
        <div>
          <p className="pickem-ledger-kicker">LEAD PIPE LOCKS</p>
          <h2>{isPlayoff ? "Playoff Ledger" : "Pick'em Scoreboard"}</h2>
        </div>
        <p className="pickem-ledger-period">{isPlayoff ? "ROUND CARD" : "THIS WEEK"}</p>
      </div>
      <div className={`pickem-standings-table pickem-ledger-table ${isPlayoff ? "playoff-scoreboard-scroll" : ""}`}>
        <table className={`${isPlayoff ? "min-w-[48rem]" : "w-full table-fixed"} border-collapse text-left tabular-nums`}>
          <tbody>
            {rows.map((row) => {
              const isViewer = row.id === viewerPlayerId;
              return (
                <tr className={`pickem-standings-row pickem-ledger-row ${row.playoffEliminated ? "is-eliminated" : isViewer ? "viewer-row" : ""}`} key={row.id}>
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
                            {isPlayoff ? pick.abbreviation ?? pick.label : <><span className="scoreboard-team-name-full">{pick.label}</span>{pick.abbreviation ? <span aria-label={pick.label} className="scoreboard-team-name-short">{pick.abbreviation}</span> : null}</>}
                            {pick.spread ? <strong className={`ml-1 font-mono text-[13px] ${pick.isLineLocked ? "text-teal-700" : "text-slate-700"}`}>{pick.spread}</strong> : null}
                            {pick.resultMark ? <strong className={`ml-1.5 text-[13px] ${pick.resultMark === "W" ? "text-green-800" : "text-red-700"}`}>{pick.resultMark}</strong> : null}
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
