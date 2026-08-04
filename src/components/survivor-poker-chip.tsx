import Image from "next/image";
import type { CSSProperties } from "react";
import { teamChipAccents } from "@/lib/nfl-helmet-colors";

type Props = {
  abbreviation: string;
  teamName: string;
  selected?: boolean;
  official?: boolean;
  animate?: boolean;
  idleSpin?: boolean;
  unavailable?: boolean;
  size?: "wire" | "summary" | "ticket" | "slate";
  tooltip?: string;
};

// The source marks have different amounts of transparent canvas around them.
// A small, bounded boost for the airier marks keeps their visible ink weight
// consistent without changing the chip or face dimensions.
const chipLogoScales: Record<string, number> = {
  BAL: 1.18,
  BUF: 1.08,
  CAR: 1.16,
  DEN: 1.13,
  GB: 1.09,
  KC: 1.09,
  LAC: 1.2,
  NE: 1.18,
  PHI: 1.07,
  SEA: 1.2,
  SF: 1.12,
  WAS: 1.18,
};

export default function SurvivorPokerChip({ abbreviation, teamName, selected = false, official = false, animate = false, idleSpin = false, unavailable = false, size = "wire", tooltip }: Props) {
  // Display abbreviations may use scorepad casing (for example `Sea`), but
  // the public logo assets use the canonical uppercase team key (`SEA`).
  // Normalize at the asset boundary so presentation casing can never break a
  // chip image.
  const logoAbbreviation = abbreviation.trim().toUpperCase();
  const accent = teamChipAccents(logoAbbreviation);
  const logoScale = chipLogoScales[logoAbbreviation] ?? 1;
  const state = official ? "official" : selected ? "picked" : "available";

  return (
    <span aria-hidden="true" className={`survivor-poker-chip-wrap survivor-poker-chip-wrap-${size}`} data-animate={animate ? "toss" : undefined} data-state={state} style={{ "--chip-primary": accent.primary, "--chip-secondary": accent.secondary } as CSSProperties} title={tooltip ?? teamName}>
      <span className="survivor-poker-chip-ground-shadow" />
      <span className={`survivor-poker-chip survivor-poker-chip-${size}${idleSpin ? " is-idle-spinning" : ""}${unavailable ? " is-unavailable" : ""}`} data-animate={animate ? "toss" : undefined} data-state={state}>
        <span className="survivor-poker-chip-rim survivor-poker-chip-rim-front" />
        <span className="survivor-poker-chip-rim survivor-poker-chip-rim-back" />
        <span className="survivor-poker-chip-edge" />
        <span className="survivor-poker-chip-core">
          <span className="survivor-poker-chip-face survivor-poker-chip-front" style={{ "--chip-logo-scale": logoScale } as CSSProperties}>
            <Image alt="" className="object-contain" height={44} src={`/team-logos/${logoAbbreviation}.png`} width={44} />
          </span>
          <span className="survivor-poker-chip-face survivor-poker-chip-back" style={{ "--chip-logo-scale": logoScale } as CSSProperties}>
            <Image alt="" className="object-contain" height={44} src={`/team-logos/${logoAbbreviation}.png`} width={44} />
          </span>
        </span>
      </span>
      {selected && !official ? <span className="survivor-poker-chip-pick-mark">SURVIVOR</span> : null}
      {official ? <span className="survivor-poker-chip-seal">{"\u2605"}</span> : null}
    </span>
  );
}
