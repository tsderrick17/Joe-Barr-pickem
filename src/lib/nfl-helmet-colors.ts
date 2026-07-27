// Default home helmet shell colors for the current season. Review before each season.
export const NFL_HELMET_SHELL_COLORS: Record<string, string> = {
  ARI: "#ffffff", ATL: "#111111", BAL: "#111111", BUF: "#ffffff",
  CAR: "#bfc0bf", CHI: "#0b162a", CIN: "#fb4f14", CLE: "#ff3c00",
  DAL: "#b0b7bc", DEN: "#0a2343", DET: "#0076b6", GB: "#ffb612",
  HOU: "#03202f", IND: "#ffffff", JAX: "#111111", KC: "#e31837",
  LV: "#a5acaf", LAC: "#ffffff", LAR: "#003594", MIA: "#ffffff",
  MIN: "#4f2683", NE: "#c5c9cc", NO: "#d3bc8d", NYG: "#0b2265",
  NYJ: "#125740", PHI: "#004c54", PIT: "#111111", SEA: "#002244",
  SF: "#b3995d", TB: "#5b6062", TEN: "#0c2340", WAS: "#5a1414",
};

export function helmetShellColor(abbreviation: string, fallback = "#111111") {
  return NFL_HELMET_SHELL_COLORS[abbreviation] ?? fallback;
}
