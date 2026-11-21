import { coverMargin, kickoffLabel, lineFor } from "./game-lines.js";

/**
 * Your ticket at the foot of the clubhouse, worked out from the same two reads the room makes (the Standings' /api/home and the
 * Slate's /api/board). It is the one place the ticket's states are decided, so every state reads the same way everywhere:
 *
 *  Places: a regular week has one place a pick (Pick 1, Pick 2) then Survivor's while the player is still in it; a playoff round has
 *  one place a game, in kickoff order (BUF @ KC until it is picked), and no Survivor. Each place is one of:
 *    - open      not picked, and a game it could go on has not kicked off       note: Open
 *    - missed    not picked, and nothing left to pick it on (or out of the race) note: No pick
 *    - in        picked, its game not decided                                    note: Sun 1:00 / Live / Postponed
 *    - won/lost  picked and graded (Pick'em against the spread, a push a loss;   note: Won 27–20 / Lost 20–27 / Push · loss
 *                Survivor straight up, a tie a loss)                                    (Survivor: Won 27–20 / Lost / Tie · loss)
 *
 *  The ticket says one thing in its corner (a small word over a short value) and one on its stub, from the first of these that holds:
 *    forfeited          FORFEITED / Score stands                 stub VIEW
 *    out of the race    RACE OVER / Score stands                 stub VIEW
 *    week final         FINAL / 1–1                                   stub FINAL / VIEW
 *    a pick owed        (nothing: the stub says it)                  stub N LEFT / PICK
 *    all in, changeable ALL IN / Change until kickoff                 stub ALL IN / VIEW
 *    all in, locked     ALL IN / Locked                               stub ALL IN / VIEW
 *  (Saved, with the time, takes the corner for a while after a save; the page adds it.)
 *
 * Where a player stands is never on the ticket: that is the Big Board's to say.
 */
export function roomTicket({ home, board }) {
  const games = [...(board.games ?? [])].sort((a, b) => Date.parse(a.kickoffAt ?? "") - Date.parse(b.kickoffAt ?? ""));
  if (!games.length) return null;
  const byId = new Map(games.map((game) => [game.id, game]));
  const now = Date.parse(board.serverTime ?? home.serverTime ?? new Date().toISOString());
  const upcoming = (game) => Boolean(game) && game.status === "scheduled" && Date.parse(game.kickoffAt) > now;
  const playoff = Boolean(home.isPlayoff);
  const picks = (board.myPicks ?? []).filter((pick) => byId.has(pick.gameId));
  const pickIn = (game) => picks.find((pick) => pick.gameId === game.id);
  const survivor = board.survivor;
  const inSurvivor = !playoff && Boolean(survivor?.available && survivor.status === "active");
  const forfeited = Boolean(board.pickem?.forfeit?.forfeited);
  const raceOver = forfeited || Boolean(board.pickem?.playoffEliminated);
  const weekFinal = home.weekStatus === "complete" || games.every((game) => game.status === "final");
  const anyUpcoming = games.some(upcoming);
  const canPick = !raceOver && !weekFinal && anyUpcoming;

  const side = (game, teamId) => (teamId === game.awayTeamId ? "away" : "home");
  const abbreviation = (game, teamId) => (side(game, teamId) === "away" ? game.awayTeamAbbreviation : game.homeTeamAbbreviation);
  const scores = (game, teamId) => {
    const own = side(game, teamId) === "away" ? game.awayScore : game.homeScore;
    const other = side(game, teamId) === "away" ? game.homeScore : game.awayScore;
    return own === null || own === undefined || other === null || other === undefined ? null : { own, other };
  };
  const shortKickoff = (game) => kickoffLabel(game.kickoffAt).replace(/ (AM|PM)$/, "");
  const before = (game) => (game.status === "live" ? "Live" : game.status === "scheduled" ? shortKickoff(game) : game.status === "final" ? "Final" : capitalized(game.status));

  // A Pick'em pick: graded against the spread (a push is a loss, and says so).
  const pickemPlace = (pick) => {
    const game = byId.get(pick.gameId);
    const result = side(game, pick.teamId) === "away" ? game.awayResult : game.homeResult;
    const score = scores(game, pick.teamId);
    const line = lineFor(game, pick.teamId);
    const push = result === "loss" && score && coverMargin(score.own, score.other, line) === 0;
    const state = result === "win" ? "won" : result === "loss" ? "lost" : "in";
    const said = score ? ` ${score.own}–${score.other}` : "";
    const note = push ? "Push · loss" : result === "win" ? `Won${said}` : result === "loss" ? `Lost${said}` : before(game);
    return { team: abbreviation(game, pick.teamId), line: line === "—" ? "" : line, label: "", note, state };
  };
  // Survivor's pick: straight up, a tie a loss.
  const survivorPlace = () => {
    const game = survivor.pick ? byId.get(survivor.pick.game_id) : null;
    if (!game) return { label: "Survivor", note: canPick ? "Open" : "No pick", state: canPick ? "off" : "missed", survivor: true };
    const score = game.status === "final" ? scores(game, survivor.pick.selected_team_id) : null;
    const state = !score ? "in" : score.own > score.other ? "won" : "lost";
    const note = !score ? before(game) : score.own === score.other ? "Tie · loss" : `${state === "won" ? "Won" : "Lost"} ${score.own}–${score.other}`;
    return { team: abbreviation(game, survivor.pick.selected_team_id), label: "Survivor", note, state, survivor: true };
  };
  const empty = (label, open) => ({ label, note: open ? "Open" : "No pick", state: open ? "off" : "missed" });

  let places;
  if (playoff) {
    // A place a game: picked, or open until its own game kicks off.
    places = games.map((game) => (pickIn(game) ? pickemPlace(pickIn(game)) : empty(`${game.awayTeamAbbreviation} @ ${game.homeTeamAbbreviation}`, canPick && upcoming(game))));
  } else {
    const wanted = Math.max(home.maxPicks ?? 0, picks.length);
    const picked = [...picks].sort((a, b) => Date.parse(byId.get(a.gameId).kickoffAt) - Date.parse(byId.get(b.gameId).kickoffAt));
    // A regular week's picks can go on any game still to kick off, so a place stays open while any game does.
    places = [
      ...picked.map(pickemPlace),
      ...Array.from({ length: wanted - picked.length }, (_, index) => empty(`Pick ${picked.length + index + 1}`, canPick)),
      ...(inSurvivor ? [survivorPlace()] : []),
    ];
  }
  if (!places.length) return null;

  const owed = places.filter((place) => place.state === "off").length;
  const changeable = picks.some((pick) => upcoming(byId.get(pick.gameId))) || Boolean(inSurvivor && survivor.pick && upcoming(byId.get(survivor.pick.game_id)));
  const won = places.filter((place) => !place.survivor && place.state === "won").length;
  const lost = places.filter((place) => !place.survivor && place.state === "lost").length;

  // The corner: a small word over a short value, the same shape in every state.
  const status = forfeited ? { label: "Forfeited", text: "Score stands" }
    : raceOver ? { label: "Race over", text: "Score stands" }
    : weekFinal ? { label: "Final", text: `${won}–${lost}` }
    : owed ? null
    : changeable ? { label: "All in", text: "Change until kickoff" }
    : { label: "All in", text: "Locked" };
  return {
    places,
    // The lamps, one a place, for the Lab's pinned ticket and anything that only wants the lights.
    lamps: places.map((place) => (place.state === "missed" ? "off" : place.state)),
    survivor: inSurvivor,
    owed,
    status,
    action: owed ? "PICK" : "VIEW",
    stub: owed ? `${owed} LEFT` : raceOver ? "" : weekFinal ? "FINAL" : "ALL IN",
  };
}

const capitalized = (text) => (text ? text[0].toUpperCase() + text.slice(1) : "");
