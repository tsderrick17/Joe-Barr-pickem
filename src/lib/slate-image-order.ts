export type SlateImageGame = {
  away: string;
  home: string;
  favorite: "away" | "home" | null;
  spread: number | null;
};

export function slateImagePresentation(game: SlateImageGame) {
  const isPickEm = game.spread === 0;
  const leftSide = isPickEm ? "home" : game.favorite ?? "away";

  return {
    leftTeam: leftSide === "home" ? game.home : game.away,
    line: game.spread === null || (!game.favorite && !isPickEm)
      ? "LINE PENDING"
      : isPickEm
        ? "PK"
        : `-${game.spread}`,
    rightTeam: leftSide === "home" ? game.away : game.home,
  };
}
