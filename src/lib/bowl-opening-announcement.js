// @ts-check
import { easternDateTimeToUtc } from "./schedule-time.js";
import { dateFormat } from "./date-format.js";

/** The two one-time Bowl Pool invitations. Their words are written in the app and filled in from the Bowl schedule, not saved wording. */
export const BOWL_INVITATION_CATEGORIES = /** @type {const} */ (["bowl_pool_open", "bowl_pool_last_call"]);

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
const clock = inEastern({ hour: "numeric", minute: "2-digit" });

/**
 * The game the Bowl Pool opens with: the earliest game still scheduled (a postponed or cancelled game is not the first game).
 * @template {{ status: string, kickoff_at: string }} Game
 * @param {Game[]} games
 * @returns {Game | undefined}
 */
export function firstScheduledBowlGame(games) {
  return games.filter((game) => game.status === "scheduled").sort((a, b) => Date.parse(a.kickoff_at) - Date.parse(b.kickoff_at))[0];
}

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

/** The last call's email subject, and its phone title (and the email's heading), "Last call for the Bowl Pool". */
export const BOWL_LAST_CALL_EMAIL_SUBJECT = "Last call: claim your Bowl Pool seat";
export const BOWL_LAST_CALL_TITLE = "Last call for the Bowl Pool";

/**
 * When the one-time "last call" email and phone notification go out: 24 hours before the first Bowl kickoff, to the players who have not joined
 * the Bowl Pool (entry closes at that kickoff).
 * @param {string} firstKickoffAt
 */
export function bowlLastCallAt(firstKickoffAt) {
  return new Date(Date.parse(firstKickoffAt) - 24 * 60 * 60 * 1000).toISOString();
}

/**
 * The words of the last call, from the first game as it stands when the call is queued. The phone notification is `body`; the email is
 * `snapshot.intro` and `snapshot.steps` under the heading "How it works", like the opening announcement.
 * @param {{ firstGame: { bowl_name?: string | null, kickoff_at: string } }} schedule
 */
export function bowlLastCallMessage({ firstGame }) {
  const at = clock(firstGame.kickoff_at);
  return {
    title: BOWL_LAST_CALL_TITLE,
    emailSubject: BOWL_LAST_CALL_EMAIL_SUBJECT,
    body: `The first game kicks off ${shortDay(firstGame.kickoff_at)} at ${at} ET, and entry closes then. Claim your seat now.`,
    snapshot: {
      kind: "bowl_pool_last_call",
      intro: `The Bowl Pool's first game, the ${bowlSpokenName(firstGame.bowl_name)}, kicks off ${longDay(firstGame.kickoff_at)} at ${at} ET. You haven't claimed your seat yet, and entry closes at that kickoff.`,
      steps: [
        "Claim your seat. It takes one tap, and you can opt out any time before the first game.",
        "Pick every bowl and playoff game against the spread. Every correct pick is one point.",
        "Pick now or come back later. You can change any pick until its kickoff.",
      ],
    },
  };
}
