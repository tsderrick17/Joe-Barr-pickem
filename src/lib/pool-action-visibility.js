export function shouldShowPoolActionMatchup({ kickoffAt, now, hasSelections }) {
  const kickoffTime = new Date(kickoffAt).getTime();
  const currentTime = new Date(now).getTime();

  if (!Number.isFinite(kickoffTime) || !Number.isFinite(currentTime)) return false;
  return kickoffTime > currentTime || Boolean(hasSelections);
}

export function onlyPublicPickRows(rows) {
  return rows.filter((row) => Array.isArray(row.picks) && row.picks.length > 0);
}
