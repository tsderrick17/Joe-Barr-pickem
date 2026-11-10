/**
 * The Pick'em Pad's holiday skins (the week is chosen by src/lib/pad-skin.js): artwork across the top of the paper,
 * a strip of it under the last row, and the mark that stands in for a pick still hidden until kickoff. The rows,
 * picks, lines, and results are the pad's own and never change; the colours are in 00-tokens.css and
 * 15-pad-skins.css. Every piece here is decoration and hidden from screen readers.
 */

export type PadSkin = "halloween" | "thanksgiving" | "christmas";

const leaf = (x: number, y: number, angle: number, fill: string) => (
  <g key={`${x}-${y}`} transform={`translate(${x} ${y}) rotate(${angle})`}>
    <path d="M0 0C6-9 18-9 24 0C18 9 6 9 0 0Z" fill={fill} />
    <path d="M2 0H22M9 0l4-4M15 0l4 4" stroke="#4a2410" strokeWidth=".8" />
  </g>
);

function pumpkin(x: number, y: number, r: number, face: boolean) {
  return (
    <g key={`${x}-${y}`}>
      <rect fill="#5b7a2a" height="6" width="3" x={x - 1.5} y={y - r * 0.8 - 5} />
      <ellipse cx={x} cy={y} fill="#f08a24" rx={r} ry={r * 0.8} />
      <ellipse cx={x} cy={y} fill="none" rx={r * 0.5} ry={r * 0.8} stroke="#c76a12" />
      {face ? <path d={`M${x - r * 0.55} ${y - 2}l${r * 0.3} ${-r * 0.32}l${r * 0.12} ${r * 0.32}zM${x + r * 0.13} ${y - 2}l${r * 0.12} ${-r * 0.32}l${r * 0.3} ${r * 0.32}zM${x - r * 0.5} ${y + 2.5}h${r}l${-r * 0.25} ${r * 0.3}l${-r * 0.25} ${-r * 0.15}l${-r * 0.25} ${r * 0.15}z`} fill="#1a1024" /> : null}
    </g>
  );
}

const bat = (x: number, y: number, scale: number) => (
  <path key={`${x}-${y}`} d="M0 0q4-6 8 0q2-3 4 0q4-6 8 0q-6-1-10 4q-4-5-10-4z" fill="#0a0710" stroke="#8b6fc0" strokeWidth=".7" transform={`translate(${x} ${y}) scale(${scale})`} />
);

const tombstone = (x: number, width: number, height: number, ground: number) => (
  <g key={x}>
    <path d={`M${x} ${ground}V${ground - height + width / 2}a${width / 2} ${width / 2} 0 0 1 ${width} 0V${ground}z`} fill="#5a4a78" />
    <path d={`M${x + width / 2} ${ground - height + 6}v8M${x + width / 2 - 3} ${ground - height + 9}h6`} stroke="#1a1024" strokeWidth="1.5" />
  </g>
);

/** A corner web: five threads out from the corner, three sagging rings across them. */
function webPath(size: number) {
  const angles = [0, 22.5, 45, 67.5, 90].map((degrees) => (degrees * Math.PI) / 180);
  const at = (radius: number, angle: number) => `${(radius * Math.cos(angle)).toFixed(1)} ${(radius * Math.sin(angle)).toFixed(1)}`;
  let path = angles.map((angle) => `M0 0L${at(size, angle)}`).join("");
  for (const radius of [size * 0.32, size * 0.6, size * 0.88]) {
    for (let index = 0; index < 4; index += 1) {
      path += `M${at(radius, angles[index])}Q${at(radius * 0.82, (angles[index] + angles[index + 1]) / 2)} ${at(radius, angles[index + 1])}`;
    }
  }
  return path;
}

/** Garland swags across a 480-wide strip, with baubles where each swag dips. */
function garlandPath() {
  let path = "M0 3";
  for (let index = 0; index < 6; index += 1) path += `Q${index * 80 + 40} 30 ${index * 80 + 80} 3`;
  return path;
}

/** Across the top of the paper, over the week's name. */
export function PadSkinTop({ skin }: { skin: PadSkin }) {
  if (skin === "halloween") {
    return (
      <div aria-hidden="true" className="pad-skin-top">
        <svg className="pad-skin-web" height="46" viewBox="0 0 46 46" width="46"><path d={webPath(46)} fill="none" stroke="#a892d6" strokeWidth="1" /></svg>
        <svg className="pad-skin-bat" height="12" viewBox="0 0 22 12" width="22">{bat(1, 5, 1)}</svg>
        <svg className="pad-skin-spider" height="46" viewBox="0 0 30 46" width="30">
          <path d="M15 0V26" stroke="#d9cdf0" strokeWidth="1" />
          <g fill="none" stroke="#f08a24" strokeLinecap="round" strokeWidth="1.3">
            <path d="M9 30l-6-5l-3 3M9 33l-8-1l-2 4M9 36l-7 4l-1 5M10 39l-4 5v2M21 30l6-5l3 3M21 33l8-1l2 4M21 36l7 4l1 5M20 39l4 5v2" />
          </g>
          <ellipse cx="15" cy="33" fill="#0a0710" rx="6" ry="7" stroke="#f08a24" strokeWidth="1.3" />
          <circle cx="15" cy="42" fill="#0a0710" r="3.5" stroke="#f08a24" strokeWidth="1.3" />
          <circle cx="13.5" cy="42" fill="#9be35a" r=".9" /><circle cx="16.5" cy="42" fill="#9be35a" r=".9" />
        </svg>
      </div>
    );
  }
  if (skin === "thanksgiving") {
    return (
      <div aria-hidden="true" className="pad-skin-top">
        <svg className="pad-skin-leaves" height="34" viewBox="0 0 64 34" width="64">{[leaf(2, 10, 20, "#c8641b"), leaf(20, 26, -30, "#8f1d2c"), leaf(36, 6, 55, "#d9a021")]}</svg>
        <svg className="pad-skin-leaves is-right" height="34" viewBox="0 0 64 34" width="64">{[leaf(62, 10, 160, "#8f1d2c"), leaf(44, 26, 210, "#c8641b"), leaf(28, 6, 125, "#d9a021")]}</svg>
      </div>
    );
  }
  const baubles = Array.from({ length: 6 }, (_, index) => [index * 80 + 16, index * 80 + 40, index * 80 + 64]).flat();
  return (
    <div aria-hidden="true" className="pad-skin-top">
      <svg className="pad-skin-garland" height="30" preserveAspectRatio="xMidYMin slice" viewBox="0 0 480 30">
        <path d={garlandPath()} fill="none" stroke="#2f7a45" strokeLinecap="round" strokeWidth="10" />
        <path d={garlandPath()} fill="none" stroke="#6fbf7e" strokeDasharray="2 3" strokeWidth="6" />
        {baubles.map((x, index) => <circle cx={x} cy={index % 3 === 1 ? 19 : 12} fill={index % 3 === 1 ? "#f2c94c" : "#ff5a5a"} key={x} r="3.4" />)}
      </svg>
      <svg className="pad-skin-wreath" height="52" viewBox="0 0 36 52" width="36">
        <path d="M18 0V12" stroke="#f2c94c" strokeWidth="1.5" />
        <circle cx="18" cy="24" fill="none" r="11" stroke="#2f7a45" strokeWidth="8" />
        <circle cx="18" cy="24" fill="none" r="11" stroke="#6fbf7e" strokeDasharray="2 3" strokeWidth="5" />
        <circle cx="9" cy="18" fill="#ff5a5a" r="2.2" /><circle cx="27" cy="20" fill="#ff5a5a" r="2.2" /><circle cx="11" cy="31" fill="#ff5a5a" r="2.2" />
        <path d="M18 35l-9-5v10zM18 35l9-5v10z" fill="#d62828" />
        <path d="M16 36l-4 10M20 36l4 10" stroke="#d62828" strokeLinecap="round" strokeWidth="2.4" />
        <circle cx="18" cy="35" fill="#f2c94c" r="2.6" />
      </svg>
    </div>
  );
}

/** A strip of the paper under the last row. */
export function PadSkinFoot({ skin }: { skin: PadSkin }) {
  if (skin === "halloween") {
    return (
      <div aria-hidden="true" className="pad-skin-foot">
        <svg height="44" viewBox="0 0 96 44" width="96">{[pumpkin(24, 29, 15, true), pumpkin(56, 33, 10, true)]}<path d="M38 41q8-6 12-2" fill="none" stroke="#5b7a2a" strokeWidth="1.5" /></svg>
        <svg height="44" viewBox="0 0 60 44" width="60">{[bat(4, 12, 1.1), bat(30, 4, 0.8)]}</svg>
        <svg height="44" viewBox="0 0 96 44" width="96">{[tombstone(8, 18, 30, 42), tombstone(32, 15, 21, 42)]}{pumpkin(74, 32, 12, true)}</svg>
      </div>
    );
  }
  if (skin === "thanksgiving") {
    const grapes = [[52, 60], [46, 55], [58, 55], [49, 65], [56, 65], [62, 60]];
    return (
      <div aria-hidden="true" className="pad-skin-foot">
        <svg height="74" viewBox="0 0 70 74" width="70">{[leaf(4, 58, -20, "#c8641b"), leaf(30, 66, 15, "#d9a021"), leaf(40, 48, -40, "#8f1d2c")]}<ellipse cx="18" cy="40" fill="#8a5a2a" rx="6" ry="7" /><path d="M11 36h14a7 4 0 0 0-14 0z" fill="#5e3a12" /></svg>
        <svg height="74" viewBox="0 0 200 74" width="200">
          <path d="M116 22C142 12 172 24 194 6C192 36 172 64 116 68Z" fill="#b9812f" />
          <path d="M132 19C138 36 138 52 132 67M150 19C157 32 156 50 148 63M168 19C174 28 172 44 164 56" fill="none" stroke="#7a4f17" strokeWidth="1.5" />
          <ellipse cx="116" cy="45" fill="#5e3a12" rx="9" ry="23" />
          <ellipse cx="24" cy="62" fill="#e3b23a" rx="14" ry="5" transform="rotate(-10 24 62)" />
          <path d="M34 58l12-6l-2 10z" fill="#7d9a3a" />
          {grapes.map(([x, y]) => <circle cx={x} cy={y} fill="#6b3f7a" key={`${x}-${y}`} r="4" />)}
          <circle cx="74" cy="58" fill="#8f1d2c" r="8" /><path d="M74 50v-4" stroke="#5e3a12" strokeWidth="1.5" />
          {pumpkin(94, 52, 14, false)}
          <circle cx="110" cy="62" fill="#c9442a" r="7" />
        </svg>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="pad-skin-foot">
      <svg className="pad-skin-snow" height="44" preserveAspectRatio="xMidYMax slice" viewBox="0 0 480 44"><path d="M0 44V28Q60 14 130 26T260 22T380 24T480 18V44Z" fill="#fbfbf7" /></svg>
      <svg height="44" viewBox="0 0 40 44" width="40"><path d="M20 2l-10 13h6l-10 13h28l-10-13h6z" fill="#6fbf7e" /><rect fill="#8a5a2a" height="6" width="5" x="17.5" y="28" /><circle cx="20" cy="3" fill="#f2c94c" r="2.5" /></svg>
      <svg height="44" viewBox="0 0 44 44" width="44"><rect fill="#d62828" height="16" width="20" x="2" y="14" /><path d="M12 14v16M2 21h20" stroke="#f2c94c" strokeWidth="2.2" /><rect fill="#f2c94c" height="12" width="15" x="26" y="18" /><path d="M33.500 18v12M26 23.500h15" stroke="#d62828" strokeWidth="2.2" /></svg>
    </div>
  );
}

/** What stands in for a pick still hidden until kickoff: a ghost, a covered dish, a wrapped gift. */
export function PadSkinHidden({ skin }: { skin: PadSkin }) {
  return (
    <svg aria-hidden="true" className="pad-skin-hidden" fill="none" height="18" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 16 16" width="18">
      {skin === "halloween" ? <><path d="M3.500 14V7.500a4.500 4.500 0 0 1 9 0V14l-1.500-1.200L10.500 14 9 12.800 7.500 14 6 12.800 5 14z" /><circle cx="6.300" cy="7.500" fill="currentColor" r=".8" stroke="none" /><circle cx="9.700" cy="7.500" fill="currentColor" r=".8" stroke="none" /></>
        : skin === "thanksgiving" ? <><path d="M2.500 11.500a5.500 5.500 0 0 1 11 0zM1 13.500h14" /><circle cx="8" cy="4.500" r="1" /></>
          : <><rect height="8" width="12" x="2" y="6.500" /><path d="M1.500 4h13v2.500h-13zM8 4v10.500M8 4C6 1 3.500 2 5 4M8 4c2-3 4.500-2 3 0" /></>}
    </svg>
  );
}
