"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import CommissionerOperationsMap from "@/components/commissioner-operations-map";
import GradingDashboard from "@/components/grading-dashboard";
import { ToolSection } from "@/components/commissioner/tool-section";

const FinalScoreReconciliation = dynamic(() => import("@/components/final-score-reconciliation"));
const GameExceptions = dynamic(() => import("@/components/game-exceptions"));
const AutomationPreflight = dynamic(() => import("@/components/automation-preflight"));
const LineLockChecker = dynamic(() => import("@/components/line-lock-checker"));
const ScoreSyncChecker = dynamic(() => import("@/components/score-sync-checker"));

/** Game day: where the pool stands, the week's games, then the fixes and the manual checks, all in view (no drawers). */
export default function GameDayPage() {
  const router = useRouter();
  return <>
    <CommissionerOperationsMap onOpenWorkspace={() => router.push("/admin/season")} />
    <GradingDashboard view="today" />
    <ToolSection id="fix" line="Postponements, no contests, and verified score corrections" title="Fix something">
      <FinalScoreReconciliation />
      <GameExceptions />
    </ToolSection>
    <ToolSection id="checks" line="When a scheduled lock or score sync needs checking" title="Checks and manual runs">
      <AutomationPreflight />
      <LineLockChecker />
      <ScoreSyncChecker />
    </ToolSection>
  </>;
}
