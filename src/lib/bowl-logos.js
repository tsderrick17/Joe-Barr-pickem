/**
 * The bowls' own pennants: each known bowl's real logo (public/bowl-logos/, small webp files made from the logos on the bowls' Wikipedia
 * articles) on a pennant whose cloth and hoist are taken from that logo's colours. A bowl is recognised by its name as the schedule import
 * saves it, whatever sponsor is in front ("Valero Alamo Bowl", "CFP Semifinal at the Goodyear Cotton Bowl Classic"). A bowl not listed here
 * flies a navy pennant lettered with its short name instead, so a new bowl never breaks the ticket; adding its logo is one row below.
 *
 * Checked against the playoff names before the bowls': a quarterfinal or semifinal is named for the bowl that hosts it.
 *
 * Updated every December, once the schedule is imported (see docs/OPERATIONS.md, "Bowl logos"): a bowl that is new or renamed gets its logo
 * (trimmed, at most 200 x 160, saved as webp) and a row here; its cloth and hoist are picked from the logo's own colours.
 */
export const BOWL_PENNANTS = [
  { match: /national championship/i, logo: "championship", flag: "TITLE GAME", cloth: "rgb(246 241 230)", hoist: "rgb(192 122 26)" },
  { match: /rose bowl/i, logo: "rose", flag: "ROSE", cloth: "rgb(246 241 230)", hoist: "rgb(200 26 30)" },
  { match: /sugar bowl/i, logo: "sugar", flag: "SUGAR", cloth: "rgb(0 34 74)", hoist: "rgb(170 170 172)" },
  { match: /orange bowl/i, logo: "orange", flag: "ORANGE", cloth: "rgb(24 50 76)", hoist: "rgb(242 98 26)" },
  { match: /cotton bowl/i, logo: "cotton", flag: "COTTON", cloth: "rgb(0 50 98)", hoist: "rgb(240 194 0)" },
  { match: /peach bowl/i, logo: "peach", flag: "PEACH", cloth: "rgb(26 50 122)", hoist: "rgb(221 30 52)" },
  { match: /fiesta bowl/i, logo: "fiesta", flag: "FIESTA", cloth: "rgb(10 30 60)", hoist: "rgb(200 20 40)" },
  { match: /alamo bowl/i, logo: "alamo", flag: "ALAMO", cloth: "rgb(192 26 30)", hoist: "rgb(240 194 0)" },
  { match: /citrus bowl/i, logo: "citrus", flag: "CITRUS", cloth: "rgb(0 52 40)", hoist: "rgb(218 98 26)" },
  { match: /\bsun bowl/i, logo: "sun", flag: "SUN", cloth: "rgb(166 24 46)", hoist: "rgb(240 214 52)" },
  { match: /music city bowl/i, logo: "music-city", flag: "MUSIC CITY", cloth: "rgb(22 22 74)", hoist: "rgb(240 194 0)" },
  { match: /holiday bowl/i, logo: "holiday", flag: "HOLIDAY", cloth: "rgb(18 52 112)", hoist: "rgb(212 40 52)" },
  { match: /pinstripe bowl/i, logo: "pinstripe", flag: "PINSTRIPE", cloth: "rgb(12 36 66)", hoist: "rgb(238 102 32)" },
  { match: /las vegas bowl/i, logo: "las-vegas", flag: "LAS VEGAS", cloth: "rgb(22 22 22)", hoist: "rgb(200 162 72)" },
  { match: /hawai.?i bowl/i, logo: "hawaii", flag: "HAWAI'I", cloth: "rgb(0 112 52)", hoist: "rgb(120 72 24)" },
  { match: /\bla bowl/i, logo: "la", flag: "LA", cloth: "rgb(0 30 80)", hoist: "rgb(205 32 48)" },
  { match: /gator bowl/i, logo: "gator", flag: "GATOR", cloth: "rgb(45 45 45)", hoist: "rgb(216 24 48)" },
  { match: /liberty bowl/i, logo: "liberty", flag: "LIBERTY", cloth: "rgb(0 96 168)", hoist: "rgb(216 168 0)" },
  { match: /texas bowl/i, logo: "texas", flag: "TEXAS", cloth: "rgb(0 20 110)", hoist: "rgb(200 30 40)" },
  { match: /armed forces bowl/i, logo: "armed-forces", flag: "ARMED FORCES", cloth: "rgb(0 60 130)", hoist: "rgb(200 30 45)" },
  { match: /first responder bowl/i, logo: "first-responder", flag: "FIRST RESPONDER", cloth: "rgb(30 30 30)", hoist: "rgb(240 120 48)" },
  { match: /military bowl/i, logo: "military", flag: "MILITARY", cloth: "rgb(10 20 60)", hoist: "rgb(190 30 40)" },
  { match: /fenway bowl/i, logo: "fenway", flag: "FENWAY", cloth: "rgb(40 90 70)", hoist: "rgb(170 190 190)" },
  { match: /pop-?tarts bowl/i, logo: "pop-tarts", flag: "POP-TARTS", cloth: "rgb(0 72 168)", hoist: "rgb(240 192 48)" },
  { match: /independence bowl/i, logo: "independence", flag: "INDEPENDENCE", cloth: "rgb(30 10 60)", hoist: "rgb(170 25 30)" },
  { match: /mayo bowl/i, logo: "dukes-mayo", flag: "MAYO", cloth: "rgb(10 20 40)", hoist: "rgb(240 192 24)" },
  { match: /gasparilla bowl/i, logo: "gasparilla", flag: "GASPARILLA", cloth: "rgb(0 100 100)", hoist: "rgb(240 100 0)" },
  { match: /68 ventures bowl/i, logo: "68-ventures", flag: "68 VENTURES", cloth: "rgb(24 24 24)", hoist: "rgb(200 30 40)" },
  { match: /\b(rate|cactus) bowl/i, logo: "rate", flag: "RATE", cloth: "rgb(60 10 70)", hoist: "rgb(240 150 40)" },
  { match: /gameabove sports bowl|quick lane bowl/i, logo: "gameabove", flag: "GAMEABOVE", cloth: "rgb(20 20 20)", hoist: "rgb(60 180 60)" },
  { match: /arizona bowl/i, logo: "arizona", flag: "ARIZONA", cloth: "rgb(40 110 110)", hoist: "rgb(196 150 80)" },
  { match: /bahamas bowl/i, logo: "bahamas", flag: "BAHAMAS", cloth: "rgb(0 150 180)", hoist: "rgb(250 200 40)" },
  { match: /boca raton bowl/i, logo: "boca-raton", flag: "BOCA RATON", cloth: "rgb(30 40 100)", hoist: "rgb(230 70 120)" },
  { match: /new mexico bowl/i, logo: "new-mexico", flag: "NEW MEXICO", cloth: "rgb(60 110 165)", hoist: "rgb(216 24 24)" },
  { match: /new orleans bowl/i, logo: "new-orleans", flag: "NEW ORLEANS", cloth: "rgb(72 30 120)", hoist: "rgb(0 144 72)" },
  { match: /salute to veterans bowl/i, logo: "salute", flag: "SALUTE", cloth: "rgb(0 30 80)", hoist: "rgb(170 10 20)" },
  { match: /potato bowl/i, logo: "potato", flag: "POTATO", cloth: "rgb(24 150 210)", hoist: "rgb(240 192 72)" },
  { match: /frisco football classic|xbox bowl/i, logo: "frisco-classic", flag: "FRISCO", cloth: "rgb(30 50 120)", hoist: "rgb(200 30 50)" },
  { match: /frisco bowl/i, logo: "frisco", flag: "FRISCO", cloth: "rgb(30 50 120)", hoist: "rgb(200 30 50)" },
  { match: /myrtle beach bowl/i, logo: "myrtle-beach", flag: "MYRTLE BEACH", cloth: "rgb(20 130 200)", hoist: "rgb(240 120 30)" },
  { match: /reliaquest bowl/i, logo: "reliaquest", flag: "RELIAQUEST", cloth: "rgb(20 30 50)", hoist: "rgb(60 170 200)" },
  { match: /birmingham bowl/i, logo: "birmingham", flag: "BIRMINGHAM", cloth: "rgb(24 96 168)", hoist: "rgb(210 30 40)" },
  { match: /san juan bowl/i, logo: "san-juan", flag: "SAN JUAN", cloth: "rgb(16 40 96)", hoist: "rgb(240 196 40)" },
  { match: /celebration bowl/i, logo: "celebration", flag: "CELEBRATION", cloth: "rgb(20 60 140)", hoist: "rgb(240 110 30)" },
  { match: /puerto rico bowl/i, logo: "puerto-rico", flag: "PUERTO RICO", cloth: "rgb(20 50 120)", hoist: "rgb(220 40 40)" },
  { match: /poinsettia bowl/i, logo: "poinsettia", flag: "POINSETTIA", cloth: "rgb(16 40 80)", hoist: "rgb(200 30 40)" },
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
  // The schedule import saves most bowls by their short name alone ("Boca Raton", "Gasparilla"), so a name without "Bowl" is read as one.
  const probe = /\bbowl\b|classic|championship|\bcfp\b|playoff|first round/i.test(name) ? name : `${name} Bowl`;
  const known = BOWL_PENNANTS.find((entry) => entry.match.test(probe));
  if (known) return { flag: known.flag, logo: known.logo ?? null, cloth: known.cloth ?? null, hoist: known.hoist ?? null };
  const beforeBowl = (/(.*?)\bbowl\b/i.exec(name)?.[1] ?? name).replace(FILLER, " ").trim().split(/\s+/).filter(Boolean);
  const flag = beforeBowl.slice(-2).join(" ").toUpperCase() || "BOWL";
  return { flag, logo: null, cloth: null, hoist: null };
}
