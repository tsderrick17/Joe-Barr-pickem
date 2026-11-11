"use client";

import { HapticFeelTest } from "@/components/haptic-feel-test";
import { WorkshopTabs } from "@/components/workshop-tabs";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";

/**
 * The Workshop's Lab: try-outs the Commissioner can play with on a real phone before anything reaches players. Nothing here reads or
 * changes pool data. Today it holds the Feel test (moved from Notifications); the offseason prototypes join it here.
 */
export default function WorkshopLabPage() {
  const access = useCommissionerAccess();
  return (
    <div className="workshop">
      <WorkshopTabs current="lab" />
      {access === "allowed" ? <>
        <p className="workshop-lab-intro">Try-outs before they reach players. Nothing here changes the pool.</p>
        <HapticFeelTest />
      </> : <p className="workshop-lab-intro">{access === "checking" ? "Checking sign-in…" : "Commissioner only."}</p>}
    </div>
  );
}
