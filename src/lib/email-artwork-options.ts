export type EmailArtworkOptions = { density: "compact" | "comfortable" };

export function emailArtworkOptions(value: unknown): EmailArtworkOptions {
  const density = value && typeof value === "object" && "density" in value ? value.density : null;
  return { density: density === "comfortable" ? "comfortable" : "compact" };
}

export function emailArtworkTemplateId(category: string, snapshot?: unknown) {
  if (category !== "weekly_recap") return category;
  const survivor = snapshot && typeof snapshot === "object" && "survivor" in snapshot ? snapshot.survivor : null;
  return survivor && typeof survivor === "object" && (("in" in survivor && Number(survivor.in) > 1) || ("championCrownedInRecapWeek" in survivor && survivor.championCrownedInRecapWeek))
    ? "weekly_recap" : "weekly_recap_pickem_only";
}

export function emailArtworkKinds(category: string, snapshot?: unknown): string[] {
  if (category === "weekly_recap") return emailArtworkTemplateId(category, snapshot) === "weekly_recap" ? ["summary", "survivor"] : ["summary"];
  if (category === "playoff_day_recap") return ["summary"];
  if (["sunday_early_reveal", "sunday_late_reveal", "featured_window_reveal", "playoff_public_reveal"].includes(category)) return ["reveal"];
  const kinds: Record<string, string> = { weekly: "fresh", final_lines: "gameday", sunday_final_lines: "gameday", early_lock: "earlylock", bowl_daily_recap: "bowl", bowl_line_lock: "bowl-lines" };
  return kinds[category] ? [kinds[category]] : [];
}
