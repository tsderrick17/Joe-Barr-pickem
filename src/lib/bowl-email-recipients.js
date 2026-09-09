export function bowlEmailRecipients(players, entries, picks, gameId = null) {
  const active = new Set(entries.filter((entry) => entry.status === "active").map((entry) => entry.player_id));
  const picked = new Set(picks.filter((pick) => gameId === null || pick.game_id === gameId).map((pick) => pick.entry_id));
  return players.filter((player) => active.has(player.id) && player.notification_email && (gameId === null || !picked.has(player.entry_id))).map((player) => ({ playerId: player.id, email: player.notification_email }));
}
