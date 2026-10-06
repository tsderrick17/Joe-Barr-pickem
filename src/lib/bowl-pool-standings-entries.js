/**
 * Only active Bowl entries compete on the current standings card. Completed
 * entries remain available to historical and public-pick views separately.
 *
 * @template {{ status: string }} T
 * @param {T[] | null | undefined} entries
 * @returns {T[]}
 */
export function activeBowlStandingsEntries(entries) {
  return (entries ?? []).filter((entry) => entry.status === "active");
}
