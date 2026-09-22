import type { EmailArtworkSnapshot } from "./email-artwork";
import type { WeeklyRecapSnapshot } from "./weekly-recap";

/** Explicitly fictional data for reviewing future templates before results exist. */
export function emailArtworkSample(category: string, pickemOnly = false): EmailArtworkSnapshot | null {
  const names = ["Alex", "Jordan", "Casey", "Morgan", "Sam", "Taylor", "Jamie", "Drew", "Robin", "Avery", "Cameron"];
  const weekly: WeeklyRecapSnapshot = {
    kind: "weekly_recap", week: "Sample week", weekNumber: 2, generatedAt: "2026-09-22T12:00:00Z", games: [],
    standings: names.map((name, i) => ({ name, wins: 12 - Math.floor(i / 2) })),
    weeklySummary: names.map((name, i) => ({ name, wins: i % 3, picks: [i % 3 === 0 ? "BUF L" : "BUF W", i % 3 === 2 ? "SEA W" : "SEA L"] })),
    survivor: { in: pickemOnly ? 0 : 3, out: 8, latest: null, championName: null, championCrownedInRecapWeek: false, visibleWeeks: 10, rows: names.slice(0, 4).map((name, i) => ({ name, status: i === 3 ? "OUT" : "IN", eliminatedAt: null, eliminatedInRecapWeek: i === 3, picks: ["BUF W", i === 3 ? "SEA L" : "SEA W", ...Array(8).fill(null)] })) },
  };
  if (category === "weekly_recap") return weekly;
  if (category === "playoff_day_recap") return { ...weekly, kind: "playoff_day_recap", day: "Sample playoff day", eliminatedToday: [], championsCrowned: [] };
  const rows = weekly.standings.map((item) => ({ ...item, picks: ["BUF -3.5", "SEA +2.5"] }));
  if (category === "sunday_early_reveal" || category === "sunday_late_reveal") return { kind: "sunday_reveal", window: category === "sunday_early_reveal" ? "early" : "late", week: "Sample week", generatedAt: weekly.generatedAt, rows };
  if (category === "featured_window_reveal") return { kind: "featured_window_reveal", window: "Featured game", week: "Sample week", generatedAt: weekly.generatedAt, rows };
  if (category === "playoff_public_reveal") return { kind: "playoff_public_reveal", window: "Sample kickoff", round: "Wild Card", generatedAt: weekly.generatedAt, rows };
  const games = [{ away: "Miami Dolphins", home: "BUFFALO BILLS", favorite: "home" as const, spread: 3.5, time: "1:00 PM ET" }, { away: "Seattle Seahawks", home: "LOS ANGELES RAMS", favorite: "home" as const, spread: 2.5, time: "4:25 PM ET" }];
  if (category === "weekly") return { kind: "fresh_slate", week: "Sample week", generatedAt: weekly.generatedAt, games: games.map((game) => ({ ...game, day: "Sunday" })) };
  if (category === "early_lock") return { kind: "early_lock", day: "Sample Sunday", generatedAt: weekly.generatedAt, games: games.slice(0, 1) };
  if (category === "final_lines" || category === "sunday_final_lines") return { kind: "game_day", day: "Sample Sunday", generatedAt: weekly.generatedAt, games };
  const bowls = [{ name: "Sample Bowl", favorite: "Oregon", underdog: "Michigan", line: "-3.5" }];
  if (category === "bowl_line_lock") return { kind: "bowl_line_lock", day: "Sample gameday", games: bowls };
  if (category === "bowl_daily_recap") return { kind: "bowl_daily_recap", day: "Sample gameday", games: bowls.map((game) => ({ ...game, favoriteScore: 31, underdogScore: 24, status: "final" })), rows: weekly.standings.map((item) => ({ ...item, results: ["W"] })), eliminatedToday: [], remaining: 11, championsCrowned: [], copy: "" };
  return null;
}
