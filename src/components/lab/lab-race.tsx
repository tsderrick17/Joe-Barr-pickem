"use client";

import { useEffect, useRef, useState } from "react";
import { LAB_VIEWER } from "@/lib/lab-clubhouse.js";
import { LAB_RACE_FRAMES, LAB_RACE_LANES, LAB_RACE_MOMENTS, LAB_RACE_NOW, labRaceAt, labRaceHeadline, labRaceStepMs } from "@/lib/lab-race.js";

/**
 * Lab try-out: the season as a horse race. Ten thoroughbreds, a jockey in each player's silks on each, run a straight track in their
 * own lanes, Saratoga style: white rails, a furlong pole at every fifth of the way, a red and white pole at the finish.
 *  - A horse's place is its wins: the leader runs out front and the rest fall back by how many wins they are behind. Early gaps are
 *    stretched (one win is a length or two in week 1) and tighten as the season goes on. The leader covers most of the track across the
 *    18 weeks, then creeps up the long final stretch a playoff game day at a time. Nobody reaches the pole until the pool is decided:
 *    the moment no one else can even tie the leader, the leader runs it out.
 *  - A horse that can no longer tie the leader, even by winning every pick left, pulls up and stands. The same rule decides who is still
 *    eligible in the playoffs.
 *  - Still until tapped. "Run the race" winds every horse back to the gate and runs the season to where it is now, week by week and
 *    then game day by game day, slower through the playoffs. With reduced motion on, it just shows where they stand.
 * Sample players only; nothing here reads or writes the pool.
 */

/** Each lane's silks: the jacket, and the cap and sash. */
const SILKS = [["rgb(31 59 47)", "rgb(240 180 41)"], ["rgb(150 40 48)", "rgb(243 234 211)"], ["rgb(31 78 140)", "rgb(240 180 41)"], ["rgb(106 58 140)", "rgb(243 234 211)"],
  ["rgb(224 120 30)", "rgb(25 35 30)"], ["rgb(20 20 20)", "rgb(220 60 60)"], ["rgb(60 130 150)", "rgb(243 234 211)"], ["rgb(180 150 40)", "rgb(31 59 47)"],
  ["rgb(210 110 140)", "rgb(25 35 30)"], ["rgb(90 100 105)", "rgb(240 180 41)"]];
const COATS = [["rgb(112 62 32)", "rgb(76 40 20)"], ["rgb(150 90 48)", "rgb(100 58 30)"], ["rgb(52 36 28)", "rgb(32 22 18)"], ["rgb(128 76 40)", "rgb(86 50 26)"]];
const GATE = 0.04;

function Horse({ lane }: { lane: number }) {
  const [jacket, trim] = SILKS[lane % SILKS.length];
  const [coat, far] = COATS[lane % COATS.length];
  const limb = { fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const, strokeWidth: 2.7 };
  return (
    <svg aria-hidden="true" className="lab-horse-art" viewBox="0 0 64 40">
      <path d="M14 15C6 16 3 23 5 31C8 24 11 21 16 20Z" fill={far} />
      <g className="lab-pose is-stand" stroke={far} {...limb}><path d="M34 25L34.2 30.5L34.6 36.5M24 25L24.6 31L23 36.5" /></g>
      <g className="lab-pose is-a" stroke={far} {...limb}><path d="M34 25L42 29L47 35M24 25L17 30L11 29" /></g>
      <g className="lab-pose is-b" stroke={far} {...limb}><path d="M34 25L39 30L36 34M24 25L29 31L27 35" /></g>
      <ellipse cx="29" cy="19" fill={coat} rx="15.5" ry="6.8" />
      <path d="M38 14C42 9 46 6 50 5L58 9C59 10 59 12 57.5 12.5L52 11.5C49 13 46 17 42 22Z" fill={coat} />
      <path d="M50 5L51 1.8L53.4 5.6Z" fill={far} />
      <circle cx="55" cy="8.6" fill="rgb(20 14 10)" r="0.8" />
      <g className="lab-pose is-stand" stroke={coat} {...limb}><path d="M38 24L38.4 30L38.8 36.5M20 25L21.6 30.5L19 36.5" /></g>
      <g className="lab-pose is-a" stroke={coat} {...limb}><path d="M38 24L46 26L53 31M20 25L12 28L6 34" /></g>
      <g className="lab-pose is-b" stroke={coat} {...limb}><path d="M38 24L44 29L40 34M20 25L25 30L22 35" /></g>
      <rect fill={trim} height="7" rx="1" width="10" x="24" y="14.2" />
      <ellipse cx="30" cy="10" fill={jacket} rx="6.2" ry="3.9" transform="rotate(-10 30 10)" />
      <path d="M26 9.6C29 7.6 32 8 35 9.4" fill="none" stroke={trim} strokeWidth="1.3" />
      <path d="M33 11L42 14" fill="none" stroke={jacket} strokeLinecap="round" strokeWidth="2" />
      <circle cx="37.2" cy="7.2" fill="rgb(232 190 150)" r="1.8" />
      <path d="M35.2 6.6C35.4 4.6 39 4.4 39.2 6.8Z" fill={trim} />
    </svg>
  );
}

/** What is on the track: a horse per lane at a frame (0 is the gate), and how long each takes to get there. */
function useRace() {
  const [moment, setMoment] = useState(LAB_RACE_NOW);
  const [shown, setShown] = useState(LAB_RACE_NOW);
  const [stepMs, setStepMs] = useState(700);
  const [running, setRunning] = useState(false);
  const timers = useRef<number[]>([]);
  const stop = () => { timers.current.forEach((timer) => window.clearTimeout(timer)); timers.current = []; };
  useEffect(() => stop, []);

  const still = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Set where the pool is now: the horses glide there. */
  function setNow(frame: number) {
    stop();
    setRunning(false);
    setMoment(frame);
    setStepMs(still() ? 0 : 900);
    setShown(frame);
  }

  /** Wind every horse back to the gate, then run the season to where it is now. */
  function run() {
    stop();
    if (still()) { setRunning(false); setStepMs(0); setShown(moment); return; }
    setRunning(true);
    setStepMs(900);
    setShown(0);
    let at = 1100;
    for (let frame = 1; frame <= moment; frame++) {
      const ms = labRaceStepMs(LAB_RACE_FRAMES[frame - 1]);
      timers.current.push(window.setTimeout(() => { setStepMs(ms); setShown(frame); }, at));
      at += ms;
    }
    timers.current.push(window.setTimeout(() => setRunning(false), at));
  }

  return { moment, shown, stepMs, running, setNow, run };
}

export function LabRace() {
  const { moment, shown, stepMs, running, setNow, run } = useRace();
  const field = labRaceAt(shown || 1).horses;
  const headline = shown === 0 ? "Back at the gate" : running ? LAB_RACE_FRAMES[shown - 1].label : labRaceHeadline(shown);
  const decided = shown > 0 && LAB_RACE_FRAMES[shown - 1].decided;

  return (
    <section aria-label="The race" className="lab-race-room">
      <p aria-live="polite" className="lab-race-headline">{headline}</p>
      <div className="lab-race-controls">
        <button className="lab-race-run" disabled={running} onClick={run} type="button">{running ? "Running…" : "Run the race"}</button>
        <div aria-label="Where we are" className="lab-chips" role="group">
          {LAB_RACE_MOMENTS.map((item) => <button aria-pressed={moment === item.frame} key={item.label} onClick={() => setNow(item.frame)} type="button">{item.label}</button>)}
        </div>
      </div>
      <ol aria-label="The field" className={`lab-race-track${decided ? " is-decided" : ""}`} style={{ ["--step" as string]: `${stepMs}ms` }}>
        {field.map((horse) => {
          const x = shown === 0 ? GATE : horse.x;
          const state = horse.pulledUp && shown > 0 ? "pulled up" : "";
          return (
            <li aria-label={`${horse.name}, ${horse.wins} wins${state ? `, ${state}` : ""}`} className={`lab-lane${horse.name === LAB_VIEWER ? " is-you" : ""}${state ? " is-pulled" : ""}${horse.finished ? " is-won" : ""}`} key={horse.name}>
              <span className="lab-lane-name"><b>{horse.name}</b><i>{shown === 0 ? "" : state || `${horse.wins}`}</i></span>
              <span className="lab-lane-run">
                <span className={`lab-horse${running ? " is-running" : ""}`} style={{ ["--x" as string]: x }}><Horse lane={LAB_RACE_LANES.indexOf(horse.name)} /></span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
