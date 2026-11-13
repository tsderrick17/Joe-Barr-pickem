"use client";

import Image from "next/image";
import { useState } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";
import { LAB_MOMENTS, LAB_VIEWER, labKickedOff, labLeaderboard, labStandard, labSurvivorBoard } from "@/lib/lab-clubhouse.js";
import { LAB_SLATE, LAB_TEAM_NAMES, labLineFor, labSurvivorAt, labSurvivorChampion, LAB_SURVIVOR_LAST_WEEK } from "@/lib/lab-samples.js";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

/**
 * The tote board family, the owner's pick of the Pad skins, as the clubhouse's two main pieces. Sample players only.
 *  - The Big Board: everyone's picks in one place, as the Pick'em Pad is today (wins, player, Pick 1, Pick 2, no place), with
 *    Survivor's chips in their own column. The standings fold into the same board: one tap turns it to the season table.
 *  - The Window: every pick a player makes, in one place: two against the spread and the Survivor team, one ticket, one Submit.
 *    Survivor stays at the Window for as long as the Survivor pool is going, read only for a player who is out.
 * A pick that is made but not shown yet is dark lamps and a green IN; another player's pick stays covered until its game kicks off.
 */

const teamName = (team: string) => LAB_TEAM_NAMES[team as keyof typeof LAB_TEAM_NAMES];

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: ReadonlyArray<readonly [T, string]>; value: T; onChange: (value: T) => void }) {
  return (
    <div aria-label={label} className="lab-chips" role="group">
      {options.map(([key, text]) => <button aria-pressed={value === key} key={key} onClick={() => onChange(key)} type="button">{text}</button>)}
    </div>
  );
}

/** A pick that is in but not shown yet: it reads as made, never as empty, and never says which team. */
function HiddenPick() {
  return (
    <span aria-label="Pick in, hidden until kickoff" className="lab-tote-cover" role="img">
      <i aria-hidden="true" /><i aria-hidden="true" /><i aria-hidden="true" /><b aria-hidden="true">IN</b>
    </span>
  );
}

/* ---------------------------------------------------------------- The Big Board ---------------------------------------------------------------- */

function WeekFace({ moment }: { moment: string }) {
  const rows = labLeaderboard({ round: "regular", moment });
  return (
    <table>
      <colgroup><col className="lab-tote-col-wins" /><col /><col className="lab-tote-col-pick" /><col className="lab-tote-col-pick" /><col className="lab-tote-col-surv" /></colgroup>
      <thead><tr><th scope="col">W</th><th scope="col">PLAYER</th><th scope="col">PICK 1</th><th scope="col">PICK 2</th><th scope="col"><span aria-hidden="true">SURV</span><span className="sr-only">Survivor</span></th></tr></thead>
      <tbody>
        {rows.map((row) => {
          const standard = labStandard(row.name, { round: "regular", moment });
          const survivor = standard.survivor;
          return (
            <tr className={row.name === LAB_VIEWER ? "is-you" : ""} key={row.name}>
              <td className="lab-tote-wins">{row.wins}</td>
              <th className="lab-tote-name" scope="row">{row.name.toUpperCase()}</th>
              {standard.slats.map((slat) => (
                <td className="lab-tote-pick" key={slat.gameId}>
                  {slat.hidden ? <HiddenPick /> : (
                    <span className="lab-tote-slip">
                      <b>{slat.team}</b>
                      <small>{slat.line}</small>
                      <span aria-label={slat.result === "W" ? "win" : slat.result === "L" ? "loss" : "not final"} className={`lab-tote-mark ${slat.result ? `is-${slat.result.toLowerCase()}` : ""}`} role="img">{slat.result ?? ""}</span>
                    </span>
                  )}
                </td>
              ))}
              <td className="lab-tote-surv">
                {survivor === null ? <span className="lab-tote-out">OUT</span>
                  : survivor.hidden || !survivor.team ? <span aria-label="Survivor pick in, hidden until kickoff" className="lab-tote-chip-back" role="img" />
                  : (
                    <span className="lab-tote-chip">
                      <SurvivorPokerChip abbreviation={survivor.team} size="summary" teamName={teamName(survivor.team)} unavailable={survivor.result === "L"} />
                      {survivor.result ? <span aria-label={survivor.result === "W" ? "Survivor win" : "Survivor loss"} className={`lab-tote-mark is-${survivor.result.toLowerCase()}`} role="img">{survivor.result}</span> : null}
                    </span>
                  )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** The standings, folded into the board: place (level players share it), player, wins, and games back of the leader. */
function SeasonFace({ moment }: { moment: string }) {
  const rows = labLeaderboard({ round: "regular", moment });
  return (
    <table>
      <colgroup><col className="lab-tote-col-pos" /><col /><col className="lab-tote-col-total" /><col className="lab-tote-col-total" /></colgroup>
      <thead><tr><th scope="col">POS</th><th scope="col">PLAYER</th><th className="is-centre" scope="col">WINS</th><th className="is-centre" scope="col">BACK</th></tr></thead>
      <tbody>
        {rows.map((row) => (
          <tr className={row.name === LAB_VIEWER ? "is-you" : ""} key={row.name}>
            <td className="lab-tote-pos">{row.tied ? "T" : ""}{row.place}</td>
            <th className="lab-tote-name" scope="row">{row.name.toUpperCase()}</th>
            <td className="lab-tote-wins">{row.wins}</td>
            <td className="lab-tote-back">{row.back === 0 ? "—" : row.back}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** The Big Board. `moment` is the Lab's sample moment of the week; a player only ever sees the real one. */
export function ToteBigBoard({ moment }: { moment: string }) {
  const [face, setFace] = useState<"week" | "season">("week");
  return (
    <div className="lab-tote">
      <header><h3>{face === "week" ? "PICK’EM" : "STANDINGS"}</h3><span>{face === "week" ? "WEEK 10 · OFFICIAL" : "THROUGH WEEK 10"}</span></header>
      <Chips label="Show" onChange={setFace} options={[["week", "This week’s picks"], ["season", "Season standings"]] as const} value={face} />
      {face === "week" ? <WeekFace moment={moment} /> : <SeasonFace moment={moment} />}
    </div>
  );
}

/** The Big Board with the Lab's moment chips above it. */
export function BigBoardRoom() {
  const [moment, setMoment] = useState("before");
  return (
    <div className="lab-room-stack">
      <Chips label="Moment" onChange={setMoment} options={LAB_MOMENTS.map((item) => [item.id, item.label] as const)} value={moment} />
      <ToteBigBoard moment={moment} />
    </div>
  );
}

/* ---------------------------------------------------------------- The Window ---------------------------------------------------------------- */

type WindowScene = "picking" | "gameday" | "out" | "over";
const WINDOW_SCENES: ReadonlyArray<readonly [WindowScene, string]> = [["picking", "Picking"], ["gameday", "Game day"], ["out", "Out of Survivor"], ["over", "Survivor decided"]];

function Logo({ team }: { team: string }) {
  return <Image alt="" className="lab-room-logo" height={24} src={`/team-logos/${team}.png`} style={{ transform: `scale(${teamLogoScale(team)})` }} width={24} />;
}

/** The Window: two picks against the spread and the Survivor team, one ticket, one Submit. Any pick can change until its game kicks off. */
export function WindowRoom() {
  const [scene, setScene] = useState<WindowScene>("picking");
  const [picks, setPicks] = useState<string[]>(["PIT", "LAR"]);
  const [survivorPick, setSurvivorPick] = useState<string | null>("DEN");
  const [sent, setSent] = useState<string | null>(null);
  const moment = scene === "gameday" ? "gameday" : "before";
  // "Out of Survivor" is seen as Hank, who lost in week 3; the Pick'em side is the same for everyone.
  const survivor = labSurvivorBoard({ moment, viewer: scene === "out" ? "Hank" : LAB_VIEWER });
  const champion = scene === "over" ? labSurvivorChampion(LAB_SURVIVOR_LAST_WEEK) : null;
  const alive = labSurvivorAt(9).filter((seat) => !seat.out).length;
  const pickingSurvivor = !champion && !survivor.out;
  const chip = pickingSurvivor ? survivorPick : null;

  const choose = (team: string, gameId: string) => {
    if (labKickedOff(LAB_SLATE, gameId, moment)) return;
    const game = LAB_SLATE.find((item) => item.id === gameId)!;
    const other = team === game.home ? game.away : game.home;
    if (picks.includes(team)) setPicks(picks.filter((pick) => pick !== team));
    else if (picks.length < 2 || picks.includes(other)) setPicks([...picks.filter((pick) => pick !== other), team]);
  };

  // The ticket, in kickoff order: each pick against the spread, then the Survivor team while the player is still in.
  const ordered = LAB_SLATE.flatMap((game) => picks.filter((team) => team === game.away || team === game.home).map((team) => ({ team, line: labLineFor(game, team) })));
  const ticket = [
    { label: "Pick 1", value: ordered[0] ? `${ordered[0].team} ${ordered[0].line}` : null },
    { label: "Pick 2", value: ordered[1] ? `${ordered[1].team} ${ordered[1].line}` : null },
    ...(pickingSurvivor ? [{ label: "Survivor", value: chip }] : []),
  ];
  const made = ticket.filter((line) => line.value).length;
  const signature = ticket.map((line) => line.value ?? "").join("|");
  const submitted = sent === signature;

  return (
    <div className="lab-room-stack">
      <Chips label="Moment" onChange={setScene} options={WINDOW_SCENES} value={scene} />
      <div className="lab-bigboard is-tote trace-gilt lab-window">
        <header><h3>WEEK 10</h3><span>{made} OF {ticket.length} PICKED</span></header>

        <section aria-label="Pick’em" className="lab-window-part">
          <h4>PICK’EM <small>pick 2 against the spread</small></h4>
          <ol>
            {LAB_SLATE.map((game) => {
              const locked = labKickedOff(LAB_SLATE, game.id, moment);
              const cell = (team: string) => {
                const picked = picks.includes(team);
                return (
                  <button aria-label={`${teamName(team)} ${labLineFor(game, team)}`} aria-pressed={picked} className={`lab-board-cell ${picked ? "is-picked" : ""} ${locked ? "is-locked" : ""}`} disabled={locked} onClick={() => choose(team, game.id)} type="button">
                    <span className="lab-board-team"><Logo team={team} />{team}</span>
                    <span className="lab-board-line">{labLineFor(game, team)}</span>
                    {locked ? <span aria-label="Kicked off" className="lab-board-lock" role="img">🔒</span> : null}
                    <span aria-hidden="true" className="lab-board-trace" />
                  </button>
                );
              };
              return (
                <li key={game.id}>
                  <span className="lab-board-time">{game.kickoff.toUpperCase()}{locked ? " · KICKED OFF" : ""}</span>
                  {cell(game.away)}
                  <span aria-hidden="true" className="lab-board-at">@</span>
                  {cell(game.home)}
                </li>
              );
            })}
          </ol>
        </section>

        {champion ? null : (
          <section aria-label="Survivor" className="lab-window-part">
            <h4>SURVIVOR <small>{survivor.out ? `${alive} of 10 still in` : "one team, straight up"}</small></h4>
            {survivor.out ? (
              <p className="lab-window-out">You’re out of Survivor (lost in week {survivor.outWeek}). The pool goes on: follow it at the Survivor table.</p>
            ) : (
              <ul className="lab-window-rack">
                {survivor.teams.map((entry) => (
                  <li key={entry.team}>
                    <button aria-label={teamName(entry.team)} aria-pressed={chip === entry.team} className="lab-window-chip" disabled={!entry.free} onClick={() => setSurvivorPick(chip === entry.team ? null : entry.team)} type="button">
                      <SurvivorPokerChip abbreviation={entry.team} selected={chip === entry.team} size="summary" teamName={teamName(entry.team)} unavailable={Boolean(entry.usedWeek)} />
                      <small>{entry.usedWeek ? `USED WK ${entry.usedWeek}` : entry.locked ? "KICKED OFF" : entry.team}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section aria-label="Your ticket" className="lab-window-ticket">
          <dl>
            {ticket.map((line) => <div key={line.label}><dt>{line.label}</dt><dd>{line.value ?? "—"}</dd></div>)}
          </dl>
          <button className="lab-window-submit" disabled={submitted || made === 0} onClick={() => setSent(signature)} type="button">
            {submitted ? "Submitted ✓" : sent ? "Submit changes" : "Submit picks"}
          </button>
          <p className="lab-board-note">{submitted ? "Change any pick until its game kicks off." : champion ? `Survivor is decided: ${champion} won it.` : pickingSurvivor ? "Tap a team or a chip to pick it; tap again to take it back." : "Tap a team to pick it; tap again to take it back."}</p>
        </section>
      </div>
    </div>
  );
}
