/**
 * @param {string} category
 * @param {string | null | undefined} automationKey
 * @returns {string}
 */
export function emailPreferenceColumn(category, automationKey = null) {
  if (category === "pick_due") {
    if (automationKey?.includes(":pick_due_sunday_11:")) return "email_pick_due_sunday_early_enabled";
    if (automationKey?.includes(":pick_due_sunday_3:")) return "email_pick_due_sunday_afternoon_enabled";
    if (automationKey?.includes(":pick_due_sunday_6:") || automationKey?.includes(":pick_due_monday:")) return "email_pick_due_primetime_enabled";
    return "email_pick_due_enabled";
  }

  return {
    weekly: "email_weekly_enabled",
    final_lines: "email_final_lines_enabled",
    sunday_final_lines: "email_sunday_final_lines_enabled",
    early_lock: "email_early_lock_enabled",
    weekly_recap: "email_weekly_recap_enabled",
    playoff_day_recap: "email_playoff_day_recap_enabled",
    playoff_public_reveal: "email_playoff_public_reveal_enabled",
    sunday_early_reveal: "email_sunday_early_reveal_enabled",
    sunday_late_reveal: "email_sunday_late_reveal_enabled",
    featured_window_reveal: "email_featured_window_reveal_enabled",
    ats_due: "email_ats_due_enabled",
    survivor_due: "email_survivor_due_enabled",
    custom: "email_notifications_enabled",
  }[category] ?? "email_notifications_enabled";
}
