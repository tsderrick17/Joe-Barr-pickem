function wholeNumber(value) {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

function detailsFor(run) {
  return run?.details && typeof run.details === "object" ? run.details : {};
}

export function providerRequestCost(run) {
  const details = detailsFor(run);
  const reported = wholeNumber(details.requestsLast);
  if (reported !== null) return reported;
  if (run?.job_type === "scores" && details.providerChecked === true) return 2;
  if (run?.job_type === "line_locks" && wholeNumber(details.dueGames) > 0) return 1;
  if (run?.job_type === "odds" && details.providerChecked !== false) return 1;
  return 0;
}

function scoreSlice(runs, start, end) {
  const rows = runs.filter((run) => {
    if (run.job_type !== "scores") return false;
    const timestamp = new Date(run.completed_at ?? run.started_at).getTime();
    return timestamp >= start.getTime() && timestamp < end.getTime();
  });
  const credits = rows.reduce((total, run) => total + providerRequestCost(run), 0);
  const finals = rows.reduce((total, run) => total + (wholeNumber(detailsFor(run).finalScoresImported) ?? 0), 0);
  return { credits, finals, creditsPerFinal: finals > 0 ? Number((credits / finals).toFixed(2)) : null };
}

export function summarizeProviderEfficiency(runs, now = new Date()) {
  const scoreRuns = runs.filter((run) => run.job_type === "scores" && providerRequestCost(run) > 0);
  const totalCredits = runs.reduce((total, run) => total + providerRequestCost(run), 0);
  const scoreCredits = scoreRuns.reduce((total, run) => total + providerRequestCost(run), 0);
  const finalizedGames = scoreRuns.reduce(
    (total, run) => total + (wholeNumber(detailsFor(run).finalScoresImported) ?? 0),
    0,
  );
  const productiveScoreCalls = scoreRuns.filter(
    (run) => (wholeNumber(detailsFor(run).finalScoresImported) ?? 0) > 0,
  ).length;
  const currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const current = scoreSlice(runs, currentStart, now);
  const previous = scoreSlice(runs, previousStart, currentStart);
  const trend = current.creditsPerFinal === null || previous.creditsPerFinal === null
    ? "insufficient"
    : current.creditsPerFinal < previous.creditsPerFinal - 0.1
      ? "improving"
      : current.creditsPerFinal > previous.creditsPerFinal + 0.1
        ? "worsening"
        : "steady";

  return {
    windowDays: 30,
    providerCalls: runs.filter((run) => providerRequestCost(run) > 0).length,
    totalCredits,
    scoreCalls: scoreRuns.length,
    scoreCredits,
    finalizedGames,
    productiveScoreCalls,
    productiveRate: scoreRuns.length > 0
      ? Math.round((productiveScoreCalls / scoreRuns.length) * 100)
      : null,
    creditsPerFinal: finalizedGames > 0 ? Number((scoreCredits / finalizedGames).toFixed(2)) : null,
    currentSevenDayCreditsPerFinal: current.creditsPerFinal,
    previousSevenDayCreditsPerFinal: previous.creditsPerFinal,
    trend,
  };
}
