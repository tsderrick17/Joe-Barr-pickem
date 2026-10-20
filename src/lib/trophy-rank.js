/**
 * Places for the Trophy Room's All-Time Table. Players level on what the table is sorted by share a place (standard competition ranking: two players
 * tied for 1st are both 1st and the next player is 3rd), and are marked as tied. Wins are level on wins; under Hit rate, players are level when they
 * are on the same side of the picks threshold and have the same hit rate. The rows must already be in order.
 * @param {{ h: number, avg: number | null, qualified: boolean }[]} rows
 * @param {"wins" | "rate"} key
 * @returns {{ place: number, tied: boolean }[]}
 */
export function placesFor(rows, key) {
  const same = (a, b) => (key === "wins" ? a.h === b.h : a.qualified === b.qualified && (a.avg ?? null) === (b.avg ?? null));
  return rows.map((row, index) => {
    let first = index;
    while (first > 0 && same(rows[first - 1], row)) first -= 1;
    const tied = first !== index || (index + 1 < rows.length && same(rows[index + 1], row));
    return { place: first + 1, tied };
  });
}
