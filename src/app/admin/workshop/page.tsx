"use client";

import dynamic from "next/dynamic";

// The board measures the screen and reads this device's saved settings, so it is drawn in the browser only.
const WorkshopBoard = dynamic(() => import("@/components/workshop-board"), { ssr: false });

/** The Commissioner's Workshop, full screen: every custom piece of the pool on one endless board. */
export default function WorkshopPage() {
  return <WorkshopBoard />;
}
