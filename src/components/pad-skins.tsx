import { useId } from "react";

/**
 * The Pick'em Pad's holiday skins (the week is chosen by src/lib/pad-skin.js): artwork across the top of the paper,
 * a scene under the last row, and the mark that stands in for a pick still hidden until kickoff. The rows, picks,
 * lines, and results are the pad's own and never change; the colours are in 00-tokens.css and 15-pad-skins.css.
 * Every piece here is decoration and hidden from screen readers.
 */

export type PadSkin = "halloween" | "thanksgiving" | "christmas";

type Point = [number, number];
const fixed = (value: number) => value.toFixed(1);

/** Short needles along a run of points, both sides of the line, for fir garland and the wreath. */
function needles(points: Array<{ at: Point; angle: number }>, length: number, spreads: number[]) {
  let path = "";
  for (const { at: [x, y], angle } of points) {
    for (const side of [-1, 1]) {
      for (const spread of spreads) {
        const direction = angle + side * spread;
        path += `M${fixed(x)} ${fixed(y)}l${fixed(Math.cos(direction) * length)} ${fixed(Math.sin(direction) * length)}`;
      }
    }
  }
  return path;
}

/** Points along a quadratic swag, with the direction of the line at each. */
function swagPoints(start: Point, control: Point, end: Point, steps: number) {
  return Array.from({ length: steps + 1 }, (_, index) => {
    const t = index / steps;
    const at: Point = [
      (1 - t) ** 2 * start[0] + 2 * t * (1 - t) * control[0] + t ** 2 * end[0],
      (1 - t) ** 2 * start[1] + 2 * t * (1 - t) * control[1] + t ** 2 * end[1],
    ];
    const dx = 2 * (1 - t) * (control[0] - start[0]) + 2 * t * (end[0] - control[0]);
    const dy = 2 * (1 - t) * (control[1] - start[1]) + 2 * t * (end[1] - control[1]);
    return { at, angle: Math.atan2(dy, dx) };
  });
}

const SWAGS = Array.from({ length: 6 }, (_, index) => {
  const left = index * 80;
  return { start: [left, 4] as Point, control: [left + 40, 34] as Point, end: [left + 80, 4] as Point };
});
const GARLAND_LINE = "M0 4" + SWAGS.map(({ control, end }) => `Q${control[0]} ${control[1]} ${end[0]} ${end[1]}`).join("");
const GARLAND_POINTS = SWAGS.flatMap(({ start, control, end }) => swagPoints(start, control, end, 16));
const GARLAND_DARK = needles(GARLAND_POINTS, 6.5, [0.75, 1.3, 2.1]);
const GARLAND_LIGHT = needles(GARLAND_POINTS.filter((_, index) => index % 2 === 0), 4.5, [1, 1.7]);
const BEADS = "M0 6" + SWAGS.map(({ start }) => `Q${start[0] + 40} 40 ${start[0] + 80} 6`).join("");

const WREATH_POINTS = [9, 12.5, 16].flatMap((radius, ring) => Array.from({ length: 30 }, (_, index) => {
  const angle = (index / 30) * Math.PI * 2 + ring * 0.2;
  return { at: [22 + Math.cos(angle) * radius, 27 + Math.sin(angle) * radius] as Point, angle: angle + Math.PI / 2 };
}));
const WREATH_DARK = needles(WREATH_POINTS, 5, [0.5, 1.2]);
const WREATH_LIGHT = needles(WREATH_POINTS.filter((_, index) => index % 3 === 0), 3.5, [0.8]);

const TWINE_SWAGS = Array.from({ length: 4 }, (_, index) => {
  const left = index * 120;
  return { start: [left, 3] as Point, control: [left + 60, 36] as Point, end: [left + 120, 3] as Point };
});
const TWINE = "M0 3" + TWINE_SWAGS.map(({ control, end }) => `Q${control[0]} ${control[1]} ${end[0]} ${end[1]}`).join("");
const HARVEST_TONES = ["leaf-red", "leaf-orange", "leaf-gold", "leaf-brown", "leaf-orange"];
const HARVEST_LEAVES = TWINE_SWAGS.flatMap(({ start, control, end }, swag) => [0.13, 0.31, 0.5, 0.69, 0.87].map((t, place) => {
  const number = swag * 5 + place;
  const at: Point = [
    (1 - t) ** 2 * start[0] + 2 * t * (1 - t) * control[0] + t ** 2 * end[0],
    (1 - t) ** 2 * start[1] + 2 * t * (1 - t) * control[1] + t ** 2 * end[1],
  ];
  return { at, number, size: place === 2 ? 21 : 16 + (number % 3), sway: ((number * 37) % 34) - 17, tone: HARVEST_TONES[number % 5], oak: number % 3 === 1 };
}));
const PIE_CRIMP: Point[] = Array.from({ length: 22 }, (_, index) => {
  const angle = (index / 22) * Math.PI * 2;
  return [Number(fixed(32 + Math.cos(angle) * 22.6)), Number(fixed(56 + Math.sin(angle) * 7.4))];
});
const FEATHER_TONES = ["#8f1d2c", "#d9601b", "#f2a33a", "#7a4519"];
const TURKEY_OUTER = Array.from({ length: 9 }, (_, index) => ({ angle: -72 + index * 18, tone: FEATHER_TONES[index % 4] }));
const TURKEY_INNER = Array.from({ length: 7 }, (_, index) => ({ angle: -57 + index * 19, tone: FEATHER_TONES[(index + 2) % 4] }));

/** A corner web: seven threads out from the corner and six sagging rings, with a few drops of dew. */
const WEB_SIZE = 54;
const WEB_ANGLES = Array.from({ length: 7 }, (_, index) => (index * 15 * Math.PI) / 180);
const webAt = (radius: number, angle: number): Point => [radius * Math.cos(angle), radius * Math.sin(angle)];
const WEB_PATH = WEB_ANGLES.map((angle) => `M0 0L${webAt(WEB_SIZE, angle).map(fixed).join(" ")}`).join("")
  + [0.2, 0.36, 0.52, 0.68, 0.84, 0.98].map((share) => WEB_ANGLES.slice(0, -1).map((angle, index) => {
    const radius = WEB_SIZE * share;
    const from = webAt(radius, angle).map(fixed).join(" ");
    const bend = webAt(radius * 0.86, (angle + WEB_ANGLES[index + 1]) / 2).map(fixed).join(" ");
    const to = webAt(radius, WEB_ANGLES[index + 1]).map(fixed).join(" ");
    return `M${from}Q${bend} ${to}`;
  }).join("")).join("");
const DEW: Point[] = [webAt(WEB_SIZE * 0.52, WEB_ANGLES[2]), webAt(WEB_SIZE * 0.84, WEB_ANGLES[4]), webAt(WEB_SIZE * 0.36, WEB_ANGLES[5]), webAt(WEB_SIZE * 0.68, WEB_ANGLES[1])];

const MAPLE = "M12 1L13.6 5.6L16.4 4.2L15.8 9L20.6 7.4L19 10.6L23 12L18.6 14.4L19.6 16.8L14.6 15.8L13 21L12.4 21L12.4 17.4L11.6 17.4L11.6 21L11 21L9.4 15.8L4.4 16.8L5.4 14.4L1 12L5 10.6L3.4 7.4L8.2 9L7.6 4.2L10.4 5.6Z";
const MAPLE_VEINS = "M12 20V6M12 15L5 11M12 15L19 11M12 15L8 7M12 15L16 7";
const OAK = "M12 2C14 3 13 5 15 6C17 6 17 8 16 9C18 10 18 12 16 13C18 14 17 16 15 16C15 18 13 18 12.5 21H11.5C11 18 9 18 9 16C7 16 6 14 8 13C6 12 6 10 8 9C7 8 7 6 9 6C11 5 10 3 12 2Z";

type Ids = (name: string) => string;
const useIds = (): Ids => {
  const base = useId().replace(/:/g, "");
  return (name) => `${base}-${name}`;
};

function Gradient({ id, stops, x2 = "0", y2 = "1" }: { id: string; stops: string[]; x2?: string; y2?: string }) {
  return (
    <linearGradient id={id} x1="0" x2={x2} y1="0" y2={y2}>
      {stops.map((color, index) => <stop key={index} offset={stops.length === 1 ? 0 : index / (stops.length - 1)} stopColor={color} />)}
    </linearGradient>
  );
}

function Glow({ id, stops }: { id: string; stops: Array<[string, number]> }) {
  return (
    <radialGradient cx="50%" cy="45%" fx="40%" fy="35%" id={id} r="60%">
      {stops.map(([color, opacity], index) => <stop key={index} offset={index / (stops.length - 1)} stopColor={color} stopOpacity={opacity} />)}
    </radialGradient>
  );
}

function Leaf({ x, y, size, angle, fill, oak = false }: { x: number; y: number; size: number; angle: number; fill: string; oak?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size / 24}) translate(-12 -12)`}>
      <path d={oak ? OAK : MAPLE} fill={fill} stroke="#6e2a10" strokeOpacity=".35" strokeWidth=".5" />
      <path d={oak ? "M12 20V4M12 9L9.5 7.5M12 9L14.5 7.5M12 13L8.5 11M12 13L15.5 11M12 16.5L10 15.5M12 16.5L14 15.5" : MAPLE_VEINS} fill="none" stroke="#6e2a10" strokeOpacity=".45" strokeWidth=".6" />
    </g>
  );
}

function Acorn({ x, y, size, angle, ids }: { x: number; y: number; size: number; angle: number; ids: Ids }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size / 16})`}>
      <ellipse cx="0" cy="3" fill={`url(#${ids("nut")})`} rx="5" ry="6.5" />
      <ellipse cx="-1.6" cy="1.5" fill="#fff" opacity=".25" rx="1.2" ry="2.4" />
      <path d="M-6.5 -1.5Q0 -7.5 6.5 -1.5Q0 1 -6.5 -1.5Z" fill="#6b4520" />
      <path d="M-5 -2.5l2 1.5M-2.5 -4l2 1.7M0.5 -4.3l1.8 1.8M3 -3.5l1.6 1.5M-4 -1l1.5 -1.6M-1 -2.4l1.5 -1.6M2 -2.3l1.5 -1.5" stroke="#4a2c10" strokeWidth=".6" />
      <path d="M0 -5Q1 -8 3 -8.5" fill="none" stroke="#4a2c10" strokeLinecap="round" strokeWidth="1.1" />
    </g>
  );
}

function Wheat({ x, y, angle, length }: { x: number; y: number; angle: number; length: number }) {
  const grains = Array.from({ length: 6 }, (_, index) => -length + 3 + index * 3.4);
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <path d={`M0 0Q1 ${-length / 2} 0 ${-length}`} fill="none" stroke="#b8862f" strokeWidth="1" />
      {grains.map((offset, index) => (
        <g key={offset}>
          <ellipse cx="-1.6" cy={offset} fill={index % 2 ? "#e3b55a" : "#d4a043"} rx="1.5" ry="2.6" transform={`rotate(-25 -1.6 ${offset})`} />
          <ellipse cx="1.6" cy={offset + 1.2} fill={index % 2 ? "#d4a043" : "#e3b55a"} rx="1.5" ry="2.6" transform={`rotate(25 1.6 ${offset + 1.2})`} />
        </g>
      ))}
      <path d={`M0 ${-length - 1}l-1.5 -6M0 ${-length - 1}l1.5 -6M0 ${-length - 1}v-7`} stroke="#d4a043" strokeWidth=".5" />
    </g>
  );
}

function JackOLantern({ x, y, r, ids, glow = true }: { x: number; y: number; r: number; ids: Ids; glow?: boolean }) {
  const h = r * 0.82;
  return (
    <g>
      {glow ? <circle cx={x} cy={y} fill={`url(#${ids("halo")})`} r={r * 1.9} /> : null}
      <path d={`M${x} ${y - h - 1}q1 -5 4 -6.5`} fill="none" stroke="#4d6b1f" strokeLinecap="round" strokeWidth={Math.max(2, r * 0.18)} />
      <ellipse cx={x - r * 0.45} cy={y} fill={`url(#${ids("pumpkin")})`} rx={r * 0.6} ry={h} />
      <ellipse cx={x + r * 0.45} cy={y} fill={`url(#${ids("pumpkin")})`} rx={r * 0.6} ry={h} />
      <ellipse cx={x} cy={y} fill={`url(#${ids("pumpkin")})`} rx={r * 0.58} ry={h * 1.02} />
      <path d={`M${x - r * 0.12} ${y - h}Q${x - r * 0.3} ${y} ${x - r * 0.12} ${y + h}M${x + r * 0.12} ${y - h}Q${x + r * 0.3} ${y} ${x + r * 0.12} ${y + h}`} fill="none" stroke="#a8480c" strokeOpacity=".55" strokeWidth=".8" />
      <path d={`M${x - r * 0.55} ${y - r * 0.12}l${r * 0.2} ${-r * 0.32}l${r * 0.2} ${r * 0.32}zM${x + r * 0.15} ${y - r * 0.12}l${r * 0.2} ${-r * 0.32}l${r * 0.2} ${r * 0.32}zM${x - r * 0.08} ${y + r * 0.05}l${r * 0.08} ${-r * 0.14}l${r * 0.08} ${r * 0.14}zM${x - r * 0.55} ${y + r * 0.22}q${r * 0.55} ${r * 0.5} ${r * 1.1} 0l${-r * 0.16} ${r * 0.08}l${-r * 0.1} ${-r * 0.1}l${-r * 0.12} ${r * 0.14}l${-r * 0.12} ${-r * 0.14}l${-r * 0.12} ${r * 0.14}l${-r * 0.1} ${-r * 0.12}z`} fill={`url(#${ids("candle")})`} />
      <ellipse cx={x - r * 0.62} cy={y - h * 0.45} fill="#fff" opacity=".22" rx={r * 0.14} ry={h * 0.3} />
    </g>
  );
}

function Bat({ x, y, scale }: { x: number; y: number; scale: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M0 2C3-3 7-3 9 1C10-1 11-1 11.5 0.5C12-1 13-1 14 1C16-3 20-3 23 2C20 1.5 18 3 17.5 5C16 3.5 14 4 12.5 6.5L11.5 7.5L10.5 6.5C9 4 7 3.5 5.5 5C5 3 3 1.5 0 2Z" fill="#0a0710" />
      <circle cx="10.6" cy="2.4" fill="#f6c453" r=".45" /><circle cx="12.4" cy="2.4" fill="#f6c453" r=".45" />
    </g>
  );
}

function Snowflake({ x, y, r, opacity = 0.85 }: { x: number; y: number; r: number; opacity?: number }) {
  const arms = [0, 60, 120].map((degrees) => (degrees * Math.PI) / 180);
  const d = arms.map((angle) => `M${fixed(x - Math.cos(angle) * r)} ${fixed(y - Math.sin(angle) * r)}L${fixed(x + Math.cos(angle) * r)} ${fixed(y + Math.sin(angle) * r)}`).join("");
  return <path d={d} opacity={opacity} stroke="#fff" strokeLinecap="round" strokeWidth=".9" />;
}

function HalloweenDefs({ ids }: { ids: Ids }) {
  return (
    <defs>
      <radialGradient cx="45%" cy="40%" id={ids("pumpkin")} r="70%"><stop offset="0" stopColor="#ffb54d" /><stop offset=".6" stopColor="#ef7a1a" /><stop offset="1" stopColor="#a8480c" /></radialGradient>
      <Gradient id={ids("candle")} stops={["#fff6c2", "#ffc233", "#ff8a00"]} />
      <Glow id={ids("halo")} stops={[["#ff9a1f", 0.5], ["#ff9a1f", 0.12], ["#ff9a1f", 0]]} />
      <Glow id={ids("moon")} stops={[["#fffdf0", 1], ["#f8e6a8", 1], ["#e9c86a", 1]]} />
      <Glow id={ids("moonglow")} stops={[["#f8e6a8", 0.35], ["#f8e6a8", 0.08], ["#f8e6a8", 0]]} />
      <Gradient id={ids("stone")} stops={["#7d6c9a", "#4b3d66"]} />
      <Gradient id={ids("body")} stops={["#4d3a6b", "#0a0710"]} />
      <Gradient id={ids("fog")} stops={["#cdb8f0", "#cdb8f0"]} x2="1" y2="0" />
    </defs>
  );
}

function ThanksgivingDefs({ ids }: { ids: Ids }) {
  return (
    <defs>
      <Gradient id={ids("leaf-orange")} stops={["#f7b244", "#d9601b"]} />
      <Gradient id={ids("leaf-red")} stops={["#d9452f", "#7d1623"]} />
      <Gradient id={ids("leaf-gold")} stops={["#f6d26b", "#d98a1f"]} />
      <Gradient id={ids("leaf-brown")} stops={["#c8803a", "#7a4519"]} />
      <Gradient id={ids("nut")} stops={["#c98a45", "#7a4a1c"]} />
      <Gradient id={ids("horn")} stops={["#ecc37a", "#c48d3d", "#8f5c22"]} />
      <radialGradient cx="60%" cy="50%" id={ids("mouth")} r="60%"><stop offset="0" stopColor="#2a1606" /><stop offset="1" stopColor="#5e3a12" /></radialGradient>
      <radialGradient cx="40%" cy="35%" id={ids("pumpkin")} r="70%"><stop offset="0" stopColor="#ffb54d" /><stop offset=".65" stopColor="#e5761c" /><stop offset="1" stopColor="#a8480c" /></radialGradient>
      <radialGradient cx="35%" cy="30%" id={ids("apple")} r="70%"><stop offset="0" stopColor="#f0605a" /><stop offset="1" stopColor="#8f1d2c" /></radialGradient>
      <radialGradient cx="35%" cy="30%" id={ids("pear")} r="75%"><stop offset="0" stopColor="#e9e27a" /><stop offset="1" stopColor="#9aa33a" /></radialGradient>
      <radialGradient cx="35%" cy="30%" id={ids("grape")} r="70%"><stop offset="0" stopColor="#a87bc4" /><stop offset="1" stopColor="#4b2563" /></radialGradient>
      <Gradient id={ids("corn")} stops={["#fbe08a", "#e2a93a"]} />
      <Gradient id={ids("turkey")} stops={["#a8743f", "#5a3416"]} />
      <radialGradient cx="40%" cy="35%" id={ids("turkey-head")} r="70%"><stop offset="0" stopColor="#c48a52" /><stop offset="1" stopColor="#7a4a22" /></radialGradient>
      <radialGradient cx="45%" cy="40%" id={ids("pie")} r="65%"><stop offset="0" stopColor="#e08a3a" /><stop offset="1" stopColor="#a4501c" /></radialGradient>
      <Gradient id={ids("tin")} stops={["#d9dde1", "#7d858c"]} />
    </defs>
  );
}

function ChristmasDefs({ ids }: { ids: Ids }) {
  return (
    <defs>
      <radialGradient cx="35%" cy="30%" id={ids("red")} r="70%"><stop offset="0" stopColor="#ff8a80" /><stop offset=".55" stopColor="#d62828" /><stop offset="1" stopColor="#7d0f14" /></radialGradient>
      <radialGradient cx="35%" cy="30%" id={ids("gold")} r="70%"><stop offset="0" stopColor="#fff2b8" /><stop offset=".55" stopColor="#f2c94c" /><stop offset="1" stopColor="#a97c14" /></radialGradient>
      <radialGradient cx="35%" cy="30%" id={ids("silver")} r="70%"><stop offset="0" stopColor="#ffffff" /><stop offset=".55" stopColor="#bcd3e0" /><stop offset="1" stopColor="#6d8796" /></radialGradient>
      <Gradient id={ids("bow")} stops={["#ef4444", "#9d0208"]} />
      <Gradient id={ids("tree")} stops={["#4fae6d", "#1f5a30"]} />
      <Gradient id={ids("snow")} stops={["#ffffff", "#dfe9f0"]} />
      <Gradient id={ids("box-red")} stops={["#e63946", "#a4161a"]} x2="1" y2="0" />
      <Gradient id={ids("box-gold")} stops={["#f6d26b", "#c9971f"]} x2="1" y2="0" />
      <Gradient id={ids("box-white")} stops={["#ffffff", "#d7e3ea"]} x2="1" y2="0" />
      <Glow id={ids("starglow")} stops={[["#fff2b8", 0.7], ["#f2c94c", 0.15], ["#f2c94c", 0]]} />
    </defs>
  );
}

function Bauble({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  return (
    <g>
      <path d={`M${x} ${y - r - 3}V${y - r}`} stroke="#c9a227" strokeWidth=".6" />
      <rect fill="#c9a227" height="2.2" rx=".5" width={r * 0.9} x={x - r * 0.45} y={y - r - 1.6} />
      <circle cx={x} cy={y} fill={fill} r={r} />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} fill="#fff" opacity=".55" r={r * 0.22} />
    </g>
  );
}

/** Across the top of the paper, over the week's name. */
export function PadSkinTop({ skin }: { skin: PadSkin }) {
  const ids = useIds();
  if (skin === "halloween") {
    return (
      <div aria-hidden="true" className="pad-skin-top">
        <svg className="pad-skin-defs" height="0" width="0"><HalloweenDefs ids={ids} /></svg>
        <svg className="pad-skin-web" height={WEB_SIZE} viewBox={`0 0 ${WEB_SIZE} ${WEB_SIZE}`} width={WEB_SIZE}>
          <path d={WEB_PATH} fill="none" stroke="#c4b2e8" strokeOpacity=".6" strokeWidth=".7" />
          {DEW.map(([x, y]) => <circle cx={x} cy={y} fill="#f1eaff" key={`${x}`} opacity=".85" r="1" />)}
        </svg>
        <svg className="pad-skin-moon" height="48" viewBox="0 0 64 48" width="64">
          <circle cx="24" cy="23" fill={`url(#${ids("moonglow")})`} r="24" />
          <circle cx="24" cy="23" fill={`url(#${ids("moon")})`} r="14" />
          <circle cx="19" cy="19" fill="#e2c063" opacity=".45" r="2.6" /><circle cx="29" cy="27" fill="#e2c063" opacity=".4" r="3.4" /><circle cx="27" cy="16" fill="#e2c063" opacity=".35" r="1.4" />
          <Bat scale={0.62} x={12} y={22} />
          <Bat scale={0.48} x={44} y={9} />
          <Bat scale={0.36} x={52} y={26} />
        </svg>
        <svg className="pad-skin-spider" height="54" viewBox="0 0 36 54" width="36">
          <path d="M18 0V24" stroke="#ece4f8" strokeOpacity=".9" strokeWidth=".8" />
          <g fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 28L6 20L2 25M13.5 31L4 28L0 34M13.5 34L4 37L2 44M14.5 37L9 44L8 51M22 28L30 20L34 25M22.5 31L32 28L36 34M22.5 34L32 37L34 44M21.5 37L27 44L28 51" stroke="#7b5aa8" strokeWidth="2.6" />
            <path d="M14 28L6 20L2 25M13.5 31L4 28L0 34M13.5 34L4 37L2 44M14.5 37L9 44L8 51M22 28L30 20L34 25M22.5 31L32 28L36 34M22.5 34L32 37L34 44M21.5 37L27 44L28 51" stroke="#0a0710" strokeWidth="1.4" />
          </g>
          <ellipse cx="18" cy="38" fill={`url(#${ids("body")})`} rx="7" ry="8.5" stroke="#8b6fc0" strokeWidth=".8" />
          <path d="M16 35.5h4l-1.4 2.5 1.4 2.5h-4l1.4-2.5z" fill="#e0372b" />
          <circle cx="18" cy="28" fill={`url(#${ids("body")})`} r="4.6" stroke="#8b6fc0" strokeWidth=".8" />
          <circle cx="16.4" cy="27.4" fill="#9be35a" r="1.1" /><circle cx="19.6" cy="27.4" fill="#9be35a" r="1.1" />
          <circle cx="16.1" cy="27.1" fill="#fff" r=".35" /><circle cx="19.3" cy="27.1" fill="#fff" r=".35" />
          <path d="M16.8 31.6l.6 1.4M19.2 31.6l-.6 1.4" stroke="#e9e1f5" strokeLinecap="round" strokeWidth=".6" />
        </svg>
      </div>
    );
  }
  if (skin === "thanksgiving") {
    return (
      <div aria-hidden="true" className="pad-skin-top">
        <svg className="pad-skin-defs" height="0" width="0"><ThanksgivingDefs ids={ids} /></svg>
        <svg className="pad-skin-garland" height="44" preserveAspectRatio="xMidYMin slice" viewBox="0 0 480 44">
          <path d={TWINE} fill="none" stroke="#d9b779" strokeWidth="1.6" />
          <path d={TWINE} fill="none" stroke="#8a6a3a" strokeDasharray="1.2 2.2" strokeWidth="1.6" />
          {HARVEST_LEAVES.map(({ at: [x, y], number, size, sway, tone, oak }) => (
            <g key={number}>
              <path d={`M${fixed(x)} ${fixed(y)}v3`} stroke="#6e4a20" strokeWidth=".8" />
              <Leaf angle={180 + sway} fill={`url(#${ids(tone)})`} oak={oak} size={size} x={x} y={y + 2 + size * 0.45} />
            </g>
          ))}
          {TWINE_SWAGS.map(({ start }) => <g key={start[0]}><Acorn angle={-20} ids={ids} size={11} x={start[0] - 3} y={9} /><Acorn angle={22} ids={ids} size={10} x={start[0] + 4} y={10} /></g>)}
        </svg>
        <svg className="pad-skin-flakes" height="40" viewBox="0 0 120 40" width="120">
          <g opacity=".9"><Leaf angle={-35} fill={`url(#${ids("leaf-orange")})`} size={14} x={14} y={31} /><Leaf angle={50} fill={`url(#${ids("leaf-gold")})`} oak size={12} x={56} y={33} /><Leaf angle={-70} fill={`url(#${ids("leaf-red")})`} size={12} x={100} y={30} /></g>
        </svg>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="pad-skin-top">
        <svg className="pad-skin-defs" height="0" width="0"><ChristmasDefs ids={ids} /></svg>
      <svg className="pad-skin-garland" height="40" preserveAspectRatio="xMidYMin slice" viewBox="0 0 480 40">
        <path d={GARLAND_LINE} fill="none" stroke="#163f26" strokeLinecap="round" strokeWidth="7" />
        <path d={GARLAND_DARK} stroke="#2a6b3d" strokeLinecap="round" strokeWidth="1.3" />
        <path d={GARLAND_LIGHT} stroke="#5fae72" strokeLinecap="round" strokeWidth="1" />
        <path d={BEADS} fill="none" stroke="#f2c94c" strokeDasharray="0 4.5" strokeLinecap="round" strokeWidth="2.4" />
        {SWAGS.map(({ start }, index) => (
          <g key={start[0]}>
            <Bauble fill={`url(#${ids(index % 2 ? "gold" : "red")})`} r={5} x={start[0] + 40} y={29} />
            <Bauble fill={`url(#${ids("silver")})`} r={3.4} x={start[0] + 16} y={17} />
            <Bauble fill={`url(#${ids(index % 2 ? "red" : "gold")})`} r={3.4} x={start[0] + 64} y={17} />
          </g>
        ))}
      </svg>
      <svg className="pad-skin-flakes" height="40" viewBox="0 0 120 40" width="120">
        <Snowflake r={3.5} x={14} y={34} /><Snowflake opacity={0.6} r={2.4} x={50} y={36} /><Snowflake opacity={0.7} r={3} x={98} y={33} />
      </svg>
      <svg className="pad-skin-wreath" height="58" viewBox="0 0 44 58" width="44">
        <path d="M22 0V10" stroke="#f2c94c" strokeWidth="1.2" />
        <circle cx="22" cy="27" fill="none" r="12.5" stroke="#163f26" strokeWidth="8" />
        <path d={WREATH_DARK} stroke="#2a6b3d" strokeLinecap="round" strokeWidth="1.2" />
        <path d={WREATH_LIGHT} stroke="#6fbf7e" strokeLinecap="round" strokeWidth=".9" />
        <ellipse cx="11" cy="17" fill="#7a4a22" rx="2.6" ry="3.6" transform="rotate(-40 11 17)" />
        <path d="M9.5 15.5l3 1M9.5 17.5l3 1M10.5 19l2 .6" stroke="#4a2c10" strokeWidth=".5" />
        {[[31, 18], [33.5, 20.5], [30, 21], [12, 34], [9.5, 31.5], [13.5, 37]].map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} fill="#d62828" r="1.9" /><circle cx={x - 0.6} cy={y - 0.6} fill="#fff" opacity=".6" r=".5" /></g>)}
        <path d="M22 40C17 34 10 35 11 40C12 44 18 42 22 40ZM22 40C27 34 34 35 33 40C32 44 26 42 22 40Z" fill={`url(#${ids("bow")})`} />
        <path d="M21 41C19 46 17 50 14 53M23 41C25 46 27 50 30 53" fill="none" stroke="#b5121b" strokeLinecap="round" strokeWidth="2.6" />
        <rect fill="#9d0208" height="5" rx="1.5" width="5" x="19.5" y="37.5" />
      </svg>
    </div>
  );
}

/** A scene under the last row. */
export function PadSkinFoot({ skin }: { skin: PadSkin }) {
  const ids = useIds();
  if (skin === "halloween") {
    const posts = Array.from({ length: 49 }, (_, index) => index * 10);
    return (
      <div aria-hidden="true" className="pad-skin-foot">
        <svg className="pad-skin-defs" height="0" width="0"><HalloweenDefs ids={ids} /></svg>
        <svg className="pad-skin-backdrop" height="62" preserveAspectRatio="xMidYMax slice" viewBox="0 0 480 62">
          <path d="M0 62V40Q60 26 130 36T260 30T380 38T480 28V62Z" fill="#241638" />
          <rect fill={`url(#${ids("fog")})`} height="10" opacity=".08" width="480" y="40" />
          <path d={posts.map((x) => `M${x} 60V46l1.2-3.2 1.2 3.2V60z`).join("") + "M0 48.5h480v1.4H0zM0 55h480v1.4H0z"} fill="#0d0816" />
        </svg>
        <svg height="56" viewBox="0 0 96 56" width="96">
          <JackOLantern ids={ids} r={16} x={26} y={38} />
          <JackOLantern ids={ids} r={10} x={60} y={44} />
          <path d="M42 52q6-7 10-4q3 2 6-1" fill="none" stroke="#4d6b1f" strokeWidth="1.3" />
        </svg>
        <svg height="56" viewBox="0 0 60 56" width="60">
          <path d="M8 56V30a9 9 0 0 1 18 0V56z" fill={`url(#${ids("stone")})`} />
          <path d="M14 34h6M17 31v9" stroke="#2c2040" strokeLinecap="round" strokeWidth="1.6" />
          <path d="M8 52q4-3 8 0t10 0" fill="none" stroke="#5b7a2a" strokeWidth="1.5" />
          <path d="M33 56V40a7 7 0 0 1 14 0V56z" fill={`url(#${ids("stone")})`} />
          <text fill="#2c2040" fontFamily="Georgia, serif" fontSize="5" fontWeight="700" textAnchor="middle" x="40" y="45">RIP</text>
        </svg>
        <svg height="56" viewBox="0 0 92 56" width="92">
          <path d="M70 56V22l-3-6 6-1-1 7V56M66 26q-8-6-12-14M70 30q8-8 14-10M84 20l5-4M84 20q2 4 6 4M54 12l-4-4M54 12q-4 1-6-1" fill="none" stroke="#0d0816" strokeLinecap="round" strokeWidth="2.4" />
          <path d="M4 56V24h12V56zM2 25l8-17 8 17zM16 56V30L34 14l18 16V56zM40 22h4v-8h-4z" fill="#0d0816" />
          {[[7, 30], [7, 40], [21, 36], [43, 36], [21, 45]].map(([x, y]) => <rect fill="#f7c948" height="5" key={`${x}-${y}`} opacity=".92" width="4" x={x} y={y} />)}
          <path d="M30 56V46a4 4 0 0 1 8 0V56z" fill="#3a2410" />
          <circle cx="34" cy="26" fill="#f7c948" opacity=".85" r="2.4" />
        </svg>
      </div>
    );
  }
  if (skin === "thanksgiving") {
    const grapes: Point[] = [[98, 30], [104, 31], [101, 36], [107, 36], [95, 35], [104, 41], [98, 40]];
    const kernels = Array.from({ length: 14 }, (_, index) => [8 + (index % 7) * 3.6, index < 7 ? -1.6 : 1.6] as Point);
    return (
      <div aria-hidden="true" className="pad-skin-foot">
        <svg className="pad-skin-defs" height="0" width="0"><ThanksgivingDefs ids={ids} /></svg>
        <svg height="72" viewBox="0 0 76 72" width="76">
          <Wheat angle={-24} length={34} x={14} y={62} />
          <Wheat angle={-8} length={40} x={18} y={62} />
          <ellipse cx="34" cy="69" fill="#000" opacity=".22" rx="28" ry="3" />
          <path d="M8 56L12 66Q32 72 52 66L56 56Z" fill={`url(#${ids("tin")})`} />
          <ellipse cx="32" cy="56" fill="#c4913f" rx="25" ry="8.6" />
          <ellipse cx="32" cy="56" fill={`url(#${ids("pie")})`} rx="20.5" ry="6.4" />
          {PIE_CRIMP.map(([x, y]) => <circle cx={x} cy={y} fill="#ecc27a" key={`${x}-${y}`} r="2.3" stroke="#c4913f" strokeWidth=".4" />)}
          <ellipse cx="32" cy="54.6" fill="#fffaf0" rx="6.4" ry="2.8" />
          <ellipse cx="32" cy="52.4" fill="#fffdf7" rx="4.6" ry="2.2" />
          <ellipse cx="32" cy="50.6" fill="#ffffff" rx="2.8" ry="1.5" />
          <path d="M32 49.4q.6-1.6 1.4-2" fill="none" stroke="#ffffff" strokeLinecap="round" strokeWidth="1.2" />
          <ellipse cx="64" cy="63" fill={`url(#${ids("pumpkin")})`} rx="5.5" ry="7" />
          <ellipse cx="70" cy="63" fill={`url(#${ids("pumpkin")})`} rx="5" ry="6.5" />
          <ellipse cx="67" cy="63" fill={`url(#${ids("pumpkin")})`} rx="5" ry="7.3" />
          <path d="M67 56q-.5-3 2-4" fill="none" stroke="#5b6b2a" strokeLinecap="round" strokeWidth="1.8" />
        </svg>
        <svg height="72" viewBox="0 0 70 72" width="70">
          <ellipse cx="35" cy="69" fill="#000" opacity=".22" rx="16" ry="2.6" />
          {TURKEY_OUTER.map(({ angle, tone }) => (
            <g key={angle} transform={`rotate(${angle} 35 46)`}>
              <path d="M35 46C29.5 32 29.5 18 35 10C40.5 18 40.5 32 35 46Z" fill={tone} stroke="#2a1606" strokeOpacity=".35" strokeWidth=".5" />
              <path d="M35 44V14" stroke="#2a1606" strokeOpacity=".25" strokeWidth=".6" />
              <ellipse cx="35" cy="15.5" fill="#2a1606" opacity=".55" rx="2.2" ry="3.2" />
              <ellipse cx="35" cy="15.5" fill="#f6d26b" opacity=".8" rx=".9" ry="1.4" />
            </g>
          ))}
          {TURKEY_INNER.map(({ angle, tone }) => (
            <path d="M35 46C31.5 36 31.5 26 35 20C38.5 26 38.5 36 35 46Z" fill={tone} key={angle} stroke="#2a1606" strokeOpacity=".3" strokeWidth=".5" transform={`rotate(${angle} 35 46)`} />
          ))}
          <ellipse cx="35" cy="50" fill={`url(#${ids("turkey")})`} rx="12" ry="13" />
          <ellipse cx="26.5" cy="52" fill="#5a3416" rx="4.6" ry="8" transform="rotate(14 26.5 52)" />
          <ellipse cx="43.5" cy="52" fill="#5a3416" rx="4.6" ry="8" transform="rotate(-14 43.5 52)" />
          <path d="M28 56q7 5 14 0" fill="none" stroke="#c48a52" strokeOpacity=".5" strokeWidth="1" />
          <path d="M31 62.5l-1 6m0 0l-2.4 1.4m2.4-1.4l.2 2m-.2-2l2.4 1M39 62.5l1 6m0 0l2.4 1.4m-2.4-1.4l-.2 2m.2-2l-2.4 1" fill="none" stroke="#e8902a" strokeLinecap="round" strokeWidth="1.4" />
          <circle cx="35" cy="34" fill={`url(#${ids("turkey-head")})`} r="6.6" />
          <circle cx="32.6" cy="32.6" fill="#fff" r="1.8" /><circle cx="37.4" cy="32.6" fill="#fff" r="1.8" />
          <circle cx="33" cy="32.9" fill="#1a0f08" r=".9" /><circle cx="37" cy="32.9" fill="#1a0f08" r=".9" />
          <circle cx="33.3" cy="32.5" fill="#fff" r=".3" /><circle cx="37.3" cy="32.5" fill="#fff" r=".3" />
          <path d="M33.4 35.4h3.2L35 38.6z" fill="#f2a33a" />
          <path d="M36.2 36.6q2.4 2 1 6q-1.8-1.6-1.4-5z" fill="#d62828" />
        </svg>
        <svg height="64" viewBox="0 0 212 80" width="170">
          <ellipse cx="110" cy="74" fill="#5e3a12" opacity=".14" rx="104" ry="5" />
          <path d="M114 22C140 14 170 22 192 10C202 5 210 10 204 17C199 22 192 19 195 14C180 42 158 68 114 72Z" fill={`url(#${ids("horn")})`} />
          <path d="M126 19Q132 44 124 71M142 17Q149 40 140 68M158 18Q164 36 156 62M173 15Q178 30 172 50M186 11Q190 22 186 36" fill="none" stroke="#7a4a18" strokeOpacity=".55" strokeWidth="1.4" />
          <path d="M116 34C142 30 166 30 188 18M116 50C142 46 162 40 182 30M116 63C138 61 154 55 168 47" fill="none" stroke="#f6dca0" strokeOpacity=".7" strokeWidth="1.1" />
          <ellipse cx="114" cy="47" fill={`url(#${ids("mouth")})`} rx="10" ry="25" />
          <ellipse cx="114" cy="47" fill="none" rx="10" ry="25" stroke="#e2b46a" strokeWidth="2" />
          {grapes.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} fill={`url(#${ids("grape")})`} r="3.6" /><circle cx={x - 1} cy={y - 1.2} fill="#fff" opacity=".35" r=".9" /></g>)}
          <path d="M101 27q2-5 6-6" fill="none" stroke="#5e3a12" strokeWidth="1.2" />
          <Leaf angle={-60} fill={`url(#${ids("leaf-gold")})`} size={14} x={110} y={24} />
          <g>
            <ellipse cx="80" cy="56" fill={`url(#${ids("pumpkin")})`} rx="9" ry="13" />
            <ellipse cx="94" cy="56" fill={`url(#${ids("pumpkin")})`} rx="9" ry="13" />
            <ellipse cx="87" cy="56" fill={`url(#${ids("pumpkin")})`} rx="9" ry="13.5" />
            <path d="M83 44Q80 56 83 69M91 44Q94 56 91 69" fill="none" stroke="#a8480c" strokeOpacity=".5" strokeWidth=".9" />
            <path d="M87 43q-1-5 3-7" fill="none" stroke="#5b6b2a" strokeLinecap="round" strokeWidth="2.4" />
          </g>
          <circle cx="62" cy="62" fill={`url(#${ids("apple")})`} r="9" />
          <path d="M62 53q0-3 2-5" stroke="#5e3a12" strokeWidth="1.3" />
          <path d="M64 50q6-3 8 1q-5 2-8-1z" fill="#6b8a2a" />
          <circle cx="58.5" cy="58.5" fill="#fff" opacity=".35" r="2" />
          <path d="M40 70c-7 0-9-7-6-11c2-3 3-6 3-9c0-3 2-5 4-5s4 2 4 5c0 3 1 6 3 9c3 4 1 11-6 11z" fill={`url(#${ids("pear")})`} />
          <path d="M41 45q1-4 4-5" stroke="#5e3a12" strokeWidth="1.2" />
          <g transform="rotate(-14 22 66)">
            <ellipse cx="22" cy="66" fill={`url(#${ids("corn")})`} rx="16" ry="5.4" />
            {kernels.map(([x, y], index) => <circle cx={x + 2} cy={66 + y} fill="#f8cf5a" key={index} r="1.2" stroke="#d99a2a" strokeWidth=".3" />)}
            <path d="M36 66C42 58 48 60 52 56C46 64 42 66 36 68ZM36 66C42 72 50 72 54 76C46 72 40 72 36 68Z" fill="#a3b55a" />
          </g>
          <Leaf angle={20} fill={`url(#${ids("leaf-red")})`} size={16} x={10} y={50} />
          <Leaf angle={-35} fill={`url(#${ids("leaf-brown")})`} oak size={15} x={70} y={74} />
        </svg>
      </div>
    );
  }
  return (
    <div aria-hidden="true" className="pad-skin-foot">
        <svg className="pad-skin-defs" height="0" width="0"><ChristmasDefs ids={ids} /></svg>
      <svg className="pad-skin-backdrop" height="62" preserveAspectRatio="xMidYMax slice" viewBox="0 0 480 62">
        <path d="M0 62V40Q50 30 110 40T230 34T350 40T480 32V62Z" fill="#dfe9f0" />
        <path d="M0 62V48Q70 38 150 48T300 44T480 46V62Z" fill={`url(#${ids("snow")})`} />
        {[[40, 52], [120, 50], [200, 56], [268, 49], [340, 55], [420, 50], [460, 57]].map(([x, y]) => <path d={`M${x - 2} ${y}h4M${x} ${y - 2}v4`} key={x} stroke="#fff" strokeLinecap="round" strokeWidth=".8" />)}
      </svg>
      <svg height="58" viewBox="0 0 48 58" width="48">
        <circle cx="24" cy="7" fill={`url(#${ids("starglow")})`} r="9" />
        <path d="M24 40L4 46Q24 41 44 46ZM24 30L6 44Q24 38 42 44ZM24 18L9 34Q24 29 39 34ZM24 8L13 22Q24 18 35 22Z" fill={`url(#${ids("tree")})`} />
        <path d="M12 27Q24 32 34 25M9 38Q24 43 39 35" fill="none" stroke="#f2c94c" strokeWidth="1" />
        {[[16, 21, "red"], [30, 23, "gold"], [20, 31, "silver"], [33, 33, "red"], [13, 40, "gold"], [26, 40, "red"], [38, 42, "silver"]].map(([x, y, tone]) => <circle cx={x} cy={y} fill={`url(#${ids(String(tone))})`} key={`${x}-${y}`} r="1.8" />)}
        <path d="M24 2.5l1.3 2.9 3.2.3-2.4 2.1.7 3.1-2.8-1.6-2.8 1.6.7-3.1-2.4-2.1 3.2-.3z" fill={`url(#${ids("gold")})`} />
        <rect fill="#6b3f1d" height="8" width="6" x="21" y="45" />
      </svg>
      <svg height="58" viewBox="0 0 74 58" width="74">
        <rect fill={`url(#${ids("box-red")})`} height="24" width="28" x="4" y="32" />
        <rect fill="#c1121f" height="7" width="32" x="2" y="27" />
        <path d="M16 27v29h4V27zM2 29.5h32v2.4H2z" fill="#f2c94c" />
        <path d="M18 27C12 18 4 22 9 26C11 27.5 15 27.5 18 27ZM18 27C24 18 32 22 27 26C25 27.5 21 27.5 18 27Z" fill="#f2c94c" stroke="#c9971f" strokeWidth=".6" />
        <rect fill={`url(#${ids("box-white")})`} height="17" width="20" x="38" y="39" />
        <rect fill="#e9f0f4" height="5" width="23" x="36.5" y="35" />
        <path d="M46.5 35v21h3V35zM36.5 36.8h23v1.8h-23z" fill="#d62828" />
        <path d="M48 35C44 29 38 31 41 34C42.5 35.2 45.5 35.4 48 35ZM48 35C52 29 58 31 55 34C53.5 35.2 50.5 35.4 48 35Z" fill={`url(#${ids("bow")})`} />
        <rect fill={`url(#${ids("box-gold")})`} height="12" width="13" x="58" y="44" />
        <path d="M63.5 44v12h2V44z" fill="#2a6b3d" />
        <path d="M70 18c0-6-8-6-8 0v24" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth="3.2" />
        <path d="M70 18c0-6-8-6-8 0v24" fill="none" stroke="#d62828" strokeDasharray="2.5 2.5" strokeLinecap="butt" strokeWidth="3.2" />
      </svg>
    </div>
  );
}

/** What stands in for a pick still hidden until kickoff: a ghost, a covered dish, a wrapped gift. */
export function PadSkinHidden({ skin }: { skin: PadSkin }) {
  if (skin === "halloween") {
    return (
      <svg aria-hidden="true" className="pad-skin-hidden" height="20" viewBox="0 0 16 16" width="20">
        <path d="M3.500 14.500V7.500a4.500 4.500 0 0 1 9 0v7l-1.500-1.200-1.500 1.200-1.500-1.200-1.500 1.200-1.500-1.200z" fill="#f4eefc" stroke="#b9a6e0" strokeWidth=".6" />
        <ellipse cx="6.400" cy="7.600" fill="#1a1024" rx=".9" ry="1.200" /><ellipse cx="9.600" cy="7.600" fill="#1a1024" rx=".9" ry="1.200" />
        <ellipse cx="8" cy="10.200" fill="#1a1024" rx=".7" ry=".9" />
      </svg>
    );
  }
  if (skin === "thanksgiving") {
    return (
      <svg aria-hidden="true" className="pad-skin-hidden" height="20" viewBox="0 0 16 16" width="20">
        <path d="M2.500 11.500a5.500 5.500 0 0 1 11 0z" fill="#d9d4cc" stroke="#7a6f62" strokeWidth=".6" />
        <path d="M4.200 9.600a4 4 0 0 1 2.400-3" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth=".9" />
        <rect fill="#a8742c" height="1.600" rx=".6" width="14" x="1" y="11.500" />
        <circle cx="8" cy="4.600" fill="#7a6f62" r="1" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" className="pad-skin-hidden" height="20" viewBox="0 0 16 16" width="20">
      <rect fill="#d62828" height="8" width="11" x="2.500" y="6.500" />
      <rect fill="#e63946" height="2.600" width="13" x="1.500" y="4.500" />
      <path d="M7 4.500h2v10H7z" fill="#f2c94c" />
      <path d="M8 4.500C6.200 1.600 3.800 2.300 4.800 3.900 5.400 4.700 6.800 4.700 8 4.500zM8 4.500c1.800-2.900 4.200-2.200 3.200-.6C10.600 4.700 9.200 4.700 8 4.500z" fill="#f2c94c" />
    </svg>
  );
}
