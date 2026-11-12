"use client";

import { useState } from "react";
import { HapticFeelTest } from "@/components/haptic-feel-test";
import { LabClubhouse } from "@/components/lab/lab-clubhouse";
import { LabPadSkins } from "@/components/lab/lab-pad-skins";
import { LabToteBoard } from "@/components/lab/lab-tote-board";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { WorkshopTabs } from "@/components/workshop-tabs";
import { LAB_SHELF, labChoice, type LabTryOut } from "@/lib/lab-shelf.js";
import { useCommissionerAccess } from "@/lib/use-commissioner-access";

const STORAGE_KEY = "pickem-lab-try";
const LAMP_KEY = "pickem-lab-lamp";

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

  // Lamp-lit: the night look as a lounge after dark, a warm lamp over the table and the paper. It is a night mode, so it shows only at night.
  const [lamp, setLamp] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return window.localStorage.getItem(LAMP_KEY) === "on"; } catch { return false; }
  });

  function toggleLamp() {
    setLamp(!lamp);
    try { window.localStorage.setItem(LAMP_KEY, lamp ? "off" : "on"); } catch {}
  }

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
          <button aria-pressed={lamp} className="lab-lamp-switch" onClick={toggleLamp} type="button">Lamp-lit</button>
        </div>
        {lamp ? <p className="workshop-lab-intro lab-lamp-note">Lamp-lit shows in night mode: switch to night with the moon at the top.</p> : null}
        <div className={`lab-stage ${lamp ? "is-lamp" : ""}`}>
          {choice === "tote" ? <LabToteBoard /> : null}
          {choice === "skins" ? <LabPadSkins /> : null}
          {choice === "clubhouse" ? <LabClubhouse /> : null}
          {choice === "survivor" ? <LabSurvivorTable /> : null}
          {choice === "feel" ? <HapticFeelTest /> : null}
        </div>
      </> : <p className="workshop-lab-intro">{access === "checking" ? "Checking sign-in…" : "Commissioner only."}</p>}
    </div>
  );
}
