/**
 * The Workshop Lab's sample bowl season: real bowl names and real schools in made-up matchups, made-up lines and scores, and the Lab's
 * invented players. Nothing here is pool data, and nothing is read from or written to the database.
 *
 * Each bowl carries a short name for its pennant ("ROSE"), the way a college pennant is lettered, and its real logo (public/lab/bowl-logos/,
 * from the bowls' Wikipedia articles, for this try-out only) with a pennant cloth and hoist taken from the logo's own colours.
 */
import { LAB_PLAYERS } from "./lab-samples.js";

/** The sample bowls in kickoff order. `favourite` is "away" or "home"; `line` is on the favourite; `final` is [away, home]. */
export const LAB_BOWLS = [
  { id: "b1", bowl: "Cure Bowl", flag: "CURE", day: "Sat Dec 20", time: "12:00 PM", away: "Ohio", home: "Jacksonville State", favourite: "away", line: 3.5, final: [27, 20], logo: "cure", cloth: "rgb(222 102 152)", hoist: "rgb(24 24 24)" },
  { id: "b2", bowl: "LA Bowl", flag: "LA", day: "Sat Dec 20", time: "3:30 PM", away: "Fresno State", home: "Washington State", favourite: "home", line: 2.5, final: [24, 31], logo: "la", cloth: "rgb(0 30 80)", hoist: "rgb(205 32 48)" },
  { id: "b3", bowl: "Las Vegas Bowl", flag: "LAS VEGAS", day: "Sat Dec 20", time: "7:30 PM", away: "Utah", home: "Ole Miss", favourite: "home", line: 6.5, final: [21, 24], logo: "las-vegas", cloth: "rgb(22 22 22)", hoist: "rgb(200 162 72)" },
  { id: "b4", bowl: "Hawai'i Bowl", flag: "HAWAI'I", day: "Tue Dec 23", time: "8:00 PM", away: "Navy", home: "Hawai'i", favourite: "away", line: 4.5, final: [30, 17], logo: "hawaii", cloth: "rgb(0 112 52)", hoist: "rgb(120 72 24)" },
  { id: "b5", bowl: "Pinstripe Bowl", flag: "PINSTRIPE", day: "Sat Dec 27", time: "12:00 PM", away: "Boston College", home: "Rutgers", favourite: "home", line: 1.5, final: [20, 23], logo: "pinstripe", cloth: "rgb(12 36 66)", hoist: "rgb(238 102 32)" },
  { id: "b6", bowl: "Holiday Bowl", flag: "HOLIDAY", day: "Sat Dec 27", time: "8:00 PM", away: "Iowa", home: "USC", favourite: "home", line: 5.5, final: [17, 13], logo: "holiday", cloth: "rgb(18 52 112)", hoist: "rgb(212 40 52)" },
  { id: "b7", bowl: "Music City Bowl", flag: "MUSIC CITY", day: "Tue Dec 30", time: "2:30 PM", away: "Missouri", home: "Virginia Tech", favourite: "away", line: 3.5, final: [28, 21], logo: "music-city", cloth: "rgb(22 22 74)", hoist: "rgb(240 194 0)" },
  { id: "b8", bowl: "Alamo Bowl", flag: "ALAMO", day: "Tue Dec 30", time: "7:30 PM", away: "Texas Tech", home: "Oregon", favourite: "home", line: 7.5, final: [31, 35], logo: "alamo", cloth: "rgb(192 26 30)", hoist: "rgb(240 194 0)" },
  { id: "b9", bowl: "Sun Bowl", flag: "SUN", day: "Wed Dec 31", time: "2:00 PM", away: "Arizona", home: "Duke", favourite: "home", line: 2.5, final: [24, 20], logo: "sun", cloth: "rgb(166 24 46)", hoist: "rgb(240 214 52)" },
  { id: "b10", bowl: "Citrus Bowl", flag: "CITRUS", day: "Wed Dec 31", time: "3:00 PM", away: "LSU", home: "Michigan", favourite: "away", line: 1.5, final: [27, 24], logo: "citrus", cloth: "rgb(0 52 40)", hoist: "rgb(218 98 26)" },
  { id: "b11", bowl: "Rose Bowl", flag: "ROSE", day: "Thu Jan 1", time: "5:00 PM", away: "Indiana", home: "Ohio State", favourite: "home", line: 8.5, final: [21, 31], logo: "rose", cloth: "rgb(246 241 230)", hoist: "rgb(200 26 30)" },
  { id: "b12", bowl: "Sugar Bowl", flag: "SUGAR", day: "Thu Jan 1", time: "8:45 PM", away: "Notre Dame", home: "Georgia", favourite: "home", line: 2.5, final: [27, 24], logo: "sugar", cloth: "rgb(0 34 74)", hoist: "rgb(170 170 172)" },
  { id: "b13", bowl: "Orange Bowl", flag: "ORANGE", day: "Fri Jan 2", time: "7:45 PM", away: "Clemson", home: "Miami", favourite: "home", line: 3.5, final: [20, 27], logo: "orange", cloth: "rgb(24 50 76)", hoist: "rgb(242 98 26)" },
  { id: "b14", bowl: "Peach Bowl", flag: "PEACH", day: "Fri Jan 2", time: "4:00 PM", away: "Alabama", home: "Penn State", favourite: "away", line: 1.5, final: [24, 23], logo: "peach", cloth: "rgb(26 50 122)", hoist: "rgb(221 30 52)" },
  { id: "b15", bowl: "Cotton Bowl", flag: "COTTON", day: "Fri Jan 9", time: "7:30 PM", away: "Notre Dame", home: "Ohio State", favourite: "home", line: 4.5, final: [24, 28], logo: "cotton", cloth: "rgb(0 50 98)", hoist: "rgb(240 194 0)" },
  { id: "b16", bowl: "National Championship", flag: "TITLE GAME", day: "Mon Jan 19", time: "7:30 PM", away: "Miami", home: "Ohio State", favourite: "home", line: 3.5, final: [24, 27], tiebreaker: true, logo: "championship", cloth: "rgb(246 241 230)", hoist: "rgb(192 122 26)" },
];

/** Points in the season the Lab can stand on: how many bowls have been played by then. */
export const LAB_BOWL_STOPS = [
  { id: "open", label: "Dec 19", played: 0 },
  { id: "early", label: "Dec 28", played: 6 },
  { id: "new-year", label: "Jan 2", played: 12 },
  { id: "over", label: "Jan 20", played: 16 },
];

/** The viewer in the sample league, and their saved picks ("away" or "home"); the rest are still to pick. */
export const LAB_BOWL_VIEWER = "Earl";
export const LAB_BOWL_MINE = { b1: "away", b2: "home", b3: "away", b4: "away", b5: "home", b7: "away", b9: "away", b11: "home", b12: "away" };

/** "W" when the side covered (lines are always half points, so there is no push). */
export function labBowlResult(game, side) {
  const [away, home] = game.final;
  const margin = side === "away" ? away - home : home - away;
  const spread = side === game.favourite ? -game.line : game.line;
  return margin + spread > 0 ? "W" : "L";
}

/** The line as a pick of `side` reads it: "-3.5" for the favourite, "+3.5" for the other side. */
export function labBowlLine(game, side) {
  return `${side === game.favourite ? "-" : "+"}${game.line}`;
}

/**
 * Every sample player's record at a stop: wins and losses over the bowls played, a bowl with no pick counting as a loss. The viewer's
 * record uses `mine`; the others pick by a fixed pattern so the table is the same every time.
 */
export function labBowlStandings(played, mine) {
  const games = LAB_BOWLS.slice(0, played);
  return LAB_PLAYERS.map((name, index) => {
    let wins = 0;
    games.forEach((game, gameIndex) => {
      const side = name === LAB_BOWL_VIEWER ? mine[game.id] : (index * 5 + gameIndex * 3) % 7 < 4 ? game.favourite : game.favourite === "away" ? "home" : "away";
      if (side && labBowlResult(game, side) === "W") wins += 1;
    });
    return { name, wins, losses: games.length - wins };
  }).sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
}
