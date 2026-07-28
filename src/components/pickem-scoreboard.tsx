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
  picks: PickemScoreboardPick[];
};

type Props = {
  rows: PickemScoreboardRow[];
  viewerPlayerId: string;
  maxPicks: number;
};

export default function PickemScoreboard({ rows, viewerPlayerId, maxPicks }: Props) {
  return (
    <section className="py-6 sm:py-7">
      <p className="mb-4 text-xs font-bold tracking-[0.2em] text-slate-600">
        PICK&apos;EM THIS WEEK
      </p>
      <div className="border-y-2 border-[#1d1d1f]">
        <table className="w-full table-fixed border-collapse text-left">
          <thead>
            <tr className="border-b-2 border-[#1d1d1f] text-xs tracking-[0.14em]">
              <th className="w-12 px-2 py-3 sm:w-20 sm:px-3">WINS</th>
              <th className="w-20 px-2 py-3 sm:w-40 sm:px-3"><span className="sr-only">Player</span></th>
              {Array.from({ length: maxPicks }, (_, index) => (
                <th className="px-2 py-3 sm:px-3" key={index}>PICK {index + 1}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isViewer = row.id === viewerPlayerId;
              return (
                <tr className={`border-b border-[#91afd0] last:border-b-0 ${isViewer ? "bg-[#fffaf0]" : ""}`} key={row.id}>
                  <td className="px-2 py-3 font-serif text-xl sm:px-3 sm:py-4 sm:text-2xl">{row.wins}</td>
                  <td className="px-2 py-3 sm:px-3 sm:py-4"><span className="font-serif text-base leading-tight sm:text-xl">{row.firstName}</span></td>
                  {Array.from({ length: maxPicks }, (_, pickNumber) => {
                    const pick = row.picks[pickNumber];
                    return (
                      <td className="break-words px-2 py-3 text-sm leading-tight sm:px-3 sm:py-4 sm:text-base" key={pickNumber}>
                        {pick?.label ? (
                          <span>
                            {pick.label}
                            {pick.spread ? <strong className={`ml-1 font-mono text-sm ${pick.isLineLocked ? "text-teal-700" : "text-slate-700"}`}>{pick.spread}</strong> : null}
                            {pick.resultMark ? <strong className={`ml-2 ${pick.resultMark === "W" ? "text-green-800" : "text-red-700"}`}>{pick.resultMark}</strong> : null}
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
