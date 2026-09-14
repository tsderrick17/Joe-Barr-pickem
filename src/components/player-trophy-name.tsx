type Props = { name: string; showTrophy?: boolean; titles?: string[]; nameClassName?: string };

export default function PlayerTrophyName({ name, showTrophy = true, titles = [], nameClassName }: Props) {
  if (!titles.length) return <span className={nameClassName}>{name}</span>;

  return (
    <span
      aria-label={titles.map((title) => `Trophy: ${title}`).join(". ")}
      className="inline-flex items-center gap-1"
      title={titles.map((title) => `🏆 ${title}`).join("\n")}
    >
      <span className={nameClassName}>{name}</span>
      {showTrophy ? <span aria-hidden="true" className="font-sans text-sm no-underline">🏆</span> : null}
    </span>
  );
}
