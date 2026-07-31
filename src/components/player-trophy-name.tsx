type Props = { name: string; titles?: string[] };

export default function PlayerTrophyName({ name, titles = [] }: Props) {
  if (!titles.length) return <>{name}</>;

  return (
    <span className="inline-flex items-center gap-1">
      <span>{name}</span>
      <span
        aria-label={titles.map((title) => `Trophy: ${title}`).join(". ")}
        className="font-sans text-sm no-underline"
        title={titles.map((title) => `🏆 ${title}`).join("\n")}
      >
        🏆
      </span>
    </span>
  );
}
