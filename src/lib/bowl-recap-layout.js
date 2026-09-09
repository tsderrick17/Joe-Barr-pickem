export function bowlRecapLayout(gameCount) {
  const count = Math.max(0, Number(gameCount) || 0);
  return count <= 4 ? { columns: 1, gamesPerColumn: count, width: 1200, height: 900 } : { columns: 2, gamesPerColumn: Math.ceil(count / 2), width: 1200, height: 1100 };
}
