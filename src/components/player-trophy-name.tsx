type Props = { name: string; titles?: string[] };

export default function PlayerTrophyName({ name, titles = [] }: Props) {
  if (!titles.length) return <>{name}</>;

  return (
    <span className="player-trophy-name group relative inline-flex items-center gap-1" tabIndex={0}>
      <span>{name}</span><span aria-label={`${titles.length} championship ${titles.length === 1 ? "title" : "titles"}`} className="font-sans text-sm no-underline">🏆</span>
      <span className="player-trophy-card pointer-events-none absolute bottom-full left-0 z-30 mb-2 w-max max-w-56 translate-y-1 border border-[#827767] bg-[#fffdf8] px-3 py-2 text-left opacity-0 shadow-lg transition delay-300 duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-hover:delay-300 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-focus-within:delay-0">
        <span className="mb-1 block text-[9px] font-black tracking-[.14em] text-slate-600">PAST TROPHIES</span>
        {titles.map((title) => <span className="block whitespace-normal text-xs font-bold leading-5 text-[#24201a]" key={title}>🏆 {title}</span>)}
      </span>
    </span>
  );
}
