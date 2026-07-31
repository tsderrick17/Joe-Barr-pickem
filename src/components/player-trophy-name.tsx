type Props = { name: string; showTrophy?: boolean; titles?: string[] };

export default function PlayerTrophyName({ name, showTrophy = true, titles = [] }: Props) {
  if (!titles.length) return <>{name}</>;

  return (
    <span
      aria-label={titles.map((title) => `Trophy: ${title}`).join(". ")}
      className="inline-flex items-center gap-1"
      title={titles.map((title) => `🏆 ${title}`).join("\n")}
    >
      <span>{name}</span>
      {showTrophy ? <span aria-hidden="true" className="font-sans text-sm no-underline">🏆</span> : null}
    </span>
  );
}
