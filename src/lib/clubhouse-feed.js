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

/** Standings by wins, most first: each with a place (level players share it) and whether it is shared. */
export function placedStandings(rows) {
  const sorted = [...rows].sort((a, b) => b.wins - a.wins || a.firstName.localeCompare(b.firstName));
  return sorted.map((row) => {
    const above = sorted.filter((other) => other.wins > row.wins).length;
    const level = sorted.filter((other) => other.wins === row.wins).length;
    return { id: row.id, name: row.firstName, wins: row.wins, place: above + 1, tied: level > 1 };
  });
}

/** Bowl Pool time: from Dec 7 (Eastern) through January, the Bowl Pool's board is wheeled into the room. */
export function bowlSeason(iso) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: ET, month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return (month === 12 && day >= 7) || month === 1;
}

/**
 * The room's feed, and the viewer's ticket (one lamp a Pick'em pick, then Survivor's while they are still in it).
 * @param {{ home: import("./api-contracts").StandingsResponse, board: import("./api-contracts").SlateResponse }} reads
 */
export function clubhouseFeed({ home, board }) {
  const standings = placedStandings(home.rows ?? []);
  const you = standings.find((row) => row.id === home.viewerPlayerId);
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

  const survivorRows = home.survivorAvailable ? home.survivorRows ?? [] : [];
  const stillIn = survivorRows.filter((row) => row.status !== "eliminated").length;
  const meInSurvivor = survivorRows.find((row) => row.playerId === home.viewerPlayerId);
  const leaders = standings.filter((row) => row.place === 1);

  return {
    feed: {
      week: home.week ?? "",
      standings,
      games: games.map((game) => ({
        id: game.id,
        kickoff: kickoffLabel(game.kickoffAt),
        away: game.awayTeamAbbreviation,
        home: game.homeTeamAbbreviation,
        awayLine: lineFor(game, game.awayTeamId),
        homeLine: lineFor(game, game.homeTeamId),
      })),
      mine: mine.map((game, index) => abbreviation(game, myPicks[index].teamId)),
      news: {
        ...(standings.length ? { board: `${leaders.length === 1 ? `${leaders[0].name} leads` : `${leaders.length} lead`}${you ? ` · You: ${you.tied ? "T" : ""}${you.place}` : ""}` } : {}),
        ...(games.length ? { picks: owedCount ? `${owedCount} owed` : "All in" } : {}),
        ...(survivorRows.length ? { survivor: `${stillIn} of ${survivorRows.length} still in${meInSurvivor ? ` · ${meInSurvivor.status === "eliminated" ? "You’re out" : "You’re in"}` : ""}` } : {}),
      },
      owed: owedCount > 0,
      mail: false,
      bowl: bowlSeason(home.serverTime ?? board.serverTime ?? new Date().toISOString()),
    },
    ticket: games.length && total ? {
      lamps,
      line: !weekOpen ? "The week is in · see how it went" : owedCount ? `${picked} of ${total} in · ${owedCount} still to make` : `All ${total} in · change any until its kickoff`,
    } : null,
  };
}
