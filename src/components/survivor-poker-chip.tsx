import Image from "next/image";
import type { CSSProperties } from "react";
import { teamChipAccents } from "@/lib/nfl-helmet-colors";
import { teamLogoScale } from "@/lib/team-logo-scale.js";

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
  /** Build the 3D rim even when the chip is still. Off by default: a chip seen head on has no visible edge, and a Slate shows dozens of them. */
  showEdge?: boolean;
};

// The chip is a real cylinder: two identical faces a chip's thickness apart and
// a band of flat edge segments around the rim. Each quarter of the rim has one
// 16-degree insert segment (the same colored spot printed on the face, carried
// over the edge) and seven plain segments. Each segment is darkened a little
// by how far it faces away from the light above, shaded smoothly from one end
// to the other so neighbors meet at the same tone and the edge reads as one
// continuous round band rather than flat steps.
const EDGE_INSERT = 16;
const EDGE_PLAIN = (90 - EDGE_INSERT) / 7;
const edgeDark = (angle: number) => (0.22 * (1 - Math.cos((angle * Math.PI) / 180)) / 2).toFixed(3);
const edgeSegments = Array.from({ length: 4 }, (_, quarter) => [
  { angle: quarter * 90, span: EDGE_INSERT, insert: true },
  ...Array.from({ length: 7 }, (_, step) => ({ angle: quarter * 90 + EDGE_INSERT / 2 + EDGE_PLAIN * (step + 0.5), span: EDGE_PLAIN, insert: false })),
]).flat().map(({ angle, span, insert }) => ({
  insert,
  style: {
    "--seg-a": `${angle.toFixed(3)}deg`,
    // A chord of `span` degrees, as a share of the diameter.
    "--seg-w": `${(Math.sin((span * Math.PI) / 360) * 100).toFixed(3)}%`,
    "--seg-dark-a": edgeDark(angle - span / 2),
    "--seg-dark-b": edgeDark(angle + span / 2),
  } as CSSProperties,
}));

const CHIP_LOGO_BOOST = 1.18;

export default function SurvivorPokerChip({ abbreviation, teamName, selected = false, official = false, animate = false, idleSpin = false, unavailable = false, size = "wire", tooltip, showEdge = false }: Props) {
  // Display abbreviations may use scorepad casing (for example `Sea`), but
  // the public logo assets use the canonical uppercase team key (`SEA`).
  // Normalize at the asset boundary so presentation casing can never break a
  // chip image.
  const logoAbbreviation = abbreviation.trim().toUpperCase();
  const accent = teamChipAccents(logoAbbreviation);
  // Every logo is scaled so its inked area reads at one size (src/lib/team-logo-scale.js).
  // Chips show the mark 18% larger than the Pad does, so it fills the chip face.
  const logoScale = teamLogoScale(logoAbbreviation) * CHIP_LOGO_BOOST;
  const state = official ? "official" : selected ? "picked" : "available";
  // The rim is only seen while the chip turns, so only a turning chip builds it.
  const renderEdge = showEdge || animate || idleSpin;
  const face = (
    <span className="survivor-poker-chip-face" style={{ "--chip-logo-scale": logoScale } as CSSProperties}>
      <Image alt="" className="object-contain" height={44} src={`/team-logos/${logoAbbreviation}.png`} width={44} />
    </span>
  );

  return (
    <span aria-hidden="true" className={`survivor-poker-chip-wrap survivor-poker-chip-wrap-${size}`} data-animate={animate ? "toss" : undefined} data-state={state} style={{ "--chip-primary": accent.primary, "--chip-secondary": accent.secondary } as CSSProperties} title={tooltip ?? teamName}>
      <span className="survivor-poker-chip-ground-shadow" />
      <span className={`survivor-poker-chip survivor-poker-chip-${size}${idleSpin ? " is-idle-spinning" : ""}${unavailable ? " is-unavailable" : ""}`} data-animate={animate ? "toss" : undefined} data-state={state}>
        {renderEdge ? edgeSegments.map((segment, index) => <span className={`survivor-poker-chip-edge-seg${segment.insert ? " is-insert" : ""}`} key={index} style={segment.style} />) : null}
        <span className="survivor-poker-chip-side survivor-poker-chip-front">{face}</span>
        <span className="survivor-poker-chip-side survivor-poker-chip-back">{face}</span>
      </span>
      {selected && !official ? <span className="survivor-poker-chip-pick-mark">SURVIVOR</span> : null}
      {official ? <span className="survivor-poker-chip-seal">{"★"}</span> : null}
    </span>
  );
}
