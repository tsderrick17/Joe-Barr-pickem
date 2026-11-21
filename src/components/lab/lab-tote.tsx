"use client";

import { useState } from "react";
import { Sheet } from "@/components/commissioner/wheel-parts";
import { ToteBoard, type Ticket } from "@/components/clubhouse/big-board";
import { Chips } from "@/components/clubhouse/chips";
import { TicketForm } from "@/components/clubhouse/ticket-form";
import { LAB_VIEWER, LAB_WEEK10_SURVIVOR, labStandard } from "@/lib/lab-clubhouse.js";
import { labBoardView } from "@/lib/lab-board-view.js";
import { labSurvivorChampion, LAB_SURVIVOR_LAST_WEEK } from "@/lib/lab-samples.js";

/** The Lab's Big Board: the clubhouse's real Big Board and ticket (src/components/clubhouse) on the sample league, with a chip for each moment. */

type Scene = "before" | "gameday" | "graded" | "out" | "over" | "wildcard" | "wildcard-day" | "wildcard-out";
const SCENES: ReadonlyArray<readonly [Scene, string]> = [["before", "Before kickoff"], ["gameday", "Game day"], ["graded", "Graded"], ["out", "Out of Survivor"], ["over", "Survivor decided"], ["wildcard", "Wild Card"], ["wildcard-day", "Wild Card game day"], ["wildcard-out", "Out of the race"]];

/**
 * What a player has in at the start of a sample scene: both picks, and the Survivor team unless one is still owed. In the Wild Card
 * round, four of the six picks, so two are owed.
 */
function sampleTicket(viewer: string, survivorIn: boolean, round: "regular" | "wildcard" = "regular"): Ticket {
  const picks = labStandard(viewer, { round, moment: "before", viewer }).slats.map((slat) => slat.team as string);
  if (round === "wildcard") return { picks: picks.slice(0, 4), survivor: null };
  return { picks, survivor: survivorIn ? (LAB_WEEK10_SURVIVOR as Record<string, string>)[viewer] ?? null : null };
}
const viewerOf = (scene: Scene) => (scene === "out" ? "Hank" : scene === "wildcard-out" ? "Bev" : LAB_VIEWER);
const roundOf = (scene: Scene) => (scene.startsWith("wildcard") ? "wildcard" : "regular");

/**
 * The Big Board with the Lab's moment chips above it. Your row is your ticket: tap it to pick or change. `survivorIn` false starts with
 * the Survivor pick still owed; `startOpen` opens the ticket at once (the room's picks wall and pinned ticket lead here);
 * `onTicket` hears whether every pick is in.
 */
export function BigBoardRoom({ survivorIn = true, startOpen = false, onTicket, onSurvivor }: { survivorIn?: boolean; startOpen?: boolean; onTicket?: (allIn: boolean) => void; onSurvivor?: () => void }) {
  const [scene, setSceneOnly] = useState<Scene>("before");
  const [ticket, setTicket] = useState<Ticket>(() => sampleTicket(LAB_VIEWER, survivorIn));
  const [open, setOpen] = useState(startOpen);
  const [sent, setSent] = useState(false);
  // "Out of Survivor" is seen as Hank, who lost in week 3; "Out of the race" as Bev, who can no longer catch the leader; the rest as Walt.
  const viewer = viewerOf(scene);
  const round = roundOf(scene);
  const moment = scene === "gameday" || scene === "graded" ? scene : scene === "wildcard-day" ? "gameday" : "before";
  const champion = scene === "over" ? labSurvivorChampion(LAB_SURVIVOR_LAST_WEEK) : null;
  const view = labBoardView({ moment, viewer, ticket, champion, round });
  const canPick = view.canPick;

  function setScene(next: Scene) {
    setSceneOnly(next);
    setTicket(sampleTicket(viewerOf(next), next === "before" ? survivorIn : true, roundOf(next)));
    setSent(false);
  }
  function submit(next: Ticket) {
    setTicket(next);
    setOpen(false);
    setSent(true);
    onTicket?.(next.picks.length === view.maxPicks && (!view.survivor.playing || Boolean(next.survivor)));
  }

  return (
    <div className="lab-room-stack">
      <Chips label="Moment" onChange={setScene} options={SCENES} value={scene} />
      <ToteBoard onOpen={() => setOpen(true)} onSurvivor={onSurvivor} sent={sent} view={view} />
      <Sheet onClose={() => setOpen(false)} open={open && canPick} title="Your ticket">
        <TicketForm onSubmit={submit} view={view} />
      </Sheet>
    </div>
  );
}
