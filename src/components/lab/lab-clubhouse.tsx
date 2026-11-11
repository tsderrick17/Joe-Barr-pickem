"use client";

import Image from "next/image";
import { useState } from "react";
import { LAB_SLATE, LAB_STANDINGS, labLineFor } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * Lab try-out: the pages as rooms of one clubhouse, each keeping its own character. Only the sign and the first few rows of each room,
 * with the sample league, to judge the feel before any real page changes. Walk between rooms with the doors along the top.
 *  - Standings: the clubhouse leaderboard, hand-set number plates on a green board.
 *  - The Slate: the big board at a sportsbook, lit lines on a black board.
 *  - Trophy Room: a lit case of brass plaques.
 *  - Bowl Pool: the game-day program.
 */

type Room = "standings" | "slate" | "trophies" | "bowl";
const ROOMS: Array<{ id: Room; label: string }> = [
  { id: "standings", label: "Standings" },
  { id: "slate", label: "The Slate" },
  { id: "trophies", label: "Trophy Room" },
  { id: "bowl", label: "Bowl Pool" },
];

const CHAMPIONS = [
  { season: "2025", pickem: "Walt", survivor: "Dottie", bowl: "Rosie" },
  { season: "2024", pickem: "Earl", survivor: "Walt", bowl: "June" },
  { season: "2023", pickem: "Walt", survivor: "Lou", bowl: "Earl" },
];

function Logo({ team }: { team: string }) {
  return <Image alt="" className="lab-room-logo" height={24} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={24} />;
}

export function LabClubhouse() {
  const [room, setRoom] = useState<Room>("standings");
  return (
    <section aria-label="Clubhouse try-out" className="lab-clubhouse" data-room={room}>
      <nav aria-label="Clubhouse rooms" className="lab-doors">
        {ROOMS.map((item) => <button aria-pressed={room === item.id} key={item.id} onClick={() => setRoom(item.id)} type="button"><span aria-hidden="true" className="lab-door-knob" />{item.label}</button>)}
      </nav>

      {room === "standings" ? <div className="lab-leaderboard">
        <header><p>LEAD PIPE LOCKS</p><h3>LEADERS</h3><span>WEEK 9</span></header>
        <ol>
          {LAB_STANDINGS.slice(0, 6).map((row, index) => <li key={row.name}>
            <span className="lab-plate is-rank">{index + 1}</span>
            <span className="lab-plate is-name">{row.name.toUpperCase()}</span>
            <span className="lab-plate is-wins">{row.wins}</span>
            <span className="lab-plate is-back">{index === 0 ? "—" : row.wins - LAB_STANDINGS[0].wins}</span>
          </li>)}
        </ol>
        <footer><span>WINS</span><span>BACK</span></footer>
      </div> : null}

      {room === "slate" ? <div className="lab-bigboard">
        <header><h3>THE BOARD</h3><span>WEEK 5 · LINES LOCK 8:00 AM</span></header>
        <ol>
          {LAB_SLATE.map((game) => <li key={game.id}>
            <span className="lab-board-time">{game.kickoff.toUpperCase()}</span>
            <span className="lab-board-team"><Logo team={game.away} />{game.away}</span>
            <span className="lab-board-line">{labLineFor(game, game.away)}</span>
            <span className="lab-board-at">@</span>
            <span className="lab-board-team"><Logo team={game.home} />{game.home}</span>
            <span className="lab-board-line">{labLineFor(game, game.home)}</span>
          </li>)}
        </ol>
      </div> : null}

      {room === "trophies" ? <div className="lab-case">
        <header><h3>Trophy Room</h3><p>Every champion, kept under glass.</p></header>
        <div className="lab-case-shelf">
          {CHAMPIONS.map((year) => <article className="lab-plaque" key={year.season}>
            <p className="lab-plaque-season">{year.season}</p>
            <dl>
              <div><dt>Pick&apos;em</dt><dd>{year.pickem}</dd></div>
              <div><dt>Survivor</dt><dd>{year.survivor}</dd></div>
              <div><dt>Bowl Pool</dt><dd>{year.bowl}</dd></div>
            </dl>
          </article>)}
        </div>
      </div> : null}

      {room === "bowl" ? <div className="lab-program">
        <header>
          <p>OFFICIAL PROGRAM</p>
          <h3>The Bowl Pool</h3>
          <span>2026–27 · Every bowl, through the National Championship</span>
        </header>
        <ol>
          <li><span>Dec 19</span><strong>Cure Bowl</strong><em>Orlando</em></li>
          <li><span>Dec 20</span><strong>Las Vegas Bowl</strong><em>Las Vegas</em></li>
          <li><span>Dec 26</span><strong>Holiday Bowl</strong><em>San Diego</em></li>
          <li><span>Jan 1</span><strong>Rose Bowl</strong><em>Pasadena</em></li>
        </ol>
      </div> : null}
    </section>
  );
}
