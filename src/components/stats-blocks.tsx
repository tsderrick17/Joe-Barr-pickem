
/**
 * The pieces the league's stats and each player's stats (both on the Pool stats page) are built from, so the two always read alike.
 * The numbers come from `buildGroupStats` in src/lib/group-stats.js.
 */
export type Bucket = { wins: number; losses: number; picks: number; hitRate: number | null };
export type Split = Bucket & { share: number | null };
export type Weeks = { total: number; donut: number; split: number; sweep: number };
export type RecordSummary = Bucket & { pushes: number; pushedGames: number; pushShare: number | null };
export type TeamPicked = Bucket & { teamId: string; name: string; abbreviation: string; share: number | null };
export type Splits = { side: { favorite: Split; underdog: Split; pickem: Split }; venue: { home: Split; away: Split } };

export const percent = (value: number | null) => (value === null ? "—" : `${Math.round(value * 100)}%`);

export type TeamSort = "picked" | "rate";
