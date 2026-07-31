"use client";

import { useState } from "react";
import SurvivorPokerChip from "@/components/survivor-poker-chip";

export type SlateGameRowData = {
  id: string;
  kickoffAt: string;
  lineLockAt: string;
  isInternational: boolean;
  status: "scheduled" | "live" | "final" | "postponed" | "cancelled";
  awayTeam: string;
  homeTeam: string;
  awayTeamAbbreviation: string;
  homeTeamAbbreviation: string;
  awayTeamId: string;
  homeTeamId: string;
  favoriteTeamId: string | null;
  officialSpread: number | null;
  preliminarySpread: number | null;
  awayScore: number | null;
  homeScore: number | null;
  awayResult: "win" | "loss" | null;
  homeResult: "win" | "loss" | null;
  awayPickers: string[];
  homePickers: string[];
};

function easternTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function easternShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "numeric", day: "numeric" }).format(new Date(value));
}

function easternLockLabel(value: string) {
  const date = easternShortDate(value);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" }).format(new Date(value));
  return `${date} · ${time.replace(":00", "")}`;
}

function spreadLabel(spread: number | null) {
  if (spread === null) return null;
  if (spread === 0) return "PK";
  return `-${Number.isInteger(spread) ? spread : spread.toFixed(1)}`;
}

function ResultMark({ result }: { result: "win" | "loss" | null }) {
  if (!result) return null;
  return <strong className={`relative -top-0.5 inline-block shrink-0 -rotate-[7deg] ${result === "win" ? "text-green-700" : "text-red-700"}`}>{result === "win" ? "W" : "L"}</strong>;
}

type Props = {
  game: SlateGameRowData;
  alternate: boolean;
  hasStarted: boolean;
  selectedTeamId?: string | null;
  selectionFeedback?: { teamId: string; type: "sweep"; token: number } | null;
  allowSelection?: boolean;
  onChoose?: (gameId: string, teamId: string) => void;
  survivor?: {
    enabled: boolean;
    selectedTeamId: string | null;
    savedTeamId: string | null;
    usedTeamIds: string[];
    onChoose: (gameId: string, teamId: string) => void;
  };
};

export default function SlateGameRow({ game, alternate, hasStarted, selectedTeamId, selectionFeedback = null, allowSelection = false, onChoose, survivor }: Props) {
  const [chipReplay, setChipReplay] = useState<Record<string, number>>({});
  const favoriteIsHome = game.favoriteTeamId === game.homeTeamId;
  const left = favoriteIsHome
    ? { name: game.homeTeam, abbreviation: game.homeTeamAbbreviation, id: game.homeTeamId, result: game.homeResult, score: game.homeScore, pickers: game.homePickers, home: true }
    : { name: game.awayTeam, abbreviation: game.awayTeamAbbreviation, id: game.awayTeamId, result: game.awayResult, score: game.awayScore, pickers: game.awayPickers, home: false };
  const right = favoriteIsHome
    ? { name: game.awayTeam, abbreviation: game.awayTeamAbbreviation, id: game.awayTeamId, result: game.awayResult, score: game.awayScore, pickers: game.awayPickers, home: false }
    : { name: game.homeTeam, abbreviation: game.homeTeamAbbreviation, id: game.homeTeamId, result: game.homeResult, score: game.homeScore, pickers: game.homePickers, home: true };
  const isFinal = game.status === "final";
  // Kickoff, not a delayed provider status, is the fair public-receipt line.
  // The card becomes live at that moment and remains a fixed audit record after final.
  const isLive = hasStarted && !isFinal && game.status !== "postponed" && game.status !== "cancelled";
  const lockedSpread = game.officialSpread !== null;
  const showSpecialLockNote = game.isInternational && !lockedSpread;
  const hasPublishedPick = left.pickers.length > 0 || right.pickers.length > 0;
  const compactFinal = isFinal && !hasPublishedPick;

  const teamCell = (team: typeof left, align: "left" | "right") => {
    const selected = selectedTeamId === team.id;
    const label = team.home ? team.name.toUpperCase() : team.name;
    const feedbackType = selected && selectionFeedback?.teamId === team.id ? selectionFeedback.type : null;
    const className = `${align === "right" ? "text-right" : "text-left"} min-w-0 text-[11px] font-bold leading-[1.12] tracking-tight min-[380px]:text-[12px] sm:text-[15px] ${allowSelection ? "block w-full" : "block"} ${selected ? "slate-team-selection" : allowSelection ? "hover:underline" : ""}`;
    const content = <>
      <span className="block min-w-0 break-normal [hyphens:none]"><span className={`slate-team-label ${selected ? `slate-team-label--selected slate-team-label--from-${align}` : ""} ${feedbackType === "sweep" ? "slate-team-label--new" : ""}`}><span className="slate-team-name-full">{label}</span><span aria-label={label} className="slate-team-name-short">{team.abbreviation}</span></span><ResultMark result={isFinal ? team.result : null} />{isFinal && team.score !== null ? <span className="ml-1 font-mono font-black tabular-nums">{team.score}</span> : null}</span>
      {hasStarted && team.pickers.length ? <span className={`mt-0.5 block text-[10px] font-semibold leading-3 ${selected ? "text-slate-200" : "text-slate-600"}`}>{team.pickers.join(", ")}</span> : null}
    </>;
    const key = feedbackType ? `${team.id}-${selectionFeedback?.token}` : team.id;
    const pickemControl = allowSelection
      ? <button className={className} disabled={hasStarted} key={key} onClick={() => onChoose?.(game.id, team.id)} type="button">{content}</button>
      : <div className={className}>{content}</div>;

    return pickemControl;
  };

  const survivorChip = (team: typeof left) => {
    if (!survivor?.enabled) return null;

    const survivorSelected = survivor.selectedTeamId === team.id;
    /* The saved selection for this week is not a past-team restriction. It
       stays visible as the official teal/star chip while an unsaved change is
       being considered elsewhere on the Slate. */
    const survivorOfficial = survivor.savedTeamId === team.id;
    const survivorUsed = survivor.usedTeamIds.includes(team.id)
      && !survivorSelected
      && team.id !== survivor.savedTeamId;
    const survivorUnavailable = hasStarted || survivorUsed;

    const replayChip = () => {
      setChipReplay((current) => ({
        ...current,
        [team.id]: (current[team.id] ?? 0) + 1,
      }));
    };

    return <div className="slate-survivor-chip-slot"><button
      aria-label={survivorOfficial ? `Flip your saved Survivor ${team.name} chip` : survivorUnavailable ? `${team.name} is unavailable for Survivor` : `Choose ${team.name} as your Survivor winner`}
      aria-pressed={survivorSelected}
      className="slate-survivor-chip-button"
      disabled={survivorUnavailable}
      onClick={() => {
        if (survivorOfficial) {
          replayChip();
          return;
        }
        survivor.onChoose(game.id, team.id);
        replayChip();
      }}
      title={survivorOfficial ? `Flip your saved ${team.name} chip` : survivorUnavailable ? `${team.name} is unavailable` : `Choose ${team.name} for Survivor`}
      type="button"
    >
      <SurvivorPokerChip
        abbreviation={team.abbreviation}
        animate={Boolean(chipReplay[team.id])}
        key={`${team.id}-${chipReplay[team.id] ?? 0}`}
        official={survivorOfficial}
        selected={survivorSelected}
        size="slate"
        teamName={team.name}
        unavailable={survivorUnavailable}
      />
    </button></div>;
  };

  const rowColumns = survivor?.enabled
    ? "grid-cols-[2.3rem_minmax(0,1fr)_3.45rem_2.5rem_3.45rem_minmax(0,1fr)] min-[380px]:grid-cols-[2.6rem_minmax(0,1fr)_3.9rem_2.9rem_3.9rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)_4.7rem_5rem_4.7rem_minmax(0,1fr)]"
    : "grid-cols-[2.3rem_minmax(0,1fr)_2.85rem_minmax(0,1fr)] min-[380px]:grid-cols-[2.6rem_minmax(0,1fr)_3.35rem_minmax(0,1fr)] sm:grid-cols-[4.5rem_minmax(0,1fr)_6.5rem_minmax(0,1fr)]";

  return <article className={`grid ${rowColumns} items-center gap-0.5 border-b border-[#c8c1b5] ${compactFinal ? "py-0.5" : "py-1.5"} pr-1 min-[380px]:gap-1 sm:gap-3 sm:py-2 sm:pl-2 sm:pr-4 ${alternate ? "bg-[#eee4d1]" : "bg-[#fffdf8]"}`}>
    <div className="text-center text-[10px] font-bold leading-3 text-slate-600 sm:text-xs">
      {isFinal ? <p className="font-mono font-bold text-slate-700">{easternShortDate(game.kickoffAt)}</p> : <><p>{easternTime(game.kickoffAt).replace(" EDT", "").replace(" EST", "")}</p><p className="mt-1 text-[8px] font-black tracking-[0.1em] text-slate-500">ET</p></>}
    </div>
    {teamCell(left, "left")}
    {survivorChip(left)}
    <div className="text-center text-[10px] font-bold leading-4 text-slate-700 sm:text-xs">
      {lockedSpread ? <span className="font-mono text-sm font-bold text-teal-700 sm:text-base">{spreadLabel(game.officialSpread)}</span> : game.preliminarySpread !== null ? <span className="font-mono text-sm font-bold text-zinc-900 sm:text-base">{spreadLabel(game.preliminarySpread)}</span> : <p className="text-[8px] font-black tracking-[0.08em] text-slate-500 sm:text-[9px]">AWAITING LINE</p>}
      {isLive ? <p className="mx-auto mt-1 w-fit border border-red-800 bg-red-50 px-1.5 py-px text-[8px] font-black tracking-[0.12em] text-red-800">LIVE</p> : null}
      {showSpecialLockNote ? <p className="mt-1 whitespace-nowrap text-[7px] font-black leading-3 tracking-[-0.02em] text-teal-700">LOCKS {easternLockLabel(game.lineLockAt).toUpperCase()} ET</p> : null}
    </div>
    {survivorChip(right)}
    {teamCell(right, "right")}
  </article>;
}
