import { useId, type CSSProperties } from "react";

/**
 * One champion's banner, hanging from a brass rod on two cords: cut-felt lettering on a stitched, swallowtailed field. The cloth moves freely:
 * the picture is cut into thin horizontal strips that slide sideways in a slow wave travelling down from the rod (nothing at the rod, most at the
 * free hem), two waves of different lengths laid over each other so it never repeats mechanically. The wave is CSS (see `.trophy-banner-slice`),
 * so reduced motion simply stills it. Colours come from `--banner`, `--banner-dark` and `--banner-light` on the rafters (red Pick'em, blue Bowl, green Survivor).
 */
const WIDTH = 170, ROD_Y = 24, TOP = 30, SLICES = 12, YEAR_ROW = 26;
const pleat = (x: number, folds: number, phase: number) => 0.5 - 0.5 * Math.cos(Math.PI * 2 * (folds * x + phase + 0.05 * Math.sin(Math.PI * 2 * 1.3 * x)));   // 0 on a ridge, 1 in a valley

/** Dark in the valleys and light on the ridges of the folds across the width: broad, soft pleats. */
function foldStops(kind: "dark" | "light", folds: number, phase: number) {
  return Array.from({ length: 41 }, (_, i) => {
    const x = i / 40, valley = pleat(x, folds, phase);
    const opacity = kind === "dark" ? 0.3 * Math.pow(valley, 1.15) : 0.18 * Math.pow(1 - valley, 2.5);
    return <stop key={i} offset={x} stopColor={kind === "dark" ? "#000" : "#fff"} stopOpacity={opacity.toFixed(3)} />;
  });
}

export default function TrophyBanner({ tag, name, years, index }: { tag: string; name: string; years: number[]; index: number }) {
  const id = useId().replaceAll(":", "");
  // a long tag (Bowl Pool, Survivor) wraps onto two lines at a larger size, pushing the rest down a little
  const tagLines = tag.length > 16 && tag.includes(" ") ? [tag.slice(0, tag.lastIndexOf(" ")), tag.slice(tag.lastIndexOf(" ") + 1)] : [tag];
  const extra = (tagLines.length - 1) * 11;
  const height = 224 + extra + YEAR_ROW * Math.max(0, years.length - 2);
  const bottom = TOP + height;
  const phase = 0.12 * index;
  const nameSize = Math.min(35, 146 / (Math.max(3, name.length) * 0.5));
  const strip = (bottom + 2 - TOP) / SLICES;
  const body = `M6 ${TOP}H${WIDTH - 6}V${bottom}L${WIDTH / 2} ${bottom - 36}L6 ${bottom}Z`;
  const stitch = `M14 ${TOP + 17}H${WIDTH - 14}V${bottom - 11}L${WIDTH / 2} ${bottom - 44}L14 ${bottom - 11}Z`;
  const inner = `M17.6 ${TOP + 20.6}H${WIDTH - 17.6}V${bottom - 15}L${WIDTH / 2} ${bottom - 49}L17.6 ${bottom - 15}Z`;
  const ink = (extra?: CSSProperties): CSSProperties => ({ fontFamily: "var(--font-graduate), Georgia, serif", ...extra });
  const nameY = TOP + 90 + extra, yearY = TOP + 124 + extra;
  const tagSize = tagLines.length > 1 ? 10.6 : Math.min(10, (10 * 16) / Math.max(1, tag.length));   // a one-line tag still fits inside the rule

  return (
    <svg aria-hidden="true" className="trophy-banner-art" focusable="false" viewBox={`0 0 ${WIDTH} ${bottom + 14}`}>
      <defs>
        <linearGradient id={`${id}-dark`} x1="0" x2="1" y1="0" y2="0">{foldStops("dark", 2.4, phase)}</linearGradient>
        <linearGradient id={`${id}-light`} x1="0" x2="1" y1="0" y2="0">{foldStops("light", 2.4, phase)}</linearGradient>
        <linearGradient id={`${id}-field`} x1="0" x2="0" y1="0" y2="1">
          <stop className="trophy-banner-stop-light" offset="0" stopOpacity=".55" />
          <stop className="trophy-banner-stop-base" offset=".4" />
          <stop className="trophy-banner-stop-dark" offset="1" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#000" stopOpacity=".4" /><stop offset=".12" stopColor="#000" stopOpacity=".06" /><stop offset="1" stopColor="#000" stopOpacity=".22" />
        </linearGradient>
        <pattern height="2.4" id={`${id}-thread`} patternTransform="rotate(35)" patternUnits="userSpaceOnUse" width="2.4">
          <rect fill="#f0d27a" height="2.4" width="2.4" /><rect fill="#b98f2c" height="1.1" width="2.4" />
        </pattern>
        <linearGradient id={`${id}-brass`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff0b0" /><stop offset=".35" stopColor="#e2b64a" /><stop offset=".7" stopColor="#9a6f1c" /><stop offset="1" stopColor="#d9aa3e" />
        </linearGradient>
        <radialGradient cx=".35" cy=".3" id={`${id}-ball`} r=".8">
          <stop offset="0" stopColor="#fff6c8" /><stop offset=".45" stopColor="#e0b142" /><stop offset="1" stopColor="#7d5612" />
        </radialGradient>
        <clipPath id={`${id}-body`}><path d={body} /></clipPath>
        {Array.from({ length: SLICES }, (_, j) => <clipPath id={`${id}-s${j}`} key={j}><rect height={strip + 0.8} width={WIDTH + 40} x={-20} y={TOP - 0.4 + j * strip} /></clipPath>)}

        {/* the cloth itself, without the rod: field, folds, sleeve, stitching and lettering */}
        <g id={`${id}-cloth`}>
          <g clipPath={`url(#${id}-body)`}>
            <rect fill={`url(#${id}-field)`} height={height} width={WIDTH} y={TOP} />
            <rect fill={`url(#${id}-dark)`} height={height} width={WIDTH} y={TOP} />
            <rect fill={`url(#${id}-light)`} height={height} width={WIDTH} y={TOP} />
            <rect fill={`url(#${id}-shade)`} height={height} width={WIDTH} y={TOP} />
          </g>
          <path d={body} fill="none" stroke="#000" strokeOpacity=".35" />
          <path d={stitch} fill="none" stroke="#e6c46e" strokeLinejoin="round" strokeWidth="1.5" />
          <path d={inner} fill="none" stroke="#f6e6b4" strokeLinejoin="round" strokeOpacity=".75" strokeWidth=".7" />
          {[[14, TOP + 17], [WIDTH - 14, TOP + 17], [14, bottom - 11], [WIDTH - 14, bottom - 11], [WIDTH / 2, bottom - 44]].map(([x, y], i) => <path d={`M${x} ${y - 3.2}L${x + 3.2} ${y}L${x} ${y + 3.2}L${x - 3.2} ${y}Z`} fill="#e6c46e" key={i} stroke="#2a1405" strokeOpacity=".5" strokeWidth=".5" />)}
          <rect className="trophy-banner-sleeve" height="18" width={WIDTH - 12} x="6" y={TOP - 2} />
          <rect fill={`url(#${id}-dark)`} height="18" width={WIDTH - 12} x="6" y={TOP - 2} />
          <path d={`M6 ${TOP + 16}H${WIDTH - 6}`} stroke="#000" strokeOpacity=".35" strokeWidth="1.4" />
          <rect fill={`url(#${id}-dark)`} height={height - 52} opacity=".5" width={WIDTH - 12} x="6" y={TOP + 16} />
        </g>
        {/* the lettering, kept apart from the cloth so it moves as one piece and never shears */}
        <g id={`${id}-print`}>
          {tagLines.map((line, index) => <text fill="#f8e29a" fontSize={tagSize} key={line} letterSpacing="1.2" paintOrder="stroke" stroke="#f8e29a" strokeWidth=".35" style={ink()} textAnchor="middle" x={WIDTH / 2} y={TOP + 54 + index * 12.5}>{line.toUpperCase()}</text>)}
          <text fill="#fbe7a1" fontSize={nameSize} paintOrder="stroke" stroke="#2a1405" strokeLinejoin="round" strokeWidth="2.2" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 700 }} textAnchor="middle" x={WIDTH / 2} y={nameY}>{name}</text>
          <text fill="#f8e29a" fontSize="12" textAnchor="middle" x={WIDTH / 2} y={nameY + 21}>★</text>
          {years.map((year, i) => <text fill="#fff6d8" fontSize="23" key={year} letterSpacing="1.5" paintOrder="stroke" stroke="#1d0a05" strokeLinejoin="round" strokeWidth="2.2" style={ink()} textAnchor="middle" x={WIDTH / 2} y={yearY + 22 + i * YEAR_ROW}>{year}</text>)}
        </g>
      </defs>

      <ellipse className="trophy-banner-shadow" cx={WIDTH / 2} cy={TOP + 4} rx={WIDTH / 2 - 8} ry="5" />
      {Array.from({ length: SLICES }, (_, j) => {
        const depth = j / (SLICES - 1);
        return (
          <g className="trophy-banner-slice" key={j} style={{ "--amp": `${(0.2 + 4.8 * depth * depth).toFixed(2)}px`, "--lag": `${(-j * 0.25).toFixed(2)}s` } as CSSProperties}>
            <g clipPath={`url(#${id}-s${j})`}><use href={`#${id}-cloth`} /></g>
          </g>
        );
      })}

      {(() => { const depth = 0.42; return (
        <g className="trophy-banner-slice" style={{ "--amp": `${(0.2 + 4.8 * depth * depth).toFixed(2)}px`, "--lag": `${(-depth * SLICES * 0.25).toFixed(2)}s` } as CSSProperties}>
          <use href={`#${id}-print`} />
        </g>
      ); })()}

      <path d={`M32 ${ROD_Y + 1}L${WIDTH / 2} 0L${WIDTH - 32} ${ROD_Y + 1}`} fill="none" stroke="#cdb98a" strokeWidth="1.6" />
      <rect fill={`url(#${id}-brass)`} height="8" rx="4" width={WIDTH - 24} x="12" y={ROD_Y} />
      <circle cx="10" cy={ROD_Y + 4} fill={`url(#${id}-ball)`} r="7" />
      <circle cx={WIDTH - 10} cy={ROD_Y + 4} fill={`url(#${id}-ball)`} r="7" />
    </svg>
  );
}
