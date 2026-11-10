"use client";

import dynamic from "next/dynamic";

const AccountCapacityPanel = dynamic(() => import("@/components/account-capacity"));

/** Free limits: every account the site runs on, inside its free lane. */
export default function FreeLimitsPage() {
  return <AccountCapacityPanel />;
}
