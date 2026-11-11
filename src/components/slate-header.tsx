"use client";

import { memo, useId, useState, type ChangeEvent } from "react";
import HowItWorksToggle from "@/components/how-it-works-toggle";

export type SlateWeek = { id: string; display_name: string; status: "upcoming" | "active" | "complete"; period_type: "regular" | "playoff" };

type Props = {
  week: SlateWeek;
  availableWeeks: SlateWeek[];
  onChooseWeek: (event: ChangeEvent<HTMLSelectElement>) => void;
  actionOnlyActive: boolean;
  onToggleDisplay: () => void;
  survivorHelp: boolean;
  hasEarlyGame: boolean;
  /** How the instructions start (src/lib/how-it-works.js); open until the Slate says otherwise. */
  howItWorks?: "open" | "folded" | null;
  /** The week's Pick'em picks (2 in a regular week). */
  pickLimit?: number;
  /** The off-season: the how-to-pick instructions are not shown. */
  readOnly?: boolean;
};

/** The Slate's masthead: title, week picker, the All Games / Pool Action switch, and the how-to panel. */
function SlateHeader({ week, availableWeeks, onChooseWeek, actionOnlyActive, onToggleDisplay, survivorHelp, hasEarlyGame, howItWorks = null, pickLimit = 2, readOnly = false }: Props) {
  const foldId = useId();
  // A tap opens or folds the instructions for this week, this visit; a new week starts the way the server says.
  const [toggled, setToggled] = useState<{ weekId: string; open: boolean } | null>(null);
  const folding = !readOnly;
  const open = toggled?.weekId === week.id ? toggled.open : howItWorks !== "folded";
  const playoff = week?.period_type === "playoff";
  const heading = "block text-[10px] tracking-[0.12em]";
  // The notes, in two groups of three: how the lines work, and how the picks work.
  const notes = (
    <div className="slate-how-to-grid mt-2 grid gap-3 border-t pt-3 md:gap-0">
      <div className="md:pl-4">
        <strong className={heading}>THE LINES</strong>
        <p className="mt-1">Lines lock at 8 AM on gameday, unless otherwise noted.</p>
        <p className="mt-1"><span className="official-line-color font-semibold">Teal lines</span> are official and will not change.</p>
        <p className="mt-1">Favorites left; home team ALL CAPS.</p>
      </div>
      <div className="border-t pt-3 md:border-l md:border-t-0 md:pl-7 md:pt-0">
        <strong className={heading}>YOUR PICKS</strong>
        {readOnly ? null : <p className="mt-1">Changes allowed until kickoff time.</p>}
        {readOnly ? null : <p className="mt-1">Click <span className="font-black">SUBMIT</span> to save your picks.</p>}
        <p className="mt-1">A push counts as a loss.</p>
      </div>
    </div>
  );
  return (
  <header className="-mx-4 border-y-4 border-(color:--themed-border-10) px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10 md:py-3">
    <div className="slate-header-grid grid gap-5 md:gap-0">
      <div className="min-w-0 md:pr-7">
        <h1 className="whitespace-nowrap font-serif text-3xl font-bold sm:text-4xl">
          The Slate
        </h1>
        <div className="slate-week-row">
          <div className="slate-week-picker">
          <label
            className="mt-4 block text-xs font-bold tracking-[0.16em] text-slate-600"
            htmlFor="week-selector"
          >
            VIEW WEEK
          </label>

          <select
            className="mt-1 border border-(color:--themed-border-10) bg-(color:--themed-bg-26) px-3 py-1.5 text-sm font-semibold text-(color:--themed-text-18)"
            id="week-selector"
            onChange={onChooseWeek}
            value={week.id}
          >
            {availableWeeks.map((period) => (
              <option key={period.id} value={period.id}>
                {period.display_name}
                {period.status === "complete" ? " — Final" : ""}
            </option>
          ))}
          </select>
          </div>

          <div className="slate-view-switch-slot">
            <div aria-label="Slate display" className="slate-view-switch" role="group">
              <button aria-pressed={!actionOnlyActive} className={!actionOnlyActive ? "is-active" : ""} onClick={onToggleDisplay} type="button">All<br />games</button>
              <button aria-pressed={actionOnlyActive} className={actionOnlyActive ? "is-active" : ""} onClick={onToggleDisplay} type="button">Pool<br />action</button>
            </div>
          </div>
        </div>
      </div>

      <aside className="slate-instructions border-t border-(color:--themed-border-12) pt-4 text-left text-xs leading-5 md:col-span-2 md:self-stretch md:border-l md:border-t-0 md:pt-0">
        {readOnly ? null : <div className={`slate-action-instructions ${survivorHelp ? "has-survivor" : ""} mt-0 grid gap-2 border-y-2 px-3 py-2.5 text-[11px] leading-4 md:text-xs ${survivorHelp ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          {/* The short rules for each game, always in view. */}
          <p><strong className={heading}>PICK&apos;EM</strong>{playoff ? "Click a team name to make your against-the-spread pick for every playoff game. You stay in while you can still tie the leader." : `Click a team name to make your ${pickLimit} against-the-spread picks each week.`}</p>
          {survivorHelp ? <p className="slate-action-survivor"><strong className={heading}>SURVIVOR</strong>Click a poker chip to choose one team to win each week. Each team can be used once. A loss, a tie or a missed week ends your run.</p> : null}
        </div>
        }
        {folding ? <>
          <HowItWorksToggle className="slate-how-toggle" controls={foldId} onToggle={() => setToggled({ weekId: week.id, open: !open })} open={open} />
          <div className={`how-fold ${open ? "is-open" : ""}`} id={foldId} inert={!open}>
            <div className="how-fold-inner">{notes}</div>
          </div>
        </> : notes}
        {hasEarlyGame ? (
          <p className={`${folding && !open ? "" : "mt-3 "}${folding ? "transition-[margin] duration-300 motion-reduce:transition-none " : ""}border-t border-(color:--themed-border-12) pt-3 font-semibold md:pl-4`}>
            EARLY GAME THIS WEEK: spread locks 6pm prior evening
          </p>
        ) : null}
      </aside>
    </div>

  </header>
  );
}

export default memo(SlateHeader);
