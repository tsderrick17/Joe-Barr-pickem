const CREDITS_PER_SCORE_CHECK = 2;
const WEEKS_PER_MONTH = 4.33;

const PLAN_DEFINITIONS = [
  { id: "conservative", label: "Conservative", checksPerGame: 3, expectedMinutesAfterFinal: 60, description: "Protects the budget with a small post-kickoff check window." },
  { id: "balanced", label: "Balanced", checksPerGame: 6, expectedMinutesAfterFinal: 30, description: "Adds frequent checks through the normal final-score window." },
  { id: "responsive", label: "Responsive", checksPerGame: 10, expectedMinutesAfterFinal: 15, description: "Uses the most checks for high-volume Sundays and playoffs." },
];

function wholeNumber(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function simulatePollingPlans({ games = 16, weeks = 1, observedWeeklyCredits = null } = {}) {
  const gameCount = Math.max(1, wholeNumber(games));
  const weekCount = Math.max(1, wholeNumber(weeks));
  const observed = observedWeeklyCredits === null ? null : wholeNumber(observedWeeklyCredits);
  return PLAN_DEFINITIONS.map((plan) => {
    const weeklyCredits = gameCount * plan.checksPerGame * CREDITS_PER_SCORE_CHECK;
    const monthlyCredits = Math.ceil(weeklyCredits * WEEKS_PER_MONTH);
    return {
      ...plan,
      weeklyCredits,
      monthlyCredits,
      periodCredits: weeklyCredits * weekCount,
      versusObservedWeeklyCredits: observed === null ? null : weeklyCredits - observed,
    };
  });
}

/** @param {{ observedCreditsPerFinal?: number | null, settlementAverageMinutes?: number | null }} input */
export function recommendPollingPlan({ observedCreditsPerFinal = null, settlementAverageMinutes = null } = {}) {
  if (settlementAverageMinutes !== null && settlementAverageMinutes > 75) return "responsive";
  if (observedCreditsPerFinal !== null && observedCreditsPerFinal < 8) return "balanced";
  return "conservative";
}

export const pollingPlanAssumptions = {
  creditsPerScoreCheck: CREDITS_PER_SCORE_CHECK,
  weeksPerMonth: WEEKS_PER_MONTH,
};
