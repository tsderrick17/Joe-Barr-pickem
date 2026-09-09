import { assessBowlPoolIntegrity as assess } from "./bowl-pool-integrity.js";

export type BowlIntegrityGame = {
  id: string;
  kickoff_at: string;
  order_index: number;
  status: string;
  away_team_id: string | null;
  home_team_id: string | null;
};

export type BowlIntegrityLine = { game_id: string };

/** Pure integrity checks shared by the readiness page and automation tests. */
export const assessBowlPoolIntegrity: (games: BowlIntegrityGame[], lines: BowlIntegrityLine[], now?: Date) => { healthy: boolean; problems: string[]; missingLines: number; gameCount: number } = assess;
