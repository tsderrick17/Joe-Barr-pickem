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
const MAPLE_HALF = "M12 1L13.6 5.6L16.4 4.2L15.8 9L20.6 7.4L19 10.6L23 12L18.6 14.4L19.6 16.8L14.6 15.8L13 21L12 21Z";
const OAK_HALF = "M12 2C14 3 13 5 15 6C17 6 17 8 16 9C18 10 18 12 16 13C18 14 17 16 15 16C15 18 13 18 12.5 21H12Z";
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

function Leaf({ x, y, size, angle, fill, oak = false, edge, stem = false }: { x: number; y: number; size: number; angle: number; fill: string; oak?: boolean; edge?: string; stem?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size / 24}) translate(-12 ${stem ? -21 : -12})`}>
      <path d={oak ? OAK : MAPLE} fill={fill} stroke={edge ?? "#6e2a10"} strokeOpacity={edge ? 0.9 : 0.35} strokeWidth={edge ? 0.7 : 0.5} />
      <path d={oak ? OAK_HALF : MAPLE_HALF} fill="#3a1408" opacity=".2" />
      <path d={oak ? "M12 20V4M12 9L9.5 7.5M12 9L14.5 7.5M12 13L8.5 11M12 13L15.5 11M12 16.5L10 15.5M12 16.5L14 15.5" : MAPLE_VEINS} fill="none" stroke={edge ?? "#6e2a10"} strokeOpacity={edge ? 0.7 : 0.45} strokeWidth=".6" />
    </g>
  );
}

/** An heirloom pumpkin: three lobes, soft ribs, a curled stem and a fine gold tendril. */
function Heirloom({ x, y, rx, ry, fill, rib }: { x: number; y: number; rx: number; ry: number; fill: string; rib: string }) {
  const ribs = [0.2, 0.62].map((share) => `M${fixed(x - rx * share)} ${fixed(y - ry * 0.92)}Q${fixed(x - rx * (share + 0.2))} ${y} ${fixed(x - rx * share)} ${fixed(y + ry * 0.92)}M${fixed(x + rx * share)} ${fixed(y - ry * 0.92)}Q${fixed(x + rx * (share + 0.2))} ${y} ${fixed(x + rx * share)} ${fixed(y + ry * 0.92)}`).join("");
  return (
    <g>
      <ellipse cx={x - rx * 0.48} cy={y} fill={fill} rx={rx * 0.56} ry={ry * 0.93} />
      <ellipse cx={x + rx * 0.48} cy={y} fill={fill} rx={rx * 0.56} ry={ry * 0.93} />
      <ellipse cx={x} cy={y} fill={fill} rx={rx * 0.6} ry={ry} />
      <path d={ribs} fill="none" stroke={rib} strokeOpacity=".55" strokeWidth=".8" />
      <ellipse cx={x - rx * 0.55} cy={y - ry * 0.3} fill="#fff" opacity=".1" rx={rx * 0.1} ry={ry * 0.38} />
      <path d={`M${fixed(x - 1.6)} ${fixed(y - ry + 1.5)}q-.6-5 2.6-7.4l1.8 1.2q-2.6 2-1.4 6.2z`} fill="#6b5a32" />
      <path d={`M${fixed(x + 1.5)} ${fixed(y - ry - 3)}q5-3.4 7.4.6q.8 3-2 3q-2-.8 0-2.4`} fill="none" stroke="#7a8a3a" strokeLinecap="round" strokeWidth=".8" />
    </g>
  );
}

/** A bough reaching in from a top corner: two layers of oak and maple leaves on their twig, acorns and bittersweet. */
function Bough({ ids }: { ids: Ids }) {
  const fill = (name: string) => `url(#${ids(name)})`;
  return (
    <g>
      <Leaf angle={158} fill={fill("leaf-rust")} oak size={25} stem x={11.600} y={5.500} />
      <Leaf angle={62} fill={fill("leaf-rust")} size={21} stem x={32.800} y={12.600} />
      <Leaf angle={118} fill={fill("leaf-olive")} oak size={22} stem x={49} y={6.600} />
      <Leaf angle={228} fill={fill("leaf-olive")} size={20} stem x={56.600} y={28.200} />
      <path d="M-2 3C20 6 46 14 66 38M25.700 9.700C40 7 58 4 72 10M30 11l-1.500 8.500M36.500 13l1 8.500M59.800 31.300l10.200-9.300" fill="none" stroke="#5a3a1c" strokeLinecap="round" strokeWidth="1.500" />
      <Leaf angle={176} fill={fill("leaf-gold")} size={25} stem x={20.900} y={8.100} />
      <Leaf angle={203} fill={fill("leaf-orange")} oak size={23} stem x={44.300} y={18.900} />
      <Leaf angle={150} fill={fill("leaf-red")} size={18} stem x={61} y={7} />
      <Leaf angle={100} fill={fill("leaf-gold")} oak size={22} stem x={72} y={10} />
      <Leaf angle={96} fill={fill("leaf-orange")} size={20} stem x={53.400} y={25.400} />
      <Leaf angle={140} fill={fill("leaf-red")} size={29} stem x={66} y={38} />
      <Acorn angle={6} ids={ids} size={12} x={25.600} y={25.600} />
      <Acorn angle={-14} ids={ids} size={11} x={36.900} y={27.600} />
      {[[70, 21], [74.200, 24.300], [73.500, 18.600], [77.400, 21.800]].map(([x, y]) => <circle cx={x} cy={y} fill={fill("berry")} key={`${x}-${y}`} r="2.100" />)}
    </g>
  );
}

/** The farm behind the scene at golden hour: a low sun, geese going over, wooded hills, a barn, the stubble field. */
const fieldRun = (height: (x: number) => number) => Array.from({ length: 41 }, (_, index) => `${index * 12} ${fixed(height(index * 12))}`).join("L");
const farRidge = (x: number) => 60 + 4 * Math.sin(x / 38) + 2.5 * Math.sin(x / 17 + 1);
const midField = (x: number) => 70 + 3 * Math.sin(x / 55 + 2);
const nearGround = (x: number) => 80 + 1.2 * Math.sin(x / 40);
const FAR_RIDGE = `M0 102L${fieldRun(farRidge)}L480 102Z`;
const MID_FIELD = `M0 102L${fieldRun(midField)}L480 102Z`;
const NEAR_GROUND = `M0 102L${fieldRun(nearGround)}L480 102Z`;
const NEAR_EDGE = `M${fieldRun(nearGround)}`;
const FURROWS = [3, 6.5].map((drop) => `M${fieldRun((x) => midField(x) + drop + 0.6 * Math.sin(x / 30 + drop))}`).join("");
const FAR_TONES = ["#c46a38", "#b4532e", "#d2863e", "#a8482a"];
const FAR_WOODS = Array.from({ length: 97 }, (_, index) => {
  const x = index * 5 + ((index * 7) % 4);
  return { x, y: fixed(farRidge(x) - 1 - ((index * 3) % 3) * 0.7), r: fixed(3 + ((index * 5) % 4) * 0.5), tone: FAR_TONES[(index * 3) % 4] };
});
const GROVE_TONES: Array<[string, string]> = [["#a8301c", "#d04e26"], ["#c8691e", "#ee9a30"], ["#c9962a", "#f0c650"], ["#8a2a1a", "#b84024"]];
const GROVE = [8, 24, 41, 60, 420, 438, 455, 472].map((x, index) => ({ x, y: midField(x) + 1, tones: GROVE_TONES[index % 4], size: 1 + (index % 3) * 0.12 }));
const GEESE = ([[150, 20], [143, 23.2], [157.5, 23.8], [136, 26.6], [165, 27.6], [129, 30.2]] as Point[])
  .map(([x, y]) => `M${fixed(x - 2.6)} ${fixed(y - 1.4)}q1.6 .1 2.6 1.4q1-1.3 2.6-1.4`).join("");
const CLOUDS: Array<[number, number, number, number]> = [[110, 31, 58, 1.9], [196, 38, 34, 1.4], [262, 24, 30, 1.5], [392, 28, 62, 2.1], [428, 37, 30, 1.3]];

/** The horn of plenty: a woven horn drawn along a spine that curls up to its tip and widens to the open mouth. */
const HORN: Point[] = [[14, 22], [-8, 46], [36, 74], [88, 58]];
const HORN_STEPS = Array.from({ length: 25 }, (_, index) => {
  const t = index / 24;
  const u = 1 - t;
  const [a, b, c, d] = HORN;
  const along = (axis: 0 | 1) => u ** 3 * a[axis] + 3 * u * u * t * b[axis] + 3 * u * t * t * c[axis] + t ** 3 * d[axis];
  const slope = (axis: 0 | 1) => 3 * u * u * (b[axis] - a[axis]) + 6 * u * t * (c[axis] - b[axis]) + 3 * t * t * (d[axis] - c[axis]);
  const length = Math.hypot(slope(0), slope(1));
  return { at: [along(0), along(1)] as Point, tangent: [slope(0) / length, slope(1) / length] as Point, radius: 1.4 + 23 * t ** 1.5 };
});
type HornStep = (typeof HORN_STEPS)[number];
/** A point across the horn at one step: share 1 is the lower edge, -1 the upper edge, 0 the spine. */
const hornEdge = ({ at, tangent, radius }: HornStep, share: number) => `${fixed(at[0] - tangent[1] * radius * share)} ${fixed(at[1] + tangent[0] * radius * share)}`;
const hornRun = (share: number, steps = HORN_STEPS) => steps.map((step) => hornEdge(step, share)).join("L");
const HORN_OUTLINE = `M${hornRun(1)}L${hornRun(-1, [...HORN_STEPS].reverse())}Z`;
const HORN_SHADE = `M${hornRun(1)}L${hornRun(0.15, [...HORN_STEPS].reverse())}Z`;
const HORN_STRANDS = [-0.55, -0.1, 0.4].map((share) => `M${hornRun(share)}`).join("");
const HORN_RIBS = HORN_STEPS.filter((_, index) => index >= 3 && index < 24 && index % 2 === 1).map((step) => {
  const bend = `${fixed(step.at[0] - step.tangent[0] * step.radius * 0.35)} ${fixed(step.at[1] - step.tangent[1] * step.radius * 0.35)}`;
  return `M${hornEdge(step, 1)}Q${bend} ${hornEdge(step, -1)}`;
}).join("");
const HORN_MOUTH = HORN_STEPS[24];
const HORN_TILT = fixed((Math.atan2(HORN_MOUTH.tangent[1], HORN_MOUTH.tangent[0]) * 180) / Math.PI);
const GRAPES: Point[] = [[94, 55], [99.5, 54], [105, 56], [96, 60.5], [101.5, 60], [107, 61.5], [98.5, 66], [104, 66.5], [101, 71.5]];

/** A tom turkey in full strut, drawn around the middle of his fan: banded tail, bronze breast, barred wing. */
const FEATHER = "M0 0C-2.5 -10 -6.5 -24 -5.2 -30.5Q0 -37.5 5.2 -30.5C6.5 -24 2.5 -10 0 0Z";
const FAN = Array.from({ length: 13 }, (_, index) => -96 + index * 16);
const COVERTS = Array.from({ length: 10 }, (_, index) => -81 + index * 18);
const BREAST = Array.from({ length: 6 }, (_, row) => Array.from({ length: 7 }, (_, column) => [-21 + column * 4.6 + (row % 2) * 2.3, -1 + row * 4.2] as Point))
  .flat()
  .filter(([x, y]) => ((x + 5) / 14.5) ** 2 + ((y - 9) / 12.5) ** 2 < 1 && x < -2)
  .map(([x, y]) => `M${fixed(x - 2)} ${fixed(y)}q2 2.4 4 0`)
  .join("");
const NECK = "M-14 3C-20 -2 -17.5 -8 -20.5 -14";

function Turkey({ ids }: { ids: Ids }) {
  return (
    <g>
      {FAN.map((angle) => (
        <g key={angle} transform={`rotate(${angle})`}>
          <path d={FEATHER} fill="#f2e0b6" stroke="#5a3416" strokeOpacity=".7" strokeWidth=".4" />
          <path d={FEATHER} fill="#2a160b" transform="scale(.9)" />
          <path d={FEATHER} fill={`url(#${ids("tail")})`} transform="scale(.8)" />
          <path d="M0 -2V-26M-3.4 -19Q0 -21 3.4 -19M-2.7 -13.5Q0 -15.5 2.7 -13.5" fill="none" stroke="#2a160b" strokeOpacity=".5" strokeWidth=".7" />
        </g>
      ))}
      {COVERTS.map((angle) => <path d={FEATHER} fill={`url(#${ids("bronze")})`} key={angle} stroke="#e0b876" strokeOpacity=".7" strokeWidth="1" transform={`rotate(${angle}) scale(.58)`} />)}
      <path d="M-9 22v4.6m0 0l-3.6 1m3.6-1l-.3 1.6m.3-1.6l2.8.9M1 22v4.6m0 0l-3.6 1m3.6-1l-.3 1.6m.3-1.6l2.8.9" fill="none" stroke="#b9703a" strokeLinecap="round" strokeWidth="1.5" />
      <ellipse cx="-5" cy="9" fill={`url(#${ids("bronze")})`} rx="16.5" ry="14.5" stroke="#24120a" strokeOpacity=".6" strokeWidth=".6" />
      <path d={BREAST} fill="none" stroke="#e3a95c" strokeLinecap="round" strokeOpacity=".55" strokeWidth=".7" />
      <path d="M-3 4C5 -.5 16 3.500 17.500 13C12.500 19 2 18.500 -3 13Z" fill="#4a2a12" stroke="#24120a" strokeWidth=".6" />
      <path d="M1.500 5.500l-1.500 9.500M5.500 4.500l-1.500 11.500M9.500 5l-1 11M13 7l-.8 8" stroke="#f0dcae" strokeLinecap="round" strokeOpacity=".85" strokeWidth="1.1" />
      <path d="M-18 7l-3 8.500" stroke="#1f1008" strokeLinecap="round" strokeWidth="1.700" />
      <path d={NECK} fill="none" stroke="#3a1a10" strokeLinecap="round" strokeWidth="6.800" />
      <path d={NECK} fill="none" stroke="#9c342a" strokeLinecap="round" strokeWidth="5.400" />
      <ellipse cx="-21" cy="-15.600" fill="#8ea6b0" rx="3.500" ry="3.800" stroke="#3a1a10" strokeOpacity=".7" strokeWidth=".5" />
      <path d="M-24 -16.600l-4.800 2.200 4.600 1.200z" fill="#d6b678" stroke="#8a6a1c" strokeWidth=".35" />
      <path d="M-23.800 -18.200q-3.200 .6 -2.900 6q1.600 -1.500 1.500 -4.900z" fill="#a82a28" />
      <path d="M-22.800 -12.600c-1.700 2.100-1.500 5.700 .6 7.300c1.500-1.900 1.300-5.200-.6-7.300z" fill="#a82a28" />
      <circle cx="-21.200" cy="-16.900" fill="#1a0f08" r=".7" />
    </g>
  );
}

/** A lattice-top cherry pie on a footed stand. */
const PIE_CRIMP: Point[] = Array.from({ length: 28 }, (_, index) => {
  const angle = (index / 28) * Math.PI * 2;
  return [Number(fixed(276 + Math.cos(angle) * 27)), Number(fixed(53 + Math.sin(angle) * 10.1))];
});
const LATTICE = [-45, -30, -15, 0, 15, 30, 45];

function LatticePie({ ids }: { ids: Ids }) {
  return (
    <g>
      <path d="M268 38q-3-4 0-8t0-8M284 39q3-4 0-8t0-8" fill="none" opacity=".4" stroke="#a8875a" strokeLinecap="round" strokeWidth="1.200" />
      <path d="M262 82.500q14 3 28 0q-1.500-3.400-9-4.600q-2.600-3-1-7.400h-8q1.600 4.400-1 7.400q-7.500 1.200-9 4.600z" fill={`url(#${ids("china")})`} stroke="#b39c70" strokeWidth=".6" />
      <ellipse cx="276" cy="67" fill={`url(#${ids("china")})`} rx="35" ry="4.800" stroke="#b39c70" strokeWidth=".6" />
      <path d="M249 53L255 64.500Q276 68.500 297 64.500L303 53Z" fill={`url(#${ids("tin")})`} />
      <ellipse cx="276" cy="53" fill="#d39a4c" rx="28" ry="11" />
      <ellipse cx="276" cy="53" fill={`url(#${ids("cherry")})`} rx="24" ry="9.200" />
      <g clipPath={`url(#${ids("pie-top")})`}>
        <g transform="translate(276 53) scale(1 .4)">
          {LATTICE.map((offset) => <path d={`M${offset - 40} -40L${offset + 40} 40`} key={offset} stroke="#a86a2a" strokeWidth="7.400" />)}
          {LATTICE.map((offset) => <path d={`M${offset - 40} -40L${offset + 40} 40`} key={offset} stroke="#edc47c" strokeWidth="5.400" />)}
          {LATTICE.map((offset) => <path d={`M${offset + 40} -40L${offset - 40} 40`} key={offset} stroke="#a86a2a" strokeWidth="7.400" />)}
          {LATTICE.map((offset) => <path d={`M${offset + 40} -40L${offset - 40} 40`} key={offset} stroke="#f2cd8a" strokeWidth="5.400" />)}
        </g>
      </g>
      {PIE_CRIMP.map(([x, y]) => <circle cx={x} cy={y} fill="#e9b966" key={`${x}-${y}`} r="2.400" stroke="#a86a2a" strokeWidth=".5" />)}
    </g>
  );
}

function Acorn({ x, y, size, angle, ids }: { x: number; y: number; size: number; angle: number; ids: Ids }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(${size / 16})`}>
      <ellipse cx="0" cy="3" fill={`url(#${ids("nut")})`} rx="5" ry="6.5" />
      <ellipse cx="-1.6" cy="1.5" fill="#fff" opacity=".14" rx="1.2" ry="2.4" />
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

function Shade({ id, stops }: { id: string; stops: [string, string, string] }) {
  return <radialGradient cx="38%" cy="32%" id={id} r="75%"><stop offset="0" stopColor={stops[0]} /><stop offset=".6" stopColor={stops[1]} /><stop offset="1" stopColor={stops[2]} /></radialGradient>;
}

function ThanksgivingDefs({ ids }: { ids: Ids }) {
  return (
    <defs>
      <Gradient id={ids("leaf-red")} stops={["#c8442a", "#84201a"]} />
      <Gradient id={ids("leaf-orange")} stops={["#e08a2c", "#a84e16"]} />
      <Gradient id={ids("leaf-gold")} stops={["#e6b648", "#b07c1e"]} />
      <Gradient id={ids("leaf-brown")} stops={["#a8703a", "#633818"]} />
      <Gradient id={ids("leaf-rust")} stops={["#9a3a20", "#5a1a12"]} />
      <Gradient id={ids("leaf-olive")} stops={["#a08a30", "#5e4c16"]} />
      <Gradient id={ids("nut")} stops={["#c98a44", "#74461a"]} />
      <Shade id={ids("berry")} stops={["#ee6c3c", "#bc3a1c", "#74180e"]} />
      <Shade id={ids("orange")} stops={["#f0a04a", "#d0661c", "#7e3810"]} />
      <Shade id={ids("cream")} stops={["#fbf2da", "#e2d0a8", "#9c8860"]} />
      <Shade id={ids("sage")} stops={["#c6d0b2", "#93a48a", "#566858"]} />
      <Shade id={ids("bronze")} stops={["#b06e34", "#5e3417", "#2a1608"]} />
      <Shade id={ids("cherry")} stops={["#c63c42", "#8e1a26", "#560e18"]} />
      <Shade id={ids("gourd-green")} stops={["#8ea64c", "#55702c", "#2a3c14"]} />
      <Shade id={ids("gourd-yellow")} stops={["#f2d06a", "#d8a02c", "#96621a"]} />
      <Shade id={ids("apple")} stops={["#dc5c42", "#a82a26", "#641214"]} />
      <Shade id={ids("grape")} stops={["#9a74ac", "#5a3268", "#2c1636"]} />
      <Gradient id={ids("wicker")} stops={["#e6bc78", "#a8742e"]} />
      <Gradient id={ids("tail")} stops={["#dc8a30", "#98481c", "#472510"]} />
      <Gradient id={ids("hat")} stops={["#241c18", "#5a4d44", "#1d1612"]} x2="1" y2="0" />
      <Gradient id={ids("buckle")} stops={["#f6dc8a", "#c9962e"]} />
      <Gradient id={ids("tin")} stops={["#dcdfe0", "#8d9498"]} />
      <Gradient id={ids("china")} stops={["#fff8e6", "#dccba6"]} />
      <Gradient id={ids("corn")} stops={["#f6d67c", "#d6a23a"]} />
      <Glow id={ids("shadow")} stops={[["#2a1206", 0.62], ["#2a1206", 0.26], ["#2a1206", 0]]} />
      <radialGradient id={ids("sun")}><stop offset="0" stopColor="#fff0b8" stopOpacity=".95" /><stop offset=".45" stopColor="#fbc66a" stopOpacity=".45" /><stop offset="1" stopColor="#f6a850" stopOpacity="0" /></radialGradient>
      <linearGradient id={ids("sky")} x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#f9d590" stopOpacity="0" /><stop offset=".4" stopColor="#f9cf86" /><stop offset=".75" stopColor="#f4a85a" /><stop offset="1" stopColor="#ea8646" />
      </linearGradient>
      <Gradient id={ids("ridge")} stops={["#b65c36", "#c97a40"]} />
      <Gradient id={ids("field")} stops={["#d69a42", "#a8692a"]} />
      <Gradient id={ids("ground")} stops={["#a66e2c", "#623a14"]} />
      <clipPath id={ids("pie-top")}><ellipse cx="276" cy="53" rx="24" ry="9.200" /></clipPath>
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
        <svg className="pad-skin-corner" height="68" viewBox="0 0 92 68" width="92"><Bough ids={ids} /></svg>
        <svg className="pad-skin-corner is-right" height="68" viewBox="0 0 92 68" width="92"><g transform="translate(92 0) scale(-1 1)"><Bough ids={ids} /></g></svg>
        <svg className="pad-skin-crest" height="44" viewBox="0 0 140 44" width="140">
          <Leaf angle={-82} fill={`url(#${ids("leaf-rust")})`} oak size={17} x={16} y={34} />
          <Leaf angle={-52} fill={`url(#${ids("leaf-orange")})`} size={23} x={33} y={27} />
          <Leaf angle={82} fill={`url(#${ids("leaf-brown")})`} oak size={17} x={124} y={34} />
          <Leaf angle={52} fill={`url(#${ids("leaf-gold")})`} size={23} x={107} y={27} />
          <Acorn angle={-62} ids={ids} size={10} x={41} y={38.500} />
          <Acorn angle={62} ids={ids} size={10} x={99} y={38.500} />
          {[[25, 39], [28.600, 41], [111.400, 41], [115, 39]].map(([x, y]) => <circle cx={x} cy={y} fill={`url(#${ids("berry")})`} key={x} r="1.900" />)}
          <g transform="translate(-4.400 -2) scale(1.2)">
            <ellipse cx="62" cy="34" fill="#4a2410" opacity=".28" rx="26" ry="1.800" />
            <ellipse cx="62" cy="30" fill="#1d1612" rx="23" ry="4.400" />
            <path d="M39.500 30.600Q62 36.800 84.500 30.600" fill="none" stroke="#7a6a5c" strokeWidth=".7" />
            <path d="M50.500 30L53.500 6.500Q62 4 70.500 6.500L73.500 30Q62 33.200 50.500 30Z" fill={`url(#${ids("hat")})`} />
            <ellipse cx="62" cy="6.300" fill="#4a3f38" rx="8.500" ry="1.900" />
            <path d="M51.300 23Q62 26 72.700 23L73.500 30Q62 33.200 50.500 30Z" fill="#8a3f1c" />
            <path d="M51.300 23Q62 26 72.700 23" fill="none" stroke="#c9763a" strokeOpacity=".7" strokeWidth=".5" />
            <rect fill="none" height="8.400" rx="1.200" stroke={`url(#${ids("buckle")})`} strokeWidth="2" width="9.600" x="57.200" y="23.400" />
            <path d="M59.200 27.600h4.600" stroke="#e2bc5c" strokeLinecap="round" strokeWidth="1.200" />
          </g>
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
    return (
      <div aria-hidden="true" className="pad-skin-foot">
        <svg className="pad-skin-defs" height="0" width="0"><ThanksgivingDefs ids={ids} /></svg>
        <svg className="pad-skin-backdrop" height="102" preserveAspectRatio="xMidYMax slice" viewBox="0 0 480 102">
          <rect fill={`url(#${ids("sky")})`} height="74" width="480" />
          <ellipse cx="305" cy="56" fill={`url(#${ids("sun")})`} rx="150" ry="52" />
          {CLOUDS.map(([x, y, rx, ry]) => <ellipse cx={x} cy={y} fill="#fdebc4" key={x} opacity=".6" rx={rx} ry={ry} />)}
          <circle cx="305" cy="55" fill="#fff4cc" r="14" />
          <path d={GEESE} fill="none" stroke="#7a3e1c" strokeLinecap="round" strokeOpacity=".8" strokeWidth=".9" />
          <path d={FAR_RIDGE} fill={`url(#${ids("ridge")})`} />
          {FAR_WOODS.map(({ x, y, r, tone }) => <circle cx={x} cy={y} fill={tone} key={x} r={r} />)}
          <rect fill="#dccdaa" height="13" width="4.500" x="222" y="49" /><rect fill="#8a7a62" height="13" opacity=".5" width="1.600" x="224.900" y="49" />
          <path d="M221.600 49.400a2.650 2.650 0 0 1 5.300 0z" fill="#6e5e4c" />
          <path d="M205 62V53L213 47.500L221 53V62Z" fill="#9c3222" /><path d="M213 47.500L221 53V62H213Z" fill="#6e1e16" opacity=".5" />
          <path d="M203.800 54L208 49.800L213 46.800L218 49.800L222.200 54" fill="none" stroke="#3e2014" strokeLinejoin="round" strokeWidth="1.600" />
          <rect fill="#f2e2be" height="6" width="5" x="210.500" y="56" /><path d="M210.500 56l5 6m0-6l-5 6" stroke="#9c3222" strokeWidth=".5" />
          <rect fill="#3e2014" height="2" width="2" x="212" y="50.800" />
          <path d={MID_FIELD} fill={`url(#${ids("field")})`} />
          <path d={FURROWS} fill="none" stroke="#ecc070" strokeOpacity=".55" strokeWidth=".6" />
          {GROVE.map(({ x, y, tones, size }) => (
            <g key={x} transform={`translate(${x} ${fixed(y)}) scale(${size})`}>
              <path d="M0 0V-10" stroke="#4a2814" strokeWidth="1.800" />
              <circle cx="-4.500" cy="-12" fill={tones[0]} r="6" /><circle cx="4.800" cy="-11" fill={tones[0]} r="5.600" /><circle cx="0" cy="-17" fill={tones[0]} r="6.600" />
              <circle cx="-2.400" cy="-18" fill={tones[1]} opacity=".8" r="4" /><circle cx="-5.500" cy="-12.500" fill={tones[1]} opacity=".6" r="2.800" />
            </g>
          ))}
          <path d={NEAR_GROUND} fill={`url(#${ids("ground")})`} />
          <path d={NEAR_EDGE} fill="none" stroke="#f0bc68" strokeOpacity=".6" strokeWidth=".9" />
        </svg>
        <svg className="pad-skin-scene" height="102" viewBox="0 -16 360 102" width="360">
          <ellipse cx="88" cy="83" fill={`url(#${ids("shadow")})`} rx="94" ry="4.400" />
          <ellipse cx="200" cy="83.400" fill={`url(#${ids("shadow")})`} rx="32" ry="3.800" />
          <ellipse cx="274" cy="83.400" fill={`url(#${ids("shadow")})`} rx="38" ry="3.800" />
          <ellipse cx="334" cy="83.400" fill={`url(#${ids("shadow")})`} rx="32" ry="3.800" />
          <Leaf angle={-40} fill={`url(#${ids("leaf-orange")})`} size={12} x={10} y={82} />
          <Leaf angle={60} fill={`url(#${ids("leaf-brown")})`} oak size={10} x={25} y={84} />

          <path d={HORN_OUTLINE} fill={`url(#${ids("wicker")})`} stroke="#6e4318" strokeLinejoin="round" strokeWidth=".7" />
          <path d={HORN_SHADE} fill="#4a2410" opacity=".22" />
          <path d={HORN_STRANDS} fill="none" stroke="#7a4c1c" strokeOpacity=".4" strokeWidth=".7" />
          <path d={HORN_RIBS} fill="none" stroke="#6e4318" strokeLinecap="round" strokeWidth="1.300" />
          <path d={HORN_RIBS} fill="none" stroke="#f6d9a0" strokeLinecap="round" strokeOpacity=".55" strokeWidth=".6" transform="translate(-1.200 -.4)" />
          <g transform={`rotate(${HORN_TILT} 88 58)`}>
            <ellipse cx="88" cy="58" fill="#c79248" rx="8.500" ry="24.600" stroke="#6e4318" strokeWidth="1.100" />
            <ellipse cx="88.600" cy="58" fill="#2c1708" rx="5.800" ry="21" />
          </g>
          <Wheat angle={28} length={36} x={90} y={52} />
          <Wheat angle={46} length={32} x={91} y={54} />
          <Leaf angle={25} fill={`url(#${ids("leaf-red")})`} size={25} x={103} y={38} />
          <Leaf angle={68} fill={`url(#${ids("leaf-gold")})`} oak size={21} x={121} y={47} />
          <g transform="translate(113 52) rotate(-24)">
            <path d="M-11 0C-17 -8 -26 -8 -31 -3.500C-24 -2 -17 0 -11 0ZM-11 0C-17 6 -25 7.500 -30 4.500C-24 3 -17 1.500 -11 0Z" fill="#d6c98a" stroke="#9a8a4a" strokeWidth=".5" />
            <ellipse cx="2" cy="0" fill={`url(#${ids("corn")})`} rx="14" ry="5.400" stroke="#a8741c" strokeWidth=".5" />
            <path d="M-8 -4v8M-4.500 -5v10M-1 -5.300v10.600M2.500 -5.400v10.800M6 -5.200v10.400M9.500 -4.500v9M13 -3v6M-11 0h26M-10 -2.700h24M-10 2.700h24" fill="none" stroke="#b07a18" strokeOpacity=".55" strokeWidth=".5" />
          </g>
          {GRAPES.map(([x, y]) => <g key={`${x}-${y}`}><circle cx={x} cy={y} fill={`url(#${ids("grape")})`} r="3.200" /><circle cx={x - 1} cy={y - 1.100} fill="#fff" opacity=".2" r=".7" /></g>)}
          <path d="M127 53.500q.5-3.500 3-4.500" fill="none" stroke="#5a3a1c" strokeLinecap="round" strokeWidth="1.200" />
          <circle cx="127" cy="61.500" fill={`url(#${ids("apple")})`} r="8.200" />
          <ellipse cx="123.800" cy="58" fill="#fff" opacity=".14" rx="1.600" ry="2.600" transform="rotate(25 123.800 58)" />
          <Heirloom fill={`url(#${ids("orange")})`} rib="#8f3d10" rx={14.500} ry={10.200} x={116} y={73.300} />
          <path d="M143 61q-.6-3.500 2.200-5" fill="none" stroke="#6b5a32" strokeLinecap="round" strokeWidth="1.600" />
          <ellipse cx="143" cy="66.500" fill={`url(#${ids("gourd-yellow")})`} rx="4.800" ry="5.800" />
          <ellipse cx="143" cy="76" fill={`url(#${ids("gourd-green")})`} rx="7.800" ry="7.500" />
          <path d="M138.300 70.400Q143 73.400 147.700 70.400Q147 67 143 66.500Q139 67 138.300 70.400Z" fill="#e8ae2c" />
          <path d="M140 70.800q-2.400 5.800 0 12M143 71.600v11.800M146 70.800q2.400 5.800 0 12" fill="none" stroke="#c9dc8a" strokeOpacity=".7" strokeWidth=".8" />
          <Acorn angle={75} ids={ids} size={10} x={157} y={80.300} />
          <Leaf angle={100} fill={`url(#${ids("leaf-orange")})`} size={13} x={168} y={79} />

          <g transform="translate(200 58)"><Turkey ids={ids} /></g>

          <Acorn angle={-70} ids={ids} size={9} x={224} y={82.300} />
          <LatticePie ids={ids} />
          <Heirloom fill={`url(#${ids("sage")})`} rib="#5c6e5e" rx={8.500} ry={5.800} x={241} y={77.600} />
          <Leaf angle={110} fill={`url(#${ids("leaf-red")})`} size={11} x={298} y={83.500} />

          <path d="M337 61C336 45 328 35 319 39C315.500 41 316.500 46 320 46.500" fill="none" stroke="#2c4014" strokeLinecap="round" strokeWidth="9" />
          <path d="M337 61C336 45 328 35 319 39C315.500 41 316.500 46 320 46.500" fill="none" stroke="#5f8230" strokeLinecap="round" strokeWidth="7" />
          <path d="M320 46.500l-2.600 2.600" stroke="#6b5a32" strokeLinecap="round" strokeWidth="1.800" />
          <circle cx="338" cy="70.500" fill={`url(#${ids("gourd-green")})`} r="12.600" stroke="#2c4014" strokeWidth=".6" />
          {[[331, 66], [336, 62], [342, 65], [346, 71], [333, 73], [339, 70], [343, 77], [336, 79], [329, 71], [334, 50], [331, 43], [324, 39.500], [336, 56]].map(([x, y]) => <circle cx={x} cy={y} fill="#cfe08e" key={`${x}-${y}`} opacity=".75" r=".9" />)}
          <path d="M316 68.500q-1.200-4.200 2.200-6" fill="none" stroke="#6b5a32" strokeLinecap="round" strokeWidth="1.800" />
          <ellipse cx="316" cy="76" fill={`url(#${ids("gourd-yellow")})`} rx="9.500" ry="7.600" stroke="#a8741c" strokeWidth=".5" />
          <path d="M307.500 78.500Q316 86 324.500 78.500Q321 83.500 316 83.600Q311 83.500 307.500 78.500Z" fill="#5f8230" />
          {[[311, 73], [315, 71.500], [320, 73.500], [313, 77], [318, 77.500], [322, 76.500], [309.500, 76]].map(([x, y]) => <circle cx={x} cy={y} fill="#fdf0a8" key={`${x}-${y}`} r="1.150" stroke="#c98f1c" strokeWidth=".35" />)}
          <Heirloom fill={`url(#${ids("cream")})`} rib="#a8946a" rx={7.500} ry={5.600} x={351} y={77.800} />
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
        <path d="M.8 12.300h14.400l-1.500 1.700H2.300z" fill="#fffaf0" stroke="#8a6a3a" strokeLinejoin="round" strokeWidth=".55" />
        <path d="M2.300 12.300a5.700 6 0 0 1 11.400 0z" fill="#d5dbe0" stroke="#6f7880" strokeLinejoin="round" strokeWidth=".6" />
        <path d="M4.100 10.800a4 4.300 0 0 1 2.700-3.800" fill="none" opacity=".95" stroke="#fff" strokeLinecap="round" strokeWidth=".9" />
        <path d="M8 6.300V5.300" stroke="#6f7880" strokeWidth=".8" />
        <circle cx="8" cy="4.500" fill="#e8b93c" r="1.200" stroke="#8a6a1c" strokeWidth=".4" />
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
