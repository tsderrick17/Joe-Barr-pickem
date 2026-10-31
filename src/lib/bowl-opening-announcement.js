// @ts-check
import { easternDateTimeToUtc } from "./schedule-time.js";
import { dateFormat } from "./date-format.js";

/** The email's subject. The phone notification's title (and the email's heading) is the shorter "The Bowl Pool is open". */
export const BOWL_OPENING_EMAIL_SUBJECT = "The Bowl Pool is open: claim your seat";
export const BOWL_OPENING_TITLE = "The Bowl Pool is open";

/**
 * When the one-time "the Bowl Pool is open" email and phone notification go out: 9:00 AM Eastern on the day players first see the Bowl Pool
 * (December 7, 3:00 AM Eastern), so nobody is woken by it and everyone who checks the pool after breakfast has already heard.
 * @param {number} seasonYear
 */
export function bowlOpeningAnnouncementAt(seasonYear) {
  return easternDateTimeToUtc(seasonYear, 12, 7, 9).toISOString();
}

/**
 * A bowl's name as a person says it: the pool keeps "Salute to Veterans", people say "the Salute to Veterans Bowl".
 * @param {string | null | undefined} name
 */
export function bowlSpokenName(name) {
  const text = String(name ?? "").trim();
  if (!text) return "first bowl game";
  return /bowl|championship|^cfp/i.test(text) ? text : `${text} Bowl`;
}

/** @param {Intl.DateTimeFormatOptions} options */
const inEastern = (options) => (/** @type {string} */ iso) => dateFormat("en-US", { ...options, timeZone: "America/New_York" }).format(new Date(iso));
const shortDay = inEastern({ weekday: "short", month: "short", day: "numeric" });
const longDay = inEastern({ weekday: "long", month: "short", day: "numeric" });
const monthDay = inEastern({ month: "short", day: "numeric" });

/**
 * The words of the opening announcement, from the schedule as it stands when the announcement is queued. The phone notification is `body`;
 * the email is `snapshot.intro` and `snapshot.steps` under the heading "How it works".
 * @param {{ seasonYear: number, firstGame: { bowl_name?: string | null, kickoff_at: string }, finalGameKickoffAt?: string | null }} schedule
 */
export function bowlOpeningMessage({ seasonYear, firstGame, finalGameKickoffAt = null }) {
  const season = `${seasonYear}–${String(seasonYear + 1).slice(2)}`;
  const finish = finalGameKickoffAt ? `the National Championship on ${monthDay(finalGameKickoffAt)}` : "the National Championship";
  return {
    title: BOWL_OPENING_TITLE,
    emailSubject: BOWL_OPENING_EMAIL_SUBJECT,
    body: `Claim your seat and pick every bowl and playoff game against the spread. First game: ${shortDay(firstGame.kickoff_at)}.`,
    snapshot: {
      kind: "bowl_pool_open",
      intro: `The ${season} Bowl Pool is open. Pick every bowl and College Football Playoff game against the spread, all the way through ${finish}.`,
      steps: [
        "Claim your seat. The Bowl Pool is separate from the NFL pool, so you join it on its own.",
        "Every correct pick against the spread is one point.",
        "Lines lock at 8 AM Eastern on game day, and each pick locks at that game's kickoff.",
        "Pick now or come back later. You can change any pick until its kickoff.",
        "The tiebreaker is the total points scored in the National Championship.",
        `The first game is the ${bowlSpokenName(firstGame.bowl_name)} on ${longDay(firstGame.kickoff_at)}. You can opt out any time before then.`,
      ],
    },
  };
}
