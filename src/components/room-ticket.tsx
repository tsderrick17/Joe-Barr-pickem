"use client";

import Link from "next/link";
import { Lamp, Logo, type LampState } from "@/components/lab/lab-tote";

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
export function RoomTicket({ ticket, week, savedAt = null, onOpen, href }: { ticket: RoomTicketData; week: string; savedAt?: string | null; onOpen?: () => void; href?: string }) {
  const { places } = ticket;
  // The heading's right side mirrors its left: a small word over what it says.
  // Nothing while picks are owed (the stub counts them); otherwise the week in a few words, or Saved with the time for a while after a save.
  const said = savedAt ? { label: "Saved", text: savedAt } : ticket.status;
  const status = said ? <span className={`slip-status${savedAt ? " is-saved" : ""}`}><i>{said.label}</i>{said.text}</span> : null;
  const size = places.length >= 5 ? " is-many" : places.length === 4 ? " is-four" : "";
  const inside = (
    <span className={`slip${places.length > 3 ? " is-round" : ""}`}>
      <span className="slip-body">
        <span className="slip-head"><span className="slip-title"><i>{week}</i><b>YOUR TICKET</b></span>{status}</span>
        <span className={`slip-places${size}`} style={{ ["--cols" as string]: places.length }}>
          {places.map((place, index) => (
            <span className={`slip-place is-${place.state}${place.survivor ? " is-survivor" : ""}`} key={index}>
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
  return href ? <Link className="lab-room-ticket" href={href}>{inside}</Link> : <button className="lab-room-ticket" onClick={onOpen} type="button">{inside}</button>;
}
