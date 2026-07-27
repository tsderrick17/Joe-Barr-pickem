export function isDueForFinalScoreCheck({ kickoffAt, status }, now = new Date()) {
  if (status !== "scheduled" && status !== "live") return false;

  const kickoff = new Date(kickoffAt);
  const firstCheckAt = new Date(kickoff.getTime() + 3 * 60 * 60 * 1000);

  return now >= firstCheckAt;
}
