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
 * @param {{ templateId: string, title: string, periodName: string | null | undefined, eventAt?: string | null }} options
 */
export function automaticEmailSubject({ templateId, title, periodName, eventAt = null }) {
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
    .replaceAll("{{date}}", dateLabel)
    .trim();

  if (context && !title.includes("{{week}}") && !title.includes("{{date}}") && !result.toLocaleLowerCase().includes(context.toLocaleLowerCase())) {
    result = `${result} — ${context}`;
  }

  return result.slice(0, 80);
}
