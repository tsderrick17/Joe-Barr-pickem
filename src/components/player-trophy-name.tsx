type Props = { name: string; titles?: string[] };

export default function PlayerTrophyName({ name, titles = [] }: Props) {
  if (!titles.length) return <>{name}</>;

  return (
    <span
      aria-label={titles.map((title) => `Trophy: ${title}`).join(". ")}
      className="inline-flex items-center gap-1"
      title={titles.map((title) => `🏆 ${title}`).join("\n")}
    >
      <span>{name}</span>
      <span
        className="font-sans text-sm no-underline"
        aria-hidden="true"
      >
        🏆
      </span>
    </span>
  );
}
