"use client";

import Image from "next/image";
import { memo, useRef } from "react";
import Collapse, { useBlindRows } from "@/components/collapse";
import PlayerTrophyName from "@/components/player-trophy-name";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

type Pick = { label: string | null; abbreviation?: string | null; resultMark: string; isHidden?: boolean };
export type SurvivorTableData = {
  viewerPlayerId: string;
  week: string;
  showSurvivorStandings: boolean;
  hideSurvivorEliminatedRows: boolean;
  survivorAvailable: boolean;
  survivorNotice: string | null;
  survivorRows: {
    id: string;
    playerId: string;
    firstName: string;
    trophies?: string[];
    status: "active" | "eliminated" | "complete";
    picks: Array<Pick | null>;
  }[];
};

function MiniLogo({ abbreviation, muted, resultMark }: { abbreviation: string; muted?: boolean; resultMark?: string }) {
  return <span title={`${abbreviation}${resultMark ? ` ${resultMark}` : ""}`} className={`relative inline-flex h-7 w-7 items-center justify-center ${muted ? "grayscale opacity-60" : ""}`}><Image alt={abbreviation} className="h-full w-full object-contain" height={28} loading="eager" style={{ transform: `scale(${teamLogoScale(abbreviation)})` }} src={`/team-logos/${abbreviation}.png`} width={28} />{resultMark === "W" ? <span aria-label="Survivor win" className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-green-700 text-[10px] font-black leading-none text-white">✓</span> : null}{resultMark === "L" ? <span aria-label="Survivor loss" className="absolute inset-0 flex items-center justify-center text-4xl font-semibold leading-none text-red-700/80 drop-shadow-[0_0_1px_white]">×</span> : null}</span>;
}

type SurvivorTableRow = SurvivorTableData["survivorRows"][number];

/** One player's row. It redraws only when its own data changes, so toggling the table does not rebuild every logo. */
const SurvivorRow = memo(function SurvivorRow({ row, rowIndex, isViewer }: { row: SurvivorTableRow; rowIndex: number; isViewer: boolean }) {
  return (
      <div data-blind-row={row.status === "eliminated" ? "" : undefined} className={`survivor-standings-row grid items-center border-b border-(color:--themed-border-11) last:border-b-0 ${rowIndex % 2 ? "is-alt" : ""} ${isViewer ? "viewer-row" : ""}`}>
        <span className={`survivor-sticky-status text-center text-[10px] font-black ${row.status === "active" ? "text-green-800" : "text-red-700"}`}>{row.status === "active" ? "IN" : "OUT"}</span>
        <span className={`survivor-sticky-name truncate px-2 py-[0.4rem] font-serif text-sm font-bold ${row.status === "active" ? "" : "text-slate-500"}`}><PlayerTrophyName name={row.firstName} nameClassName={row.status === "active" ? undefined : "line-through"} showTrophy={row.trophies?.some((title) => title.includes("Survivor Champion"))} titles={row.trophies} /></span>
        {Array.from({ length: 18 }, (_, index) => {
          const pick = row.picks[index];
          return <span className="flex h-[2.3rem] items-center justify-center" key={index}>{pick?.abbreviation ? <MiniLogo abbreviation={pick.abbreviation} muted={row.status !== "active" && pick.resultMark !== "L"} resultMark={pick.resultMark} /> : pick?.isHidden ? <span aria-label="Selection submitted and hidden until kickoff" className="text-xs" title="Selection submitted — revealed at kickoff">🔒</span> : <span className="text-slate-400">·</span>}</span>;
        })}
      </div>
  );
});

/** The Survivor Table: a row per player, one logo per week, with an IN/OUT status column. */
export default function SurvivorTable({ data, savingDisplay, displayLocked = false, setSurvivorDisplay, setEliminatedRowsHidden }: {
  data: SurvivorTableData;
  savingDisplay: boolean;
  /** The off-season: the table is shown whole and its hide and "− OUT" buttons are gone. */
  displayLocked?: boolean;
  setSurvivorDisplay: (show: boolean) => void | Promise<void>;
  setEliminatedRowsHidden: (pool: "pickem" | "survivor", hidden: boolean) => void | Promise<void>;
}) {
  const gridRef = useRef<HTMLDivElement>(null);
  const eliminatedRowsHidden = useBlindRows(data.hideSurvivorEliminatedRows, gridRef);
  return (
<section className={`pickem-ledger survivor-ledger py-6 sm:py-7 ${data.showSurvivorStandings ? "" : "is-minimized"}`}>
    <div className="pickem-ledger-masthead survivor-ledger-masthead"><div className="flex items-center gap-2"><h2>Survivor Table</h2>{displayLocked ? null : <button aria-expanded={data.showSurvivorStandings} aria-label={data.showSurvivorStandings ? "Hide Survivor Table" : "Show Survivor Table"} className="survivor-title-toggle" disabled={savingDisplay} onClick={() => void setSurvivorDisplay(!data.showSurvivorStandings)} title={data.showSurvivorStandings ? "Hide Survivor Table" : "Show Survivor Table"} type="button">{data.showSurvivorStandings ? "−" : "+"}</button>}{!displayLocked && data.showSurvivorStandings && data.survivorRows.some((row) => row.status === "eliminated") ? <button aria-label={data.hideSurvivorEliminatedRows ? "Show eliminated Survivor players" : "Hide eliminated Survivor players"} className="survivor-title-toggle survivor-elimination-toggle" disabled={savingDisplay} onClick={() => void setEliminatedRowsHidden("survivor", !data.hideSurvivorEliminatedRows)} title={data.hideSurvivorEliminatedRows ? "Show eliminated players" : "Hide eliminated players"} type="button">{data.hideSurvivorEliminatedRows ? "+ OUT" : "− OUT"}</button> : null}</div><p className="pickem-ledger-period">{data.week.toUpperCase()}</p></div>

    <Collapse open={data.showSurvivorStandings}>{data.survivorAvailable ? (
      <div className="survivor-standings-scroll overflow-x-auto border-y-2 border-(color:--themed-border-10)">
          <div className="survivor-standings-grid min-w-[47.5rem]" ref={gridRef}>
          <div className="survivor-standings-header grid border-b-2 border-(color:--themed-border-10) text-center text-[10px] font-black tracking-wide text-slate-600">
            <span aria-hidden="true" className="survivor-sticky-status py-2" />
            <span className="survivor-sticky-name px-2 py-2 text-left">PLAYER</span>
            {Array.from({ length: 18 }, (_, index) => <span className="py-2" key={index}>{index + 1}</span>)}
          </div>
          {data.survivorRows.filter((row) => !eliminatedRowsHidden || row.status !== "eliminated").map((row, rowIndex) => {
            const isViewer = row.playerId === data.viewerPlayerId;

            return (
            <SurvivorRow isViewer={isViewer} key={row.id} row={row} rowIndex={rowIndex} />
            );
          })}
        </div>
      </div>
    ) : (
      <div className="border-2 border-(color:--themed-border-17) bg-(color:--themed-bg-21) p-4 text-(color:--themed-text-23)">
        <p className="font-bold">
          {data.survivorNotice ??
            "Survivor is temporarily unavailable. ATS standings remain current."}
        </p>
      </div>
    )}</Collapse>
  </section>
  );
}
