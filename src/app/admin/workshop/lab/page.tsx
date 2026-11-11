"use client";

import { useState } from "react";
import { HapticFeelTest } from "@/components/haptic-feel-test";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { LabTicketFamily } from "@/components/lab/lab-ticket-family";
import { WorkshopTabs } from "@/components/workshop-tabs";
import { LAB_SHELF, labChoice, type LabTryOut } from "@/lib/lab-shelf.js";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";

const STORAGE_KEY = "pickem-lab-try";

/**
 * The Workshop's Lab: try-outs the Commissioner can play with on a real phone before anything reaches players. Nothing here reads or
 * changes pool data. A shelf of chips picks the try-out; the choice is kept in the address (?try=) and remembered on this device.
 */
export default function WorkshopLabPage() {
  const access = useCommissionerAccess();
  // Read once in the browser. The server never renders the shelf (sign-in is checked in the browser first), so this cannot mismatch.
  const [choice, setChoice] = useState<LabTryOut | null>(() => {
    if (typeof window === "undefined") return null;
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(STORAGE_KEY); } catch {}
    return labChoice(new URLSearchParams(window.location.search).get("try"), saved);
  });

  function choose(id: LabTryOut) {
    setChoice(id);
    try { window.localStorage.setItem(STORAGE_KEY, id); } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set("try", id);
    window.history.replaceState(window.history.state, "", url);
  }

  return (
    <div className="workshop">
      <WorkshopTabs current="lab" />
      {access === "allowed" ? <>
        <p className="workshop-lab-intro">Try-outs before they reach players. Nothing here changes the pool.</p>
        <div aria-label="Try-outs" className="lab-chips lab-shelf" role="group">
          {LAB_SHELF.map((item) => <button aria-pressed={choice === item.id} key={item.id} onClick={() => choose(item.id)} type="button">{item.name}</button>)}
        </div>
        {choice === "survivor" ? <LabSurvivorTable /> : null}
        {choice === "ticket" ? <LabTicketFamily /> : null}
        {choice === "feel" ? <HapticFeelTest /> : null}
      </> : <p className="workshop-lab-intro">{access === "checking" ? "Checking sign-in…" : "Commissioner only."}</p>}
    </div>
  );
}
