import Image from "next/image";
import type { CSSProperties } from "react";
import { teamChipAccents } from "@/lib/nfl-helmet-colors";

type Props = {
  abbreviation: string;
  teamName: string;
  selected?: boolean;
  official?: boolean;
  unavailable?: boolean;
  size?: "wire" | "summary";
};

export default function SurvivorPokerChip({ abbreviation, teamName, selected = false, official = false, unavailable = false, size = "wire" }: Props) {
  const accent = teamChipAccents(abbreviation);
  const state = official ? "official" : selected ? "picked" : "available";

  return (
    <span aria-hidden="true" className={`survivor-poker-chip survivor-poker-chip-${size}${unavailable ? " is-unavailable" : ""}`} data-state={state} style={{ "--chip-primary": accent.primary, "--chip-secondary": accent.secondary } as CSSProperties} title={teamName}>
      <span className="survivor-poker-chip-core">
        <span className="survivor-poker-chip-face survivor-poker-chip-front">
          <Image alt="" className="object-contain" height={44} src={`/team-logos/${abbreviation}.png`} width={44} />
        </span>
        <span className="survivor-poker-chip-face survivor-poker-chip-back"><span className="survivor-poker-chip-star">★</span></span>
      </span>
      {selected && !official ? <span className="survivor-poker-chip-pick-mark">PICK</span> : null}
      {official ? <span className="survivor-poker-chip-seal">{"\u2605"}</span> : null}
    </span>
  );
}
