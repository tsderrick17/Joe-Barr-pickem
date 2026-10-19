import { useId, type CSSProperties } from "react";

/**
 * One champion's banner, hanging from a brass rod on two cords: cut-felt lettering on a stitched, swallowtailed field. The cloth moves freely:
 * the picture is cut into thin horizontal strips that slide sideways in a slow wave travelling down from the rod (nothing at the rod, most at the
 * free hem), two waves of different lengths laid over each other so it never repeats mechanically. The wave is CSS (see `.trophy-banner-slice`),
 * so reduced motion simply stills it. Colours come from `--banner`, `--banner-dark` and `--banner-light` on the rafters (red Pick'em, blue Bowl, green Survivor).
 */
const WIDTH = 170, ROD_Y = 24, TOP = 30, SLICES = 18, YEAR_ROW = 22;
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
  const height = 212 + YEAR_ROW * Math.max(0, years.length - 2);
  const bottom = TOP + height;
  const phase = 0.12 * index;
  const nameSize = Math.min(31, 138 / (Math.max(3, name.length) * 0.53));
  const strip = (bottom + 2 - TOP) / SLICES;
  const body = `M6 ${TOP}H${WIDTH - 6}V${bottom}L${WIDTH / 2} ${bottom - 36}L6 ${bottom}Z`;
  const stitch = `M14 ${TOP + 17}H${WIDTH - 14}V${bottom - 11}L${WIDTH / 2} ${bottom - 44}L14 ${bottom - 11}Z`;
  const ink = (extra?: CSSProperties): CSSProperties => ({ fontFamily: "var(--font-graduate), Georgia, serif", ...extra });
  const nameY = TOP + 90, yearY = TOP + 112;
  const tagSize = Math.min(8.6, (8.6 * 17) / Math.max(1, tag.length));   // the longest tag still fits inside the stitching

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
          <path d={stitch} fill="none" stroke="#f3e6c0" strokeDasharray="4 3" strokeLinecap="round" strokeWidth="1.6" />
          <rect className="trophy-banner-sleeve" height="18" width={WIDTH - 12} x="6" y={TOP - 2} />
          <rect fill={`url(#${id}-dark)`} height="18" width={WIDTH - 12} x="6" y={TOP - 2} />
          <path d={`M6 ${TOP + 16}H${WIDTH - 6}`} stroke="#000" strokeOpacity=".35" strokeWidth="1.4" />
          <text fill="#f3dc94" fontSize={tagSize} letterSpacing="2" style={ink()} textAnchor="middle" x={WIDTH / 2} y={TOP + 54}>{tag.toUpperCase()}</text>
          <text fill={`url(#${id}-thread)`} fontSize={nameSize} paintOrder="stroke" stroke="#2a1c05" strokeWidth=".9" style={{ fontFamily: "var(--font-cormorant), Georgia, serif", fontWeight: 700 }} textAnchor="middle" x={WIDTH / 2} y={nameY}>{name}</text>
          <text fill="#f3dc94" fontSize="11" textAnchor="middle" x={WIDTH / 2} y={nameY + 22}>★</text>
          {years.map((year, i) => <text fill="#fff3cf" fontSize="19" key={year} letterSpacing="1.5" stroke="#000" strokeOpacity=".35" strokeWidth=".6" style={ink()} textAnchor="middle" x={WIDTH / 2} y={yearY + 22 + i * YEAR_ROW}>{year}</text>)}
          <rect fill={`url(#${id}-dark)`} height={height - 52} opacity=".5" width={WIDTH - 12} x="6" y={TOP + 16} />
        </g>
      </defs>

      <ellipse className="trophy-banner-shadow" cx={WIDTH / 2} cy={TOP + 4} rx={WIDTH / 2 - 8} ry="5" />
      {Array.from({ length: SLICES }, (_, j) => {
        const depth = j / (SLICES - 1);
        return (
          <g className="trophy-banner-slice" key={j} style={{ "--amp": `${(0.2 + 4.8 * depth * depth).toFixed(2)}px`, "--lag": `${(-j * 0.17).toFixed(2)}s` } as CSSProperties}>
            <g className="trophy-banner-slice-b" style={{ "--lag": `${(-j * 0.11 - 1).toFixed(2)}s` } as CSSProperties}>
              <g clipPath={`url(#${id}-s${j})`}><use href={`#${id}-cloth`} /></g>
            </g>
          </g>
        );
      })}

      <path d={`M32 ${ROD_Y + 1}L${WIDTH / 2} 0L${WIDTH - 32} ${ROD_Y + 1}`} fill="none" stroke="#cdb98a" strokeWidth="1.6" />
      <rect fill={`url(#${id}-brass)`} height="8" rx="4" width={WIDTH - 24} x="12" y={ROD_Y} />
      <circle cx="10" cy={ROD_Y + 4} fill={`url(#${id}-ball)`} r="7" />
      <circle cx={WIDTH - 10} cy={ROD_Y + 4} fill={`url(#${id}-ball)`} r="7" />
    </svg>
  );
}
