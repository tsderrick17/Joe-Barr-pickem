"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Constitution } from "@/components/lab/lab-clubhouse";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";

/** The constitution on the clubhouse wall, posted in full (the Handbook's own text), with one way back to the room. */
export default function ClubhouseRulesPage() {
  const access = useCommissionerAccess();
  const router = useRouter();
  useEffect(() => { if (access === "denied") router.replace("/"); }, [access, router]);
  if (access !== "allowed") return null;
  return (
    <main className="clubhouse-page is-rules">
      <header className="lab-room-bar">
        <Link className="lab-room-back" href="/clubhouse"><span aria-hidden="true">‹</span> Back to Clubhouse</Link>
      </header>
      <Constitution />
      <Link className="lab-room-back is-foot" href="/clubhouse"><span aria-hidden="true">‹</span> Back to Clubhouse</Link>
    </main>
  );
}
