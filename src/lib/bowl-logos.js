/**
 * The bowls' own pennants: each known bowl's real logo (public/bowl-logos/, small webp files made from the logos on the bowls' Wikipedia
 * articles) on a pennant whose cloth and hoist are taken from that logo's colours. A bowl is recognised by its name as the schedule import
 * saves it, whatever sponsor is in front ("Valero Alamo Bowl", "CFP Semifinal at the Goodyear Cotton Bowl Classic"). A bowl not listed here
 * flies a navy pennant lettered with its short name instead, so a new bowl never breaks the ticket; adding its logo is one row below.
 *
 * Checked against the playoff names before the bowls': a quarterfinal or semifinal is named for the bowl that hosts it.
 */
export const BOWL_PENNANTS = [
  { match: /national championship/i, logo: "championship", flag: "TITLE GAME", cloth: "rgb(246 241 230)", hoist: "rgb(192 122 26)" },
  { match: /rose bowl/i, logo: "rose", flag: "ROSE", cloth: "rgb(246 241 230)", hoist: "rgb(200 26 30)" },
  { match: /sugar bowl/i, logo: "sugar", flag: "SUGAR", cloth: "rgb(0 34 74)", hoist: "rgb(170 170 172)" },
  { match: /orange bowl/i, logo: "orange", flag: "ORANGE", cloth: "rgb(24 50 76)", hoist: "rgb(242 98 26)" },
  { match: /cotton bowl/i, logo: "cotton", flag: "COTTON", cloth: "rgb(0 50 98)", hoist: "rgb(240 194 0)" },
  { match: /peach bowl/i, logo: "peach", flag: "PEACH", cloth: "rgb(26 50 122)", hoist: "rgb(221 30 52)" },
  { match: /fiesta bowl/i, logo: null, flag: "FIESTA" },
  { match: /alamo bowl/i, logo: "alamo", flag: "ALAMO", cloth: "rgb(192 26 30)", hoist: "rgb(240 194 0)" },
  { match: /citrus bowl/i, logo: "citrus", flag: "CITRUS", cloth: "rgb(0 52 40)", hoist: "rgb(218 98 26)" },
  { match: /\bsun bowl/i, logo: "sun", flag: "SUN", cloth: "rgb(166 24 46)", hoist: "rgb(240 214 52)" },
  { match: /music city bowl/i, logo: "music-city", flag: "MUSIC CITY", cloth: "rgb(22 22 74)", hoist: "rgb(240 194 0)" },
  { match: /holiday bowl/i, logo: "holiday", flag: "HOLIDAY", cloth: "rgb(18 52 112)", hoist: "rgb(212 40 52)" },
  { match: /pinstripe bowl/i, logo: "pinstripe", flag: "PINSTRIPE", cloth: "rgb(12 36 66)", hoist: "rgb(238 102 32)" },
  { match: /las vegas bowl/i, logo: "las-vegas", flag: "LAS VEGAS", cloth: "rgb(22 22 22)", hoist: "rgb(200 162 72)" },
  { match: /hawai.?i bowl/i, logo: "hawaii", flag: "HAWAI'I", cloth: "rgb(0 112 52)", hoist: "rgb(120 72 24)" },
  { match: /\bla bowl/i, logo: "la", flag: "LA", cloth: "rgb(0 30 80)", hoist: "rgb(205 32 48)" },
  { match: /cure bowl/i, logo: "cure", flag: "CURE", cloth: "rgb(222 102 152)", hoist: "rgb(24 24 24)" },
];

/** Words that are never the bowl's own name: sponsors' joins and the playoff's wording. */
const FILLER = /\b(presented by.*|cfp|college football playoff|quarterfinal|semifinal|first round|at the|game|classic|bowl)\b/gi;

/**
 * The pennant for a bowl: its logo and colours when the bowl is known, else its short name (the words before "Bowl", sponsor and all,
 * trimmed to the last two words so it fits) on the navy pennant.
 * @param {string | null | undefined} bowlName
 * @returns {{ flag: string, logo: string | null, cloth: string | null, hoist: string | null }}
 */
export function bowlPennant(bowlName) {
  const name = String(bowlName ?? "").trim();
  const known = BOWL_PENNANTS.find((entry) => entry.match.test(name));
  if (known) return { flag: known.flag, logo: known.logo ?? null, cloth: known.cloth ?? null, hoist: known.hoist ?? null };
  const beforeBowl = (/(.*?)\bbowl\b/i.exec(name)?.[1] ?? name).replace(FILLER, " ").trim().split(/\s+/).filter(Boolean);
  const flag = beforeBowl.slice(-2).join(" ").toUpperCase() || "BOWL";
  return { flag, logo: null, cloth: null, hoist: null };
}
