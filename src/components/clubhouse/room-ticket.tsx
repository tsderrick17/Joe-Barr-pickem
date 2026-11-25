"use client";

import { haptic } from "@/lib/haptics-client";
import Link from "next/link";
import { useLayoutEffect, useRef, type CSSProperties, type RefObject } from "react";
import { Lamp, Logo, type LampState } from "@/components/clubhouse/lamps";

/** One place on your ticket (see src/lib/clubhouse-ticket.js, where every state is decided). */
export type TicketPlace = { team?: string; line?: string; label: string; note: string; state: LampState | "missed"; survivor?: boolean };
/** What the ticket shows, as `roomTicket` works it out. */
export type RoomTicketData = { places: TicketPlace[]; status: { label: string; text: string } | null; action: "PICK" | "VIEW"; stub: string };

/** A line as it is printed: a true minus sign. */
const printed = (line: string) => line.replace(/^-/, "−");

/**
 * Your ticket, pinned at the foot of every clubhouse screen: an admission ticket on cream card. The body names it (the week over
 * YOUR TICKET, in the Big Board's own lettering) and carries one place a pick in a single row, divided by hairlines: the team's logo with
 * its lamp at the logo's shoulder, the team and line, and the kickoff or how it came out. Survivor's place is its team's logo under the
 * word Survivor. A place still to fill is an empty ring, named; a place missed is a fainter one. Across a perforation the dark stub is
 * the one thing to press. One row always, so the ticket stays the same short height in a playoff round and never covers the room:
 * on a phone a round of five or six shows each place as its logo (or ring) and line alone; on a desktop each place lies on its side.
 */
export function RoomTicket({ ticket, week, savedAt = null, onOpen, href, tucked = false, onTuck }: { ticket: RoomTicketData; week: string; savedAt?: string | null; onOpen?: () => void; href?: string; tucked?: boolean; onTuck?: (tucked: boolean) => void }) {
  // Tucking it away (the real clubhouse): the arrow just above the ticket folds it to half its height (its heading put away, every pick
  // still on it) and the same arrow, turned the other way, opens it whole again. Pressing the ticket itself still opens your ticket.
  // The fold is one motion: the ticket's edge glides to its new height while each logo slides to where it now sits, the words fade
  // in place, and the heading fades as it goes (see `useTicketFold`).
  const slip = useRef<HTMLSpanElement>(null);
  const fold = useTicketFold(slip, tucked);
  const { places } = ticket;
  // The heading's right side mirrors its left: a small word over what it says.
  // Nothing while picks are owed (the stub counts them); otherwise the week in a few words, or Saved with the time for a while after a save.
  const said = savedAt ? { label: "Saved", text: savedAt } : ticket.status;
  const status = said ? <span className={`slip-status${savedAt ? " is-saved" : ""}`}><i>{said.label}</i>{said.text}</span> : null;
  const size = places.length >= 5 ? " is-many" : places.length === 4 ? " is-four" : "";
  const inside = (
    <span className={`slip${places.length > 3 ? " is-round" : ""}${tucked ? " is-tucked" : ""}`} ref={slip}>
      <span className="slip-body">
        <span className="slip-head"><span className="slip-title"><i>{week}</i><b>YOUR TICKET</b></span>{status}</span>
        <span className={`slip-places${size}`} style={{ ["--cols" as string]: places.length }}>
          {places.map((place, index) => (
            <span className={`slip-place is-${place.state}${place.survivor ? " is-survivor" : ""}`} key={index} style={{ "--place": index } as CSSProperties}>
              <span className="slip-mark">
                {place.team ? <Logo eager team={place.team} /> : <span aria-hidden="true" className="slip-ring" />}
                <Lamp state={place.state === "missed" ? "off" : place.state} survivor={place.survivor} />
              </span>
              <span className="slip-words">
                {place.team && !place.survivor
                  ? <span className="slip-pick"><b>{place.team}</b> {printed(place.line ?? "")}</span>
                  : <span className="slip-pick is-label">{place.label}{place.survivor && place.team ? <span className="sr-only"> {place.team}</span> : null}</span>}
                <small>{place.note}</small>
              </span>
            </span>
          ))}
        </span>
      </span>
      <span aria-hidden="true" className="slip-stub">
        {ticket.stub ? <small>{ticket.stub}</small> : null}
        <b>{ticket.action}</b>
        <i />
      </span>
    </span>
  );
  const ticketButton = href ? <Link className="lab-room-ticket" href={href} onClick={() => haptic("tick")}>{inside}</Link> : <button className="lab-room-ticket" onClick={() => { haptic("tick"); onOpen?.(); }} type="button">{inside}</button>;
  if (!onTuck) return ticketButton;
  return (
    <div className={`club-ticket-dock${tucked ? " is-tucked" : ""}`} data-no-pull-refresh="">
      <button aria-expanded={!tucked} aria-label={tucked ? "Open up your ticket" : "Tuck your ticket away"} className="club-ticket-tab" onClick={() => { fold(); onTuck(!tucked); }} type="button">
        <svg aria-hidden="true" className="club-ticket-arrow" fill="none" height="10" viewBox="0 0 12 8" width="12"><path d="M1.5 1.75 6 6.25l4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
      </button>
      {ticketButton}
    </div>
  );
}

/** The fold's timing: one smooth deceleration, no overshoot (the curve iOS uses for its sheets). The arrow turns on the same curve. */
const FOLD = { duration: 420, easing: "cubic-bezier(.32, .72, 0, 1)" };

type FoldStart = { height: number; marks: { x: number; y: number; w: number }[] };

/**
 * The ticket's fold, played by measuring (FLIP): `fold()` notes where everything is just before the switch; once the new layout is in,
 * each piece starts from where it was and glides to where it is. Positions are taken from the slip's own corner, so a logo rides with
 * the ticket's edge as it moves. Nothing plays as the page opens, and nothing at all with reduced motion.
 */
function useTicketFold(slip: RefObject<HTMLSpanElement | null>, tucked: boolean) {
  const start = useRef<FoldStart | null>(null);
  useLayoutEffect(() => {
    const from = start.current;
    start.current = null;
    const node = slip.current;
    if (!from || !node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Every position is read before anything moves: once the height starts playing, the layout under it is mid-fold.
    const box = node.getBoundingClientRect();
    const marks = [...node.querySelectorAll<HTMLElement>(".slip-mark")].map((mark) => ({ mark, now: mark.getBoundingClientRect() }));
    node.animate([{ height: `${from.height}px`, overflow: "hidden" }, { height: `${box.height}px`, overflow: "hidden" }], FOLD);
    marks.forEach(({ mark, now }, index) => {
      const was = from.marks[index];
      if (!was) return;
      const dx = was.x - (now.left - box.left);
      const dy = was.y - (now.top - box.top);
      const scale = now.width ? was.w / now.width : 1;
      mark.animate([{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, transformOrigin: "0 0" }, { transform: "none", transformOrigin: "0 0" }], FOLD);
    });
    node.querySelectorAll<HTMLElement>(".slip-words").forEach((words) => {
      words.animate([{ opacity: 0, transform: tucked ? "translateX(-6px)" : "translateY(4px)" }, { opacity: 1, transform: "none" }], { ...FOLD, delay: tucked ? 130 : 90, fill: "backwards" });
    });
    const head = node.querySelector<HTMLElement>(".slip-head");
    head?.animate(tucked ? [{ opacity: 1 }, { opacity: 0 }] : [{ opacity: 0 }, { opacity: 1 }], tucked ? { duration: 110, easing: "ease-out" } : { ...FOLD, delay: 140, fill: "backwards" });
  }, [slip, tucked]);
  return () => {
    const node = slip.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const marks = [...node.querySelectorAll<HTMLElement>(".slip-mark")].map((mark) => {
      const rect = mark.getBoundingClientRect();
      return { x: rect.left - box.left, y: rect.top - box.top, w: rect.width };
    });
    start.current = { height: box.height, marks };
  };
}
