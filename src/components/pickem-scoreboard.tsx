export type PickemScoreboardPick = {
  label: string | null;
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
  picks: PickemScoreboardPick[];
};

type Props = {
  rows: PickemScoreboardRow[];
  viewerPlayerId: string;
  maxPicks: number;
};

export default function PickemScoreboard({ rows, viewerPlayerId, maxPicks }: Props) {
  return (
    <section className="py-4 sm:py-5">
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="text-xs font-bold tracking-[0.2em] text-slate-600">PICK&apos;EM THIS WEEK</p>
      </div>
      <div className="border-y-2 border-[#1d1d1f]">
        <table className="w-full table-fixed border-collapse text-left tabular-nums">
          <thead>
            <tr className="border-b-2 border-[#1d1d1f] bg-[#e9e0cd] text-[10px] font-black tracking-[0.16em] text-slate-700 sm:text-xs">
              <th className="w-11 px-2 py-2 text-center sm:w-16 sm:px-3">W</th>
              <th className="w-24 px-2 py-2 sm:w-36 sm:px-3"><span className="sr-only">Player</span></th>
              {Array.from({ length: maxPicks }, (_, index) => (
                <th className="px-2 py-2 sm:px-3" key={index}>PICK {index + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => {
              const isViewer = row.id === viewerPlayerId;
              return (
                <tr className={`border-b border-[#c8c1b5] last:border-b-0 ${row.playoffEliminated ? "bg-[#e7dfd1] text-slate-500" : isViewer ? "viewer-row bg-[#fffaf0]" : rowIndex % 2 ? "bg-[#f0eadc]" : ""}`} key={row.id}>
                  <td className="px-2 py-2 text-center font-serif text-lg font-bold sm:px-3 sm:py-2.5 sm:text-xl">{row.wins}{row.playoffEliminated ? <span className="mt-0.5 block -rotate-6 border border-red-700 px-0.5 py-px font-sans text-[8px] font-black tracking-[0.08em] text-red-800" title="Mathematically eliminated from the playoff race">OUT</span> : null}</td>
                  <td className="px-2 py-2 sm:px-3 sm:py-2.5"><span className="font-serif text-[15px] font-bold leading-tight sm:text-lg">{row.firstName}{isLastSeasonChampion("pickem", row.firstName) ? <span aria-label="Last season's Pick'em champion" className="ml-1 font-sans text-sm" title="Last season's Pick'em champion">🏆</span> : null}</span></td>
                  {row.playoffEliminated ? (
                    <td className="px-2 py-2 sm:px-3 sm:py-2.5" colSpan={maxPicks}>
                      <span aria-label="Mathematically eliminated from the Pick'em playoff race" className="pickem-eliminated-stamp" title="Mathematically eliminated from the Pick'em playoff race">ELIMINATED</span>
                    </td>
                  ) : Array.from({ length: maxPicks }, (_, pickNumber) => {
                    const pick = row.picks[pickNumber];
                    return (
                      <td className="break-words px-2 py-2 text-[13px] leading-tight sm:px-3 sm:py-2.5 sm:text-[15px]" key={pickNumber}>
                        {pick?.label ? (
                          <span>
                            {pick.label}
                            {pick.spread ? <strong className={`ml-1 font-mono text-[13px] ${pick.isLineLocked ? "text-teal-700" : "text-slate-700"}`}>{pick.spread}</strong> : null}
                            {pick.resultMark ? <strong className={`ml-1.5 text-[13px] ${pick.resultMark === "W" ? "text-green-800" : "text-red-700"}`}>{pick.resultMark}</strong> : null}
                          </span>
                        ) : pick?.isHidden ? (
                          <span aria-label="Pick submitted and hidden until kickoff" title="Pick submitted — revealed at kickoff">🔒</span>
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
import { isLastSeasonChampion } from "@/lib/last-season-champions";
