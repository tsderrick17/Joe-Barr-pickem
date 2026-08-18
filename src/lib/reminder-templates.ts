import type { ReminderAudience, ReminderCategory } from "@/lib/reminder-audience";

export type ReminderTemplate = {
  id: string;
  category: ReminderCategory;
  audience: ReminderAudience;
  title: string;
  body: string;
  label: string;
};

export const reminderTemplates: ReminderTemplate[] = [
  { id: "weekly", category: "weekly", audience: "all_active", title: "A fresh slate is ready", body: "The full preliminary slate is ready for the week, with black lines throughout. Take a look whenever you have a moment and make your selections before kickoff.", label: "Wednesday fresh slate" },
  { id: "final_lines", category: "final_lines", audience: "all_active", title: "Today's official lines are set", body: "The final lines are posted for today's games. Take a quick look at The Slate before the day gets moving.", label: "ALL final gameday lines — 8:30 AM" },
  { id: "sunday_final_lines", category: "sunday_final_lines", audience: "all_active", title: "Sunday's official lines are set", body: "The final lines are posted for today's games. Take a quick look at The Slate before the day gets moving.", label: "Sunday-only final lines — 8:30 AM" },
  { id: "early_lock", category: "early_lock", audience: "all_active", title: "International game locked early", body: "The international matchup has its official line early. Take a look at The Slate when you have a moment.", label: "International early lock" },
  { id: "pick_due_sunday_11", category: "pick_due", audience: "pick_due", title: "Selections still to be made", body: "A friendly reminder: there is still time to take care of anything waiting for you. Open the pool when you are ready.", label: "Sunday selections reminder — 11 AM" },
  { id: "pick_due_sunday_3", category: "pick_due", audience: "pick_due", title: "Selections still to be made", body: "A friendly reminder: there is still time to take care of anything waiting for you. Open the pool when you are ready.", label: "Sunday selections reminder — 3 PM" },
  { id: "pick_due_monday", category: "pick_due", audience: "pick_due", title: "Selections still to be made", body: "A final reminder before tonight's game: please take a moment to look over anything still waiting for you.", label: "Monday selections reminder — 5 PM" },
  { id: "sunday_early_reveal", category: "sunday_early_reveal", audience: "all_active", title: "Sunday early window picks are public", body: "The early games are underway. The public Pick'em board is ready to look over whenever you have a moment.", label: "Sunday early window reveal" },
  { id: "sunday_late_reveal", category: "sunday_late_reveal", audience: "all_active", title: "Sunday late window picks are public", body: "The late games are underway. The updated public Pick'em board is ready to look over whenever you have a moment.", label: "Sunday late window reveal" },
  { id: "featured_window_reveal", category: "featured_window_reveal", audience: "all_active", title: "Featured-game picks are public", body: "The featured game window is underway. Public Pick'em selections are now available on the standings page.", label: "Primetime or international reveal" },
  { id: "weekly_recap", category: "weekly_recap", audience: "all_active", title: "This week in Joe Barr Pick'em", body: "The final slate, current standings, and Survivor recap are ready to look over. Thanks for being part of the pool.", label: "Weekly recap — Tuesday morning" },
  { id: "playoff_day_recap", category: "playoff_day_recap", audience: "all_active", title: "Today in the playoff race", body: "Today’s playoff card is final and the updated Pick'em race is ready to look over. Good luck in the next round.", label: "Playoff day recap — after final grades" },
  { id: "playoff_public_reveal", category: "playoff_public_reveal", audience: "all_active", title: "Playoff picks are public", body: "This playoff window is underway. Public Pick'em receipts are ready to look over whenever you have a moment.", label: "Playoff public pick window — at kickoff" },
];

export function reminderTemplate(id: string) {
  return reminderTemplates.find((template) => template.id === id) ?? null;
}
