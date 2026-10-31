// @ts-check

/**
 * Where a reminder's button takes the reader, as a path on this site. The email's button and the phone notification both use this one answer,
 * so a tap lands in the same place either way.
 * @param {string} category
 */
export function reminderDestinationPath(category) {
  if (category === "bowl_line_lock" || category === "bowl_daily_recap" || category === "bowl_pick_due" || category === "bowl_pool_open" || category === "bowl_pool_last_call") return "/bowl-pool";
  const recapOrReveal = ["weekly_recap", "playoff_day_recap", "bowl_daily_recap", "playoff_public_reveal", "sunday_early_reveal", "sunday_late_reveal", "featured_window_reveal"];
  return recapOrReveal.includes(category) ? "/" : "/board";
}

/** The most a notification carries; phones show far less, and push services refuse large messages. */
const MAX_BODY = 600;

/**
 * The phone notification for one reminder: the email's subject as the title, the email's message (with its extra congratulation or
 * elimination line, when it has one) as the body, and the same destination. One notification per reminder, so a repeat replaces it.
 * @param {{ id: string, category: string, title: string, body: string, extraLines?: string[] }} reminder
 */
export function reminderPushMessage(reminder) {
  const body = [reminder.body, ...(reminder.extraLines ?? [])].filter((line) => typeof line === "string" && line.trim()).join("\n\n");
  return {
    title: reminder.title,
    body: body.length > MAX_BODY ? `${body.slice(0, MAX_BODY - 1).trimEnd()}…` : body,
    url: reminderDestinationPath(reminder.category),
    tag: `reminder-${reminder.id}`,
  };
}
