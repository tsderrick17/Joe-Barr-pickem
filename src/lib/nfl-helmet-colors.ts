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

// These accents power the Survivor poker chips. Keep the logo itself official
// and untouched; the colors only form the chip's outer edge.
export const NFL_TEAM_CHIP_ACCENTS: Record<string, { primary: string; secondary: string }> = {
  ARI: { primary: "#97233f", secondary: "#ffffff" }, ATL: { primary: "#a71930", secondary: "#111111" }, BAL: { primary: "#241773", secondary: "#9e7c0c" }, BUF: { primary: "#00338d", secondary: "#c60c30" },
  CAR: { primary: "#0085ca", secondary: "#101820" }, CHI: { primary: "#0b162a", secondary: "#c83803" }, CIN: { primary: "#fb4f14", secondary: "#111111" }, CLE: { primary: "#ff3c00", secondary: "#311d00" },
  DAL: { primary: "#003594", secondary: "#b0b7bc" }, DEN: { primary: "#fb4f14", secondary: "#0a2343" }, DET: { primary: "#0076b6", secondary: "#b0b7bc" }, GB: { primary: "#203731", secondary: "#ffb612" },
  HOU: { primary: "#03202f", secondary: "#a71930" }, IND: { primary: "#002c5f", secondary: "#ffffff" }, JAX: { primary: "#006778", secondary: "#d7a22a" }, KC: { primary: "#e31837", secondary: "#ffb81c" },
  LV: { primary: "#000000", secondary: "#a5acaf" }, LAC: { primary: "#0080c6", secondary: "#ffc20e" }, LAR: { primary: "#003594", secondary: "#ffd100" }, MIA: { primary: "#008e97", secondary: "#f58220" },
  MIN: { primary: "#4f2683", secondary: "#ffc62f" }, NE: { primary: "#002244", secondary: "#c60c30" }, NO: { primary: "#d3bc8d", secondary: "#101820" }, NYG: { primary: "#0b2265", secondary: "#a71930" },
  NYJ: { primary: "#125740", secondary: "#ffffff" }, PHI: { primary: "#004c54", secondary: "#a5acaf" }, PIT: { primary: "#101820", secondary: "#ffb612" }, SEA: { primary: "#002244", secondary: "#69be28" },
  SF: { primary: "#aa0000", secondary: "#b3995d" }, TB: { primary: "#a6192e", secondary: "#ff7900" }, TEN: { primary: "#0c2340", secondary: "#4b92db" }, WAS: { primary: "#5a1414", secondary: "#ffb612" },
};

export function teamChipAccents(abbreviation: string) {
  return NFL_TEAM_CHIP_ACCENTS[abbreviation] ?? { primary: helmetShellColor(abbreviation), secondary: "#f5f0e6" };
}
