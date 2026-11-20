import { bowlPennant } from "./bowl-logos.js";
/**
 * The real clubhouse's room, fed by the pool's own data: the same two reads the classic pages make (the Standings' /api/home and the
 * Slate's /api/board), shaped into what the room shows by itself. Nothing here can show more than those pages do: the standings are
 * wins only, and the only picks lit are the viewer's own (another player's unstarted pick never reaches either read).
 */

const ET = "America/New_York";

/** "Sun 1:00 PM", Eastern. */
export function kickoffLabel(iso) {
  if (!iso) return "TBA";
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: ET, weekday: "short" }).format(date);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: ET, hour: "numeric", minute: "2-digit" }).format(date);
  return `${day} ${time}`;
}

/** A team's line as its pick reads it: "-3.5" for the favorite, "+3.5" for the other side, "PK" for none, "—" before there is a line. */
export function lineFor(game, teamId) {
  const spread = game.officialSpread ?? game.preliminarySpread;
  if (spread === null || spread === undefined) return "—";
  const size = Math.abs(Number(spread));
  if (size === 0 || !game.favoriteTeamId) return "PK";
  return `${teamId === game.favoriteTeamId ? "-" : "+"}${size}`;
}

/** A line as a number: "-3.5" is -3.5, "+3" is 3, "PK" is 0, no line yet is null. */
const spreadOf = (line) => (line === "PK" ? 0 : /^[+-]?\d/.test(line) ? Number(line) : null);

/** How far a team finished past its spread: its margin of victory plus its line. Positive covered it, zero is a push (a loss), negative missed it. */
export function coverMargin(score, other, line) {
  const spread = spreadOf(line);
  return score === null || other === null || spread === null ? null : score - other + spread;
}

/** Standings by wins, most first: each with a place (level players share it) and whether it is shared. */
export function placedStandings(rows) {
  const sorted = [...rows].sort((a, b) => b.wins - a.wins || a.firstName.localeCompare(b.firstName));
  return sorted.map((row) => {
    const above = sorted.filter((other) => other.wins > row.wins).length;
    const level = sorted.filter((other) => other.wins === row.wins).length;
    return { id: row.id, name: row.firstName, wins: row.wins, place: above + 1, tied: level > 1 };
  });
}

/**
 * Whether Survivor still has a place on the screens: while it runs, and for the week after it is decided (8 days from the crowning,
 * so the winner is called out), never in the playoffs. After that it leaves the Big Board and the clubhouse's poker table.
 */
export function survivorStillShown(home, now) {
  if (!home.survivorAvailable || home.isPlayoff) return false;
  if (!home.survivorComplete) return true;
  const crowned = Date.parse(home.survivorCrownedAt ?? "");
  return Number.isNaN(crowned) || now - crowned < 8 * 86_400_000;
}

const easternDay = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
const BOWL_TICKER_DAYS = 3;

/**
 * The bowls for the room's ticker, from the Bowl Pool's own read: each bowl from three days back to three days ahead (finals with their
 * score and who covered, the rest with their line), by the schools' short names, the bowl's short name over it, and the viewer's own
 * pick lit. A postponed or cancelled bowl, or one with no teams yet, is left off.
 * @param {any} payload  the Bowl Pool's read (/api/bowl-pool)
 * @param {number} now
 */
export function bowlTickerGames(payload, now) {
  const own = new Map((payload?.ownPicks ?? []).map((pick) => [pick.game_id, pick.selected_team_id]));
  const reach = BOWL_TICKER_DAYS * 86_400_000;
  return (payload?.games ?? []).flatMap((game) => {
    const at = Date.parse(game.kickoff_at ?? "");
    // The school's own abbreviation (ESPN's), or the first letters of its short name when it has none.
    const short = (team) => team?.abbreviation || String(team?.short_name ?? team?.display_name ?? "").replace(/[^A-Za-z&]/g, "").slice(0, 4).toUpperCase() || null;
    const away = short(game.awayTeam), home = short(game.homeTeam);
    if (!Number.isFinite(at) || Math.abs(at - now) > reach || !away || !home || ["postponed", "cancelled", "no_contest"].includes(game.status)) return [];
    const awayId = game.away_team_id ?? game.awayTeam?.id, homeId = game.home_team_id ?? game.homeTeam?.id;
    const raw = game.line?.locked_spread;
    const spread = raw === null || raw === undefined || raw === "" ? null : Math.abs(Number(raw));
    const favorite = game.line?.favorite_team_id ?? null;
    const lineOf = (teamId) => (spread === null || !Number.isFinite(spread) || !favorite ? "—" : spread === 0 ? "PK" : `${teamId === favorite ? "-" : "+"}${spread}`);
    const final = game.status === "final" && Number.isInteger(game.away_score) && Number.isInteger(game.home_score);
    const covered = (teamId, score, other) => (spread === null || !favorite ? score > other : teamId === favorite ? score - other > spread : score + spread > other);
    const pick = own.get(game.id);
    return [{
      id: `bowl-${game.id}`,
      kickoff: kickoffLabel(game.kickoff_at),
      at,
      away,
      home,
      awayLine: lineOf(awayId),
      homeLine: lineOf(homeId),
      bowl: bowlPennant(game.bowl_name).flag,
      picked: pick ? (pick === awayId ? "away" : pick === homeId ? "home" : null) : null,
      ...(final ? { final: { away: { score: game.away_score, covered: covered(awayId, game.away_score, game.home_score) }, home: { score: game.home_score, covered: covered(homeId, game.home_score, game.away_score) } } } : {}),
    }];
  });
}

/**
 * The ticker's order once the bowls are on: today's NFL games first, then today's bowls, then the rest sprinkled through each other (two
 * NFL games, then a bowl), each in kickoff order.
 * @template {{ at?: number }} G
 * @param {G[]} nfl
 * @param {G[]} bowls
 * @param {number} now
 */
export function mergeTicker(nfl, bowls, now) {
  const today = easternDay(now);
  const isToday = (game) => Number.isFinite(game.at) && easternDay(game.at) === today;
  const byKickoff = (a, b) => (a.at ?? 0) - (b.at ?? 0);
  const restNfl = nfl.filter((game) => !isToday(game));
  const restBowls = bowls.filter((game) => !isToday(game)).sort(byKickoff);
  const sprinkled = [];
  for (let index = 0, bowl = 0; index < restNfl.length || bowl < restBowls.length; index++) {
    if (index < restNfl.length) sprinkled.push(restNfl[index]);
    if ((index % 2 === 1 || index >= restNfl.length) && bowl < restBowls.length) sprinkled.push(restBowls[bowl++]);
  }
  return [...nfl.filter(isToday), ...bowls.filter(isToday).sort(byKickoff), ...sprinkled];
}

/** Bowl Pool time: from Dec 7 (Eastern) through January, the Bowl Pool's board is wheeled into the room. */
export function bowlSeason(iso) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ET, month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return (month === 12 && day >= 7) || month === 1;
}

/**
 * Each player's move since the last week: how many places they have climbed (positive) or slipped (negative), against the standings as
 * they stood after `before` (every player's wins added up through that week). Nobody moves when there is nothing to compare with.
 * @param {Array<{ id: string, name: string, wins: number, place: number, tied: boolean }>} standings
 * @param {Array<{ id: string, firstName: string }>} rows
 * @param {Record<string, number> | null | undefined} before
 */
export function withMovement(standings, rows, before) {
  if (!before) return standings;
  const then = new Map(placedStandings(rows.map((row) => ({ ...row, wins: before[row.id] ?? 0 }))).map((row) => [row.id, row.place]));
  return standings.map((row) => ({ ...row, move: then.has(row.id) ? then.get(row.id) - row.place : 0 }));
}

/**
 * The Big Board plate's line: what matters to this player right now about the standings. Leading: by how much (or that it is shared).
 * Otherwise: who leads, and where you are and how far back; with the places you have moved since last week when you have.
 */
export function boardNews(standings, viewerId) {
  if (!standings.length) return null;
  const you = standings.find((row) => row.id === viewerId);
  const leaders = standings.filter((row) => row.place === 1);
  const moved = you?.move ? ` · ${you.move > 0 ? "▲" : "▼"}${Math.abs(you.move)}` : "";
  if (you && you.place === 1) {
    if (leaders.length > 1) return `You share the lead${moved}`;
    const next = standings.find((row) => row.place > 1);
    return `You lead by ${next ? you.wins - next.wins : you.wins}${moved}`;
  }
  const lead = leaders.length === 1 ? `${leaders[0].name} leads` : `${leaders.length} lead`;
  return you ? `${lead} · You: ${you.tied ? "T" : ""}${you.place}, ${leaders[0].wins - you.wins} back${moved}` : lead;
}

/**
 * The room's feed, and the viewer's ticket (one lamp a Pick'em pick, then Survivor's while they are still in it). `before` is every
 * player's wins through an earlier week, for the standings' week-over-week arrows (see withMovement).
 * @param {{ home: import("./api-contracts").StandingsResponse, board: import("./api-contracts").SlateResponse, before?: Record<string, number> | null }} reads
 */
export function clubhouseFeed({ home, board, before = null }) {
  const standings = withMovement(placedStandings(home.rows ?? []), home.rows ?? [], before);
  const games = board.games ?? [];
  const gameById = new Map(games.map((game) => [game.id, game]));
  const abbreviation = (game, teamId) => (teamId === game.awayTeamId ? game.awayTeamAbbreviation : game.homeTeamAbbreviation);
  const resultOf = (game, teamId) => (teamId === game.awayTeamId ? game.awayResult : game.homeResult);

  const mine = (board.myPicks ?? []).map((pick) => gameById.get(pick.gameId)).filter(Boolean);
  const myPicks = (board.myPicks ?? []).filter((pick) => gameById.has(pick.gameId));
  const maxPicks = Math.max(home.maxPicks ?? 0, myPicks.length);
  const survivor = board.survivor;
  const inSurvivor = Boolean(survivor?.available && survivor.status === "active");
  const survivorOwed = inSurvivor && !survivor.pick;
  const atsOwed = Math.max(0, maxPicks - myPicks.length);
  const weekOpen = home.weekStatus !== "complete" && games.some((game) => game.status === "scheduled" || game.status === "live");
  const owedCount = weekOpen ? atsOwed + (survivorOwed ? 1 : 0) : 0;
  // Whether any pick that is in can still be changed: its game has not kicked off.
  const now = Date.parse(board.serverTime ?? home.serverTime ?? new Date().toISOString());
  const notStarted = (gameId) => { const game = gameById.get(gameId); return Boolean(game) && game.status === "scheduled" && Date.parse(game.kickoffAt) > now; };
  const anyChangeable = myPicks.some((pick) => notStarted(pick.gameId)) || Boolean(inSurvivor && survivor.pick && notStarted(survivor.pick.game_id));

  const lamps = [
    ...myPicks.map((pick) => {
      const result = resultOf(gameById.get(pick.gameId), pick.teamId);
      return result === "win" ? "won" : result === "loss" ? "lost" : "in";
    }),
    ...Array.from({ length: atsOwed }, () => "off"),
    ...(inSurvivor ? [survivor.pick ? "in" : "off"] : []),
  ];
  const total = maxPicks + (inSurvivor ? 1 : 0);
  const picked = total - (atsOwed + (survivorOwed ? 1 : 0));

  // Survivor leaves the room when it leaves the classic pages: once it is decided, and for the playoffs.
  const survivorOver = Boolean(home.isPlayoff || home.survivorComplete);
  const survivorRows = home.survivorAvailable && !survivorOver ? home.survivorRows ?? [] : [];
  const stillIn = survivorRows.filter((row) => row.status !== "eliminated").length;
  const meInSurvivor = survivorRows.find((row) => row.playerId === home.viewerPlayerId);

  return {
    feed: {
      week: home.week ?? "",
      standings,
      games: games.map((game) => {
        const awayLine = lineFor(game, game.awayTeamId);
        const homeLine = lineFor(game, game.homeTeamId);
        // Only a final game has a score to show (never a live one), and with it which side covered its line (a push is a miss).
        const decided = game.status === "final" && game.awayScore !== null && game.awayScore !== undefined && game.homeScore !== null && game.homeScore !== undefined;
        const side = (score, other, line, result) => ({ score, covered: result ? result === "win" : (coverMargin(score, other, line) ?? 0) > 0 });
        return {
          id: game.id,
          kickoff: kickoffLabel(game.kickoffAt),
          at: Date.parse(game.kickoffAt ?? ""),
          away: game.awayTeamAbbreviation,
          home: game.homeTeamAbbreviation,
          awayLine,
          homeLine,
          ...(decided ? { final: { away: side(game.awayScore, game.homeScore, awayLine, game.awayResult), home: side(game.homeScore, game.awayScore, homeLine, game.homeResult) } } : {}),
        };
      }),
      mine: mine.map((game, index) => abbreviation(game, myPicks[index].teamId)),
      news: {
        ...(standings.length ? { board: boardNews(standings, home.viewerPlayerId) } : {}),
        ...(games.length ? { picks: owedCount ? `${owedCount} owed` : "All in" } : {}),
        ...(survivorRows.length ? { survivor: `${stillIn} of ${survivorRows.length} still in${meInSurvivor ? ` · ${meInSurvivor.status === "eliminated" ? "You’re out" : "You’re in"}` : ""}` } : {}),
      },
      owed: owedCount > 0,
      mail: false,
      bowl: bowlSeason(home.serverTime ?? board.serverTime ?? new Date().toISOString()),
      survivorOver,
      survivorShown: survivorStillShown(home, now),
      // Survivor is being played (not decided, not the playoffs): the poker table is Survivor's while it is.
      survivorActive: Boolean(home.survivorAvailable) && !survivorOver,
    },
    ticket: games.length && total ? {
      lamps,
      survivor: inSurvivor,
      line: !weekOpen ? "The week is in · see how it went" : owedCount ? `${picked} of ${total} in · ${owedCount} still to make` : anyChangeable ? `All ${total} in · change any until its kickoff` : `All ${total} in · all locked`,
    } : null,
  };
}
