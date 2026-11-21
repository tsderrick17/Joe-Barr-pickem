"use client";

import { useState, type ReactNode } from "react";
import { LabSurvivorTable } from "@/components/lab/lab-survivor-table";
import { BigBoardRoom } from "@/components/lab/lab-tote";
import { Chips } from "@/components/clubhouse/chips";
import { Constitution } from "@/components/clubhouse/constitution";
import { RoomScene, type Room, type RoomFeed } from "@/components/clubhouse/room-scene";
import { RoomTicket } from "@/components/clubhouse/room-ticket";
import { PlaquesShelf, type Champions } from "@/components/clubhouse/trophy-room";
import TrophyTurntable from "@/components/trophy-turntable";
import { LAB_VIEWER, labKickedOff, labLeaderboard, labStandard } from "@/lib/lab-clubhouse.js";
import { LAB_RECORDS, LAB_SLATE, labAtsResult, labLineFor, labSurvivorAt } from "@/lib/lab-samples.js";

/**
 * Lab try-out: the whole pool as one clubhouse, with the sample league only. Built for a phone first.
 *  - The room: a grand beach bungalow drawn in 3D and shown as one picture (by day, and at night with the pool lit), seen from just
 *    inside, looking down the room under a thatched beach-hut ceiling with two big palm-leaf fans. There is room to walk: in past
 *    the poker table, along the bar, round the lounge and out through the open doors. Tap anything to go there: the wall that faces
 *    you where picks are made (the Big Board, under it one wide board of the week's spreads, the counter; no sign says
 *    "sportsbook"), the bar down the right wall (the plaques along its front, the laptop on top: the pool chat, a
 *    mail sign when there's a new message), the stone chimney on the left (the fire lit at night, a Trophy Room sign on it above the
 *    framed constitution) (it opens today's turning table and banners), the lounge by the fire (the record book open on
 *    its table), the oval Survivor poker table forward in the middle with a chair for every player, and from Dec 7 the Bowl Pool's
 *    bulletin board, wheeled in at the front right.
 *  - Everything that can be tapped says so: a gilt name plate with an arrow sits on each thing, always, and the three with news worth
 *    a glance (the Big Board, Survivor, the Bowl Pool) carry a line of it. A plain list of the rooms sits under the picture for anyone
 *    who would rather tap a word.
 *  - Picks are made on the Big Board: your own row there is your ticket. Your ticket is also pinned at the bottom of every screen (a
 *    lamp for each pick, lit once it is in, and the next deadline) and opens the Big Board with the ticket ready. The picks wall glows
 *    while a pick is still owed.
 *  - One tap opens a room; one "Back to Clubhouse" button at the top of every room goes back. No swiping.
 * Other players' picks stay hidden until their game kicks off, exactly as on the real pages.
 */

const ROOM_TITLE: Record<Room, string> = {
  board: "The Big Board", trophies: "Trophy Room", survivor: "Survivor", bowl: "Bowl Pool", chat: "Pool chat", constitution: "Constitution",
};

const CHAMPIONS: Champions[] = [
  { season: "2026", pickem: "Earl", survivor: "Rosie", bowl: "Walt" },
  { season: "2025", pickem: "Walt", survivor: "Dottie", bowl: "Rosie" },
  { season: "2024", pickem: "Earl", survivor: "Walt", bowl: "June" },
  { season: "2023", pickem: "Walt", survivor: "Lou", bowl: "Earl" },
];

/** The Lab's champions in the shape the real Trophy Room takes them, so the real table can stand here. */
const SAMPLE_SEASONS = CHAMPIONS.map((year) => ({ seasonYear: Number(year.season), pickem: [{ name: year.pickem }], survivor: [{ name: year.survivor }], bowl: [{ name: year.bowl }] }));

/**
 * The Trophy Room: today's page as it is (the trophies on their turning table, the banners of the one at the front, the records),
 * with the season plaques added under the banners. Plaques and records used to be spots in the room; they live here now.
 */
function TrophyRoom() {
  return (
    <div className="lab-room-stack lab-wall-table">
      <TrophyTurntable seasons={SAMPLE_SEASONS} />
      <PlaquesShelf seasons={CHAMPIONS} />
      <RecordsTable />
    </div>
  );
}

/** The all-time Pick'em records, best hit rate first: place, player, wins, losses and the rate they make. */
function RecordsTable({ rows = LAB_RECORDS }: { rows?: Array<{ name: string; wins: number; losses: number; rate: number }> }) {
  return (
    <section aria-label="Records" className="lab-records">
      <h4>Records <small>all-time Pick’em</small></h4>
      <table>
        <thead><tr><th scope="col">#</th><th scope="col">Player</th><th scope="col">W</th><th scope="col">L</th><th scope="col">Rate</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.name}><td>{index + 1}</td><th scope="row">{row.name}</th><td>{row.wins}</td><td>{row.losses}</td><td>{row.rate.toFixed(3).slice(1)}</td></tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

type Season = "regular" | "bowls";

/** The sample league's feed for the Lab's room. */
function labFeed(season: Season, allIn: boolean, mail: boolean): RoomFeed {
  const rows = labLeaderboard({ round: "regular", moment: "gameday" });
  const you = rows.find((row) => row.name === LAB_VIEWER);
  const seats = labSurvivorAt(9);
  return {
    week: "Week 10",
    standings: rows,
    games: LAB_SLATE.map((game) => {
      const done = (team: string) => ({ score: (game.final as unknown as Record<string, number>)[team], covered: labAtsResult(game, team) === "W" });
      return { id: game.id, kickoff: game.kickoff, away: game.away, home: game.home, awayLine: labLineFor(game, game.away), homeLine: labLineFor(game, game.home), ...(labKickedOff(LAB_SLATE, game.id, "gameday") ? { final: { away: done(game.away), home: done(game.home) } } : {}) };
    }),
    mine: labStandard(LAB_VIEWER, { round: "regular", moment: "before" }).slats.map((slat) => slat.team),
    news: {
      board: `${rows[0].name} leads · You: ${you?.tied ? "T" : ""}${you?.place ?? ""}`,
      picks: allIn ? "All in" : "1 owed",
      survivor: `${seats.filter((seat) => !seat.out).length} of ${seats.length} still in · ${seats.find((seat) => seat.name === LAB_VIEWER)?.out ? "You’re out" : "You’re in"}`,
      bowl: "Open now",
    },
    owed: !allIn,
    mail,
    bowl: season === "bowls",
  };
}

/** The Lab's room: the sample league in the picture, and the plain list of rooms below. */
function ClubRoom({ season, allIn, mail, onEnter }: { season: Season; allIn: boolean; mail: boolean; onEnter: (room: Room, ticket?: boolean) => void }) {
  return (
    <>
      <RoomScene feed={labFeed(season, allIn, mail)} onSpot={(_spot, next, ticket) => onEnter(next, ticket)} />
      <div aria-label="Rooms" className="lab-room-list" role="group">
        {(["board", "survivor", "trophies", "constitution", "chat", ...(season === "bowls" ? ["bowl"] : [])] as Room[]).map((room) => (
          <button key={room} onClick={() => onEnter(room)} type="button">{ROOM_TITLE[room]}{room === "chat" && mail ? " · new" : ""}</button>
        ))}
      </div>
    </>
  );
}

/** A room not built yet: it says plainly what will open here. */
function StandIn({ children }: { children: ReactNode }) {
  return <p className="lab-stand-in">{children}</p>;
}

export function LabClubhouse() {
  const [room, setRoom] = useState<Room | null>(null);
  // Coming in by the picks wall or the pinned ticket opens the Big Board with the ticket ready; each arrival is a fresh one.
  const [ticketOpen, setTicketOpen] = useState(false);
  const [visit, setVisit] = useState(0);
  // Every room opens at its top, and going back lands you at the room picture, not wherever the page had scrolled to.
  const enter = (next: Room, ticket = false) => { setRoom(next); setTicketOpen(ticket); setVisit((count) => count + 1); window.scrollTo({ top: 0 }); };
  const leave = () => { setRoom(null); window.scrollTo({ top: 0 }); };
  const [season, setSeason] = useState<Season>("regular");
  const [allIn, setAllIn] = useState(false);
  const [mail, setMail] = useState(true);
  return (
    <section aria-label="Clubhouse try-out" className="lab-clubhouse" data-room={room ?? "lobby"}>
      {room === null ? (
        <>
          <div className="lab-room-controls">
            <Chips label="Time of year" onChange={setSeason} options={[["regular", "Regular season"], ["bowls", "From Dec 7"]] as const} value={season} />
            <Chips label="Picks" onChange={(value) => setAllIn(value === "in")} options={[["owed", "A pick owed"], ["in", "All in"]] as const} value={allIn ? "in" : "owed"} />
            <Chips label="Chat" onChange={(value) => setMail(value === "new")} options={[["new", "New message"], ["none", "Nothing new"]] as const} value={mail ? "new" : "none"} />
          </div>
          <ClubRoom allIn={allIn} mail={mail} onEnter={enter} season={season} />
        </>
      ) : (
        <header className="lab-room-bar">
          <button className="lab-room-back" onClick={leave} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button>
          <h3>{ROOM_TITLE[room]}</h3>
        </header>
      )}
      {room === "board" ? <BigBoardRoom key={visit} onSurvivor={() => enter("survivor")} onTicket={setAllIn} startOpen={ticketOpen} survivorIn={allIn} /> : null}
      {room === "trophies" ? <TrophyRoom /> : null}
      {room === "survivor" ? <LabSurvivorTable /> : null}
      {room === "chat" ? <StandIn>The pool chat opens here, exactly as it works today.</StandIn> : null}
      {room === "bowl" ? <StandIn>The Bowl Pool opens here.</StandIn> : null}
      {room === "constitution" ? <Constitution /> : null}
      {room !== null ? <button className="lab-room-back is-foot" onClick={leave} type="button"><span aria-hidden="true">‹</span> Back to Clubhouse</button> : null}
      <RoomTicket onOpen={() => enter("board", true)} ticket={{
        places: [{ team: "PIT", line: "-2.5", label: "", note: "Sun 1:00", state: "in" }, { team: "IND", line: "+3.5", label: "", note: "Sun 4:25", state: "in" }, allIn ? { team: "KC", label: "Survivor", note: "Thu 8:15", state: "in", survivor: true } : { label: "Survivor", note: "Open", state: "off", survivor: true }],
        status: allIn ? { label: "All in", text: "Change until kickoff" } : null, action: allIn ? "VIEW" : "PICK", stub: allIn ? "ALL IN" : "1 LEFT",
      }} week="Week 10" />
    </section>
  );
}
