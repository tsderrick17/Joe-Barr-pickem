// One table of scenarios, run through the application rules (test/season-phase.test.mjs) and through the
// database functions (test/integration/season-phase.test.mjs). `Y` is the season year (August Y to July Y+1);
// `{Y}` and `{Y1}` in an instant become Y and Y+1. Times are chosen so the Eastern offset is unambiguous:
// Eastern is UTC-4 from March to early November and UTC-5 otherwise.
//
// season: the periods of the row for the season year of that moment. The database derives the season state
// from them, exactly as it does in production. `nextSeason` is the following year's row (null: none yet).
export const SEASON_PHASE_SCENARIOS = [
  { name: "mid-season Sunday", at: "{Y}-10-18T17:00:00Z", season: { regular: "active", superBowl: "upcoming" }, bowlComplete: false, phase: "in_season", bowlOpen: false },
  { name: "Super Bowl week, playoffs active", at: "{Y1}-02-05T12:00:00Z", season: { regular: "complete", superBowl: "active" }, bowlComplete: true, phase: "in_season", bowlOpen: false },
  { name: "Super Bowl played but not yet graded", at: "{Y1}-02-09T03:00:00Z", season: { regular: "complete", superBowl: "active" }, bowlComplete: true, phase: "in_season", bowlOpen: false },
  { name: "Super Bowl graded", at: "{Y1}-02-09T04:30:00Z", season: { regular: "complete", superBowl: "complete" }, bowlComplete: true, phase: "off_season", bowlOpen: false },
  { name: "mid-March", at: "{Y1}-03-15T16:00:00Z", season: { regular: "complete", superBowl: "complete" }, bowlComplete: true, phase: "off_season", bowlOpen: false },
  { name: "July 31, 11:59:59 PM Eastern", at: "{Y1}-08-01T03:59:59Z", season: { regular: "complete", superBowl: "complete" }, bowlComplete: true, phase: "off_season", bowlOpen: false },
  { name: "August 1, 12:00:00 AM Eastern, before the new season exists", at: "{Y1}-08-01T04:00:00Z", nextSeason: null, bowlComplete: false, phase: "in_season", bowlOpen: false },
  { name: "August 1, after the rollover created the new season", at: "{Y1}-08-01T12:30:00Z", nextSeason: { regular: "upcoming", superBowl: "upcoming" }, bowlComplete: false, phase: "in_season", bowlOpen: false },
  { name: "November 30, 11:59:59 PM Eastern", at: "{Y}-12-01T04:59:59Z", season: { regular: "complete", superBowl: "upcoming" }, bowlComplete: false, phase: "in_season", bowlOpen: false },
  { name: "December 1, 12:00:00 AM Eastern", at: "{Y}-12-01T05:00:00Z", season: { regular: "complete", superBowl: "upcoming" }, bowlComplete: false, phase: "in_season", bowlOpen: true },
  { name: "early January, Bowl Pool still running", at: "{Y1}-01-05T17:00:00Z", season: { regular: "complete", superBowl: "upcoming" }, bowlComplete: false, phase: "in_season", bowlOpen: true },
  { name: "Bowl champion crowned", at: "{Y1}-01-12T17:00:00Z", season: { regular: "complete", superBowl: "upcoming" }, bowlComplete: true, phase: "in_season", bowlOpen: false },
];

export const atYear = (instant, year) => instant.replace("{Y}", String(year)).replace("{Y1}", String(year + 1));
