"use client";

import { memo, type ChangeEvent } from "react";

export type SlateWeek = { id: string; display_name: string; status: "upcoming" | "active" | "complete"; period_type: "regular" | "playoff" };

type Props = {
  week: SlateWeek;
  availableWeeks: SlateWeek[];
  onChooseWeek: (event: ChangeEvent<HTMLSelectElement>) => void;
  actionOnlyActive: boolean;
  onToggleDisplay: () => void;
  survivorControlsEnabled: boolean;
  hasEarlyGame: boolean;
  /** The off-season: the how-to-pick instructions are not shown. */
  readOnly?: boolean;
};

/** The Slate's masthead: title, week picker, the All Games / Pool Action switch, and the how-to panel. */
function SlateHeader({ week, availableWeeks, onChooseWeek, actionOnlyActive, onToggleDisplay, survivorControlsEnabled, hasEarlyGame, readOnly = false }: Props) {
  return (
  <header className="-mx-4 border-y-4 border-(color:--themed-border-10) px-4 py-5 sm:-mx-5 sm:px-5 sm:py-6 md:-mx-10 md:px-10 md:py-3">
    <div className="slate-header-grid grid gap-5 md:gap-0">
      <div className="min-w-0 md:pr-7">
        <h1 className="whitespace-nowrap font-serif text-3xl font-bold sm:text-4xl">
          The Slate
        </h1>
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

        <div className="slate-view-switch-slot">
          <div className={`slate-view-switch slate-view-switch--header ${actionOnlyActive ? "is-action-only" : ""}`} aria-label="Slate display" role="group">
            <span className={!actionOnlyActive ? "is-active" : ""}>ALL GAMES</span>
            <button aria-checked={actionOnlyActive} aria-label={actionOnlyActive ? "Show all games" : "Show pool action"} onClick={onToggleDisplay} role="switch" type="button"><span /></button>
            <span className={actionOnlyActive ? "is-active" : ""}>POOL ACTION</span>
          </div>
        </div>
      </div>

      <aside className="border-t border-(color:--themed-border-12) pt-4 text-left text-xs leading-5 text-slate-700 md:col-span-2 md:self-stretch md:border-l md:border-t-0 md:pt-0">
        {readOnly ? null : <div className={`slate-action-instructions ${survivorControlsEnabled ? "has-survivor" : ""} mt-0 grid gap-2 border-y-2 border-(color:--themed-border-10) bg-(color:--themed-bg-16) px-3 py-2.5 text-[11px] leading-4 text-[#17354d] md:text-xs ${survivorControlsEnabled ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
          <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">PICK&apos;EM</strong>Click a team name to make your against-the-spread pick{week?.period_type === "playoff" ? " for every playoff game" : "s"}.</p>
          {survivorControlsEnabled ? <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">SURVIVOR</strong>Click a poker chip to choose one outright winner.</p> : null}
          <p><strong className="block text-[10px] tracking-[0.12em] text-[#00756e]">SUBMIT</strong>Review your choices, then click <span className="font-black">SUBMIT</span> to save the picks currently shown.</p>
        </div>
        }
        <div className="slate-how-to-grid mt-2 grid gap-3 border-t border-(color:--themed-border-12) pt-3 md:gap-0">
          <div className="md:pl-4">
            <p>Lines lock at 8 AM on gameday, unless otherwise noted.</p>
            <p className="mt-1"><span className="official-line-color font-semibold">Teal lines</span> are official and will not change.</p>
          </div>
          <div className="border-t border-(color:--themed-border-12) pt-3 md:border-l md:border-t-0 md:pl-7 md:pt-0">
            <p>Favorites left; home team ALL CAPS.</p>
            {readOnly ? null : <p className="mt-1">Changes allowed until kickoff time.</p>}
          </div>
        </div>
        {hasEarlyGame ? (
          <p className="mt-3 border-t border-(color:--themed-border-12) pt-3 font-semibold md:pl-4">
            EARLY GAME: spreads post at 6 PM the night before.
          </p>
        ) : null}
      </aside>
    </div>

  </header>
  );
}

export default memo(SlateHeader);
