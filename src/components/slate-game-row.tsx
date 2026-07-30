export type SlateGameRowData = {
  id: string;
  kickoffAt: string;
  lineLockAt: string;
  isInternational: boolean;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  awayTeam: string;
  homeTeam: string;
  awayTeamId: string;
  homeTeamId: string;
  favoriteTeamId: string | null;
  officialSpread: number | null;
  preliminarySpread: number | null;
  awayScore: number | null;
  homeScore: number | null;
  awayResult: "win" | "loss" | null;
  homeResult: "win" | "loss" | null;
  awayPickers: string[];
  homePickers: string[];
};

function easternTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function easternShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric", day: "numeric" }).format(new Date(value));
}

function easternLockLabel(value: string) {
  const date = easternShortDate(value);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return `${date} · ${time.replace(":00", "")}`;
}

function spreadLabel(spread: number | null) {
  if (spread === null) return null;
  if (spread === 0) return "PK";
  return `-${Number.isInteger(spread) ? spread : spread.toFixed(1)}`;
}

function ResultMark({ result }: { result: "win" | "loss" | null }) {
  if (!result) return null;
  return <strong className={`relative -top-0.5 inline-block shrink-0 -rotate-[7deg] ${result === "win" ? "text-green-700" : "text-red-700"}`}>{result === "win" ? "W" : "L"}</strong>;
}

type Props = {
  game: SlateGameRowData;
  alternate: boolean;
  hasStarted: boolean;
  selectedTeamId?: string | null;
  allowSelection?: boolean;
  onChoose?: (gameId: string, teamId: string) => void;
};

export default function SlateGameRow({ game, alternate, hasStarted, selectedTeamId, allowSelection = false, onChoose }: Props) {
  const favoriteIsHome = game.favoriteTeamId === game.homeTeamId;
  const left = favoriteIsHome
    ? { name: game.homeTeam, id: game.homeTeamId, result: game.homeResult, score: game.homeScore, pickers: game.homePickers, home: true }
    : { name: game.awayTeam, id: game.awayTeamId, result: game.awayResult, score: game.awayScore, pickers: game.awayPickers, home: false };
  const right = favoriteIsHome
    ? { name: game.awayTeam, id: game.awayTeamId, result: game.awayResult, score: game.awayScore, pickers: game.awayPickers, home: false }
    : { name: game.homeTeam, id: game.homeTeamId, result: game.homeResult, score: game.homeScore, pickers: game.homePickers, home: true };
  const isFinal = game.status === "final";
  // Kickoff, not a delayed provider status, is the fair public-receipt line.
  // The card becomes live at that moment and remains a fixed audit record after final.
  const isLive = hasStarted && !isFinal && game.status !== "postponed" && game.status !== "cancelled";
  const lockedSpread = game.officialSpread !== null;
  const showSpecialLockNote = game.isInternational && !lockedSpread;
  const hasPublishedPick = left.pickers.length > 0 || right.pickers.length > 0;
  const compactFinal = isFinal && !hasPublishedPick;

  const teamCell = (team: typeof left, align: "left" | "right") => {
    const selected = selectedTeamId === team.id;
    const label = team.home ? team.name.toUpperCase() : team.name;
    const className = `${align === "right" ? "text-right" : "text-left"} min-w-0 text-[12px] font-bold leading-[1.15] tracking-tight min-[380px]:text-[13px] sm:text-[15px] ${allowSelection ? "block w-full" : "block"} ${selected ? "slate-team-selection bg-[#1d1d1f] px-1 py-1.5 text-white sm:px-3 sm:py-2" : allowSelection ? "hover:underline" : ""}`;
    const content = <>
      <span className="block min-w-0 break-normal [hyphens:none]">{label}<ResultMark result={isFinal ? team.result : null} />{isFinal && team.score !== null ? <span className="ml-1 font-mono font-black tabular-nums">{team.score}</span> : null}</span>
      {hasStarted && team.pickers.length ? <span className={`mt-0.5 block text-[10px] font-semibold leading-3 ${selected ? "text-slate-200" : "text-slate-600"}`}>{team.pickers.join(", ")}</span> : null}
    </>;
    return allowSelection ? <button className={className} disabled={hasStarted} onClick={() => onChoose?.(game.id, team.id)} type="button">{content}</button> : <div className={className}>{content}</div>;
  };

  return <article className={`grid grid-cols-[2.75rem_minmax(0,1fr)_4.25rem_minmax(0,1fr)] items-center gap-1 border-b border-[#c8c1b5] ${compactFinal ? "py-1" : "py-2"} pl-1 pr-2 min-[380px]:grid-cols-[3.1rem_minmax(0,1fr)_5rem_minmax(0,1fr)] min-[380px]:gap-1.5 sm:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)] sm:gap-3 sm:pl-2 sm:pr-4 ${alternate ? "bg-[#eee4d1]" : "bg-[#fffdf8]"}`}>
    <div className="text-center text-[10px] font-bold leading-3 text-slate-600 sm:text-xs">
      {isFinal ? <p className="font-mono font-bold text-slate-700">{easternShortDate(game.kickoffAt)}</p> : <><p>{easternTime(game.kickoffAt).replace(" EDT", "").replace(" EST", "")}</p><p className="mt-1 text-[8px] font-black tracking-[0.1em] text-slate-500">ET</p></>}
    </div>
    {teamCell(left, "left")}
    <div className="text-center text-[10px] font-bold leading-4 text-slate-700 sm:text-xs">
      {lockedSpread ? <span className="font-mono text-sm font-bold text-teal-700 sm:text-base">{spreadLabel(game.officialSpread)}</span> : game.preliminarySpread !== null ? <span className="font-mono text-sm font-bold text-zinc-900 sm:text-base">{spreadLabel(game.preliminarySpread)}</span> : <p className="text-[8px] font-black tracking-[0.08em] text-slate-500 sm:text-[9px]">AWAITING LINE</p>}
      {isLive ? <p className="mx-auto mt-1 w-fit border border-red-800 bg-red-50 px-1.5 py-px text-[8px] font-black tracking-[0.12em] text-red-800">LIVE</p> : null}
      {showSpecialLockNote ? <p className="mt-1 whitespace-nowrap text-[7px] font-black leading-3 tracking-[-0.02em] text-teal-700">LOCKS {easternLockLabel(game.lineLockAt).toUpperCase()} ET</p> : null}
    </div>
    {teamCell(right, "right")}
  </article>;
}
