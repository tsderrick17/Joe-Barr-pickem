"use client";

import dynamic from "next/dynamic";
import GradingDashboard from "@/components/grading-dashboard";
import { ToolSection } from "@/components/commissioner/tool-section";

const AutomationWatchdog = dynamic(() => import("@/components/automation-watchdog"));
const AutomationHealth = dynamic(() => import("@/components/automation-health"));
const SentryVerification = dynamic(() => import("@/components/sentry-verification"));
const PlayerSignInHardening = dynamic(() => import("@/components/player-sign-in-hardening"));

/** Health: the watchdog, automation, error alerts, player sign-in and the activity log. */
export default function HealthPage() {
  return <>
    <AutomationWatchdog />
    <AutomationHealth />
    <ToolSection id="alerts" line="Error alerts and player sign-in" title="Alerts and sign-in">
      <SentryVerification />
      <PlayerSignInHardening />
    </ToolSection>
    <GradingDashboard view="log" />
  </>;
}
