"use client";

import dynamic from "next/dynamic";

const BowlPoolReadiness = dynamic(() => import("@/components/bowl-pool-readiness"));
const BowlPoolLines = dynamic(() => import("@/components/bowl-pool-lines"));
const BowlPoolExceptions = dynamic(() => import("@/components/bowl-pool-exceptions"));

/** The Bowl Pool: readiness, lines and exceptions. */
export default function BowlPoolAdminPage() {
  return <>
    <BowlPoolReadiness />
    <BowlPoolLines />
    <BowlPoolExceptions />
  </>;
}
