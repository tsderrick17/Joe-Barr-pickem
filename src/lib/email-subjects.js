function easternDateLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function easternPlayoffDayLabel(value) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

/**
 * @param {{ templateId: string, title: string, periodName: string | null | undefined, eventAt?: string | null, matchupLabel?: string | null }} options
 */
export function automaticEmailSubject({ templateId, title, periodName, eventAt = null, matchupLabel = null }) {
  const weekTemplates = new Set(["weekly", "weekly_recap", "weekly_recap_pickem_only"]);
  const dateTemplates = new Set(["playoff_day_recap", "playoff_public_reveal"]);
  const dateLabel = eventAt
    ? dateTemplates.has(templateId)
      ? easternPlayoffDayLabel(eventAt)
      : easternDateLabel(eventAt)
    : "Game day";
  const context = weekTemplates.has(templateId)
    ? periodName
    : dateTemplates.has(templateId) && eventAt
      ? dateLabel
      : null;

  let result = title
    .replaceAll("{{week}}", periodName ?? "This week")
    .replaceAll("{{round}}", periodName ?? "Playoff")
    .replaceAll("{{matchup}}", matchupLabel ?? "playoff matchup")
    .replaceAll("{{date}}", dateLabel)
    .trim();

  if (templateId === "playoff_public_reveal" && matchupLabel && !title.includes("{{matchup}}") && !result.toLocaleLowerCase().includes(matchupLabel.toLocaleLowerCase())) {
    const datedSuffix = eventAt ? ` — ${dateLabel}` : "";
    result = result.endsWith(datedSuffix)
      ? `${result.slice(0, -datedSuffix.length)}: ${matchupLabel}${datedSuffix}`
      : `${result}: ${matchupLabel}`;
  }

  if (context && !title.includes("{{week}}") && !title.includes("{{date}}") && !result.toLocaleLowerCase().includes(context.toLocaleLowerCase())) {
    result = `${result} — ${context}`;
  }

  return result.slice(0, 80);
}
