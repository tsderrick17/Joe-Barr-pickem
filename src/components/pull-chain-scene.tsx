import { useId } from "react";
import { ballSpot, chainAnchor, chainLinks, chainReach, counterSpot, descentPose, fieldMarks, footSquash, FOOT, groundOf, landingLean, layout, plantedPose, POLE, pullStages, slatOffsets, TURF } from "@/lib/pull-chain.js";

/**
 * The picture for pull to refresh: a first-down chain zoomed in on its last three yards, as wide as the page and no taller than the header. The
 * turf is a deep strip with hash marks; a football is spotted at the right; a down counter stands off in the distance beyond it; and the chain, always
 * taut, runs in from the left edge of the page to the lead pole, of which only the bottom third shows (its top is above the header). The pull has two
 * stages (see src/lib/pull-chain.js): the pole comes down foot first, straightening, and lands beside the ball with a puff of dust (it compresses,
 * then swings once a little past upright, for `since` ms); then the counter's slats slide up from 4 to 1. The ball is behind the pole, its nose poking
 * out a couple of inches past the pole's foot: a first down. Pure: no state. */
const DISC = 6.2;          // the round target on top of a rod
const BANNER_TOP = 13;     // where the tapered banner starts under the disc
const TOP_WIDTH = 10, BOTTOM_WIDTH = 2.6;
const CHEVRONS = 4;

/** One first-down marker, as the chain crew carries it: a target disc on top, a long padded orange banner that tapers to the foot with
 *  black-and-white chevrons pointing down, and a black rubber foot that the chain is fastened to. */
function Rod({ x, y, tilt = 0, squash = 1, zoom }: { x: number; y: number; tilt?: number; squash?: number; zoom: number }) {
  const rod = POLE;
  const half = (at: number) => (TOP_WIDTH + (BOTTOM_WIDTH - TOP_WIDTH) * ((at - BANNER_TOP) / (rod - BANNER_TOP))) / 2;
  const step = (rod - BANNER_TOP) / (CHEVRONS + 1);
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt}) scale(${zoom})`}>
      <path className="pull-chain-strap" d={`M${-DISC * 0.7} ${DISC * 1.5}L${-TOP_WIDTH / 2} ${BANNER_TOP}M${DISC * 0.7} ${DISC * 1.5}L${TOP_WIDTH / 2} ${BANNER_TOP}`} />
      <rect className="pull-chain-rod" height={BANNER_TOP - DISC} width={1.8} x={-0.9} y={DISC * 1.6} />
      <path className="pull-chain-rod" d={`M${-TOP_WIDTH / 2} ${BANNER_TOP}H${TOP_WIDTH / 2}L${BOTTOM_WIDTH / 2} ${rod}H${-BOTTOM_WIDTH / 2}Z`} />
      {Array.from({ length: CHEVRONS }, (_, index) => {
        const at = BANNER_TOP + step * (index + 1), width = half(at), drop = Math.min(3.2, width * 0.55);
        return (
          <g key={index}>
            <path className="pull-chain-chevron-white" d={`M${-width} ${at - drop + 1}L0 ${at + 1}L${width} ${at - drop + 1}`} />
            <path className="pull-chain-chevron" d={`M${-width} ${at - drop}L0 ${at}L${width} ${at - drop}`} />
          </g>
        );
      })}
      <circle className="pull-chain-rod" cx={0} cy={DISC} r={DISC} />
      <circle className="pull-chain-ring" cx={0} cy={DISC} r={DISC * 0.64} />
      <circle className="pull-chain-rod" cx={0} cy={DISC} r={DISC * 0.4} />
      <path className="pull-chain-foot" d={`M-1.6 0H1.6L3.1 ${FOOT - 1.2}Q3.1 ${FOOT} 2 ${FOOT}H-2Q-3.1 ${FOOT} -3.1 ${FOOT - 1.2}Z`} transform={`translate(0 ${rod}) scale(1 ${squash})`} />
    </g>
  );
}

/** The spotted football lying on the field, seen from the side, pointing right: a pointed body shaded like leather, a soft gloss, a white stripe
 *  near each end, laces along the top, a dark outline and its shadow on the turf. */
function Ball({ spot }: { spot: ReturnType<typeof ballSpot> }) {
  const half = spot.length / 2, tall = spot.height / 2, c = tall * 1.42;   // the curve's control height, so the body is `tall` high at its fullest
  const body = `M${-half} 0C${-half * 0.62} ${-c} ${half * 0.62} ${-c} ${half} 0C${half * 0.62} ${c} ${-half * 0.62} ${c} ${-half} 0Z`;
  return (
    <g transform={`translate(${spot.x} ${spot.y})`}>
      <ellipse className="pull-chain-ball-shadow" cx={0} cy={tall + 0.6} rx={half * 0.92} ry={2.6} />
      <clipPath id="pull-chain-ball-shape"><path d={body} /></clipPath>
      <path className="pull-chain-ball" d={body} />
      <g clipPath="url(#pull-chain-ball-shape)">
        <rect className="pull-chain-ball-stripe" height={spot.height} width={2.8} x={-half * 0.56 - 1.4} y={-tall} />
        <rect className="pull-chain-ball-stripe" height={spot.height} width={2.8} x={half * 0.56 - 1.4} y={-tall} />
        <ellipse className="pull-chain-ball-gloss" cx={-half * 0.12} cy={-tall * 0.5} rx={half * 0.55} ry={tall * 0.22} />
        <path className="pull-chain-ball-seam" d={`M${-half * 0.34} ${-tall * 0.34}H${half * 0.34}`} />
        <path className="pull-chain-ball-lace" d={[-0.26, -0.13, 0, 0.13, 0.26].map((k) => `M${half * k} ${-tall * 0.6}V${-tall * 0.08}`).join("")} />
      </g>
      <path className="pull-chain-ball-outline" d={body} />
    </g>
  );
}

/** The down counter: a thick foam frame round a dark panel of horizontal slats that carry the digit. Each slat is a window on a little strip with its slice
 *  of the 4 above and its slice of the 1 below; sliding the strip up swaps one for the other, so a panel part-way through reads 1, 4, 1, 4 down its height. */
const SLATS = 12, PANEL = { width: 60, height: 84 };
const FOUR = "M36 6L50 6L50 50L58 50L58 64L50 64L50 78L34 78L34 64L4 64L4 52ZM34 24L34 50L17 50Z";
const ONE = "M26 6L44 6L44 78L28 78L28 26L10 36L10 22Z";
function DownCounter({ x, ground, scale, progress }: { x: number; ground: number; scale: number; progress: number }) {
  const id = useId().replaceAll(":", "");
  const row = PANEL.height / SLATS, offsets = slatOffsets(progress, SLATS);
  const digit = (path: string) => <path className="pull-counter-digit" d={path} fillRule="evenodd" />;
  return (
    <g transform={`translate(${x} ${ground}) scale(${scale}) translate(-38 -126)`}>
      <ellipse className="pull-chain-ball-shadow" cx={38} cy={126} rx={22} ry={4} />
      <rect className="pull-counter-post" height={26} rx={3} width={9} x={33.5} y={100} />
      <rect className="pull-counter-frame" height={104} rx={9} width={76} x={0} y={0} />
      <rect className="pull-counter-panel" height={PANEL.height} width={PANEL.width} x={8} y={8} />
      <rect className="pull-counter-label" height={9} width={PANEL.width} x={8} y={93} />
      <defs>
        {Array.from({ length: SLATS }, (_, index) => <clipPath id={`${id}-w${index}`} key={`w${index}`}><rect height={row} width={PANEL.width} y={index * row} /></clipPath>)}
        {Array.from({ length: SLATS }, (_, index) => <clipPath id={`${id}-r${index}`} key={`r${index}`}><rect height={row + 0.02} width={PANEL.width} y={index * row - 0.01} /></clipPath>)}
      </defs>
      <g transform="translate(8 8)">
        {Array.from({ length: SLATS }, (_, index) => (
          <g clipPath={`url(#${id}-w${index})`} key={index}>
            <g transform={`translate(0 ${-offsets[index] * row})`}>
              <g clipPath={`url(#${id}-r${index})`}>{digit(FOUR)}</g>
              <g transform={`translate(0 ${row})`}><g clipPath={`url(#${id}-r${index})`}>{digit(ONE)}</g></g>
            </g>
            {index ? <path className="pull-counter-seam" d={`M0 ${index * row}H${PANEL.width}`} /> : null}
          </g>
        ))}
      </g>
    </g>
  );
}

export default function PullChainScene({ width, height, progress, landed, since }: { width: number; height: number; progress: number; landed: boolean; since: number }) {
  const lay = layout(width);
  const ground = groundOf(height);
  const stages = pullStages(progress);
  const squash = landed ? footSquash(since) : 1;
  const sink = (1 - squash) * FOOT * lay.zoom;   // the pole sinks as the rubber compresses, so the foot stays on the turf
  // coming down it turns about its top; once landed it swings about its foot, which stays exactly where it touched down
  const pose = landed ? plantedPose(landingLean(since), lay, ground, sink) : descentPose(stages.descent, lay, ground);
  const anchor = chainAnchor(lay, ground);
  const { links, clip } = chainLinks(anchor, pose.ring, { chainLength: chainReach(lay), groundY: ground, linkZoom: lay.linkZoom });
  const dust = landed ? Math.min(1, since / 380) : 1;
  const marks = fieldMarks(lay);
  const turfTop = height - TURF;
  const counter = counterSpot(lay, height);
  const shown = links.filter((link) => link.x > -14 && link.x < width + 14);   // the rest of the chain is off the page
  const linkW = 2.5 * lay.linkZoom, linkH = 1.5 * lay.linkZoom;
  return (
    <svg aria-hidden="true" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <defs>
        <linearGradient id="pull-chain-leather" x1="0" x2="0" y1="0" y2="1">
          <stop className="pull-chain-leather-hi" offset="0" />
          <stop className="pull-chain-leather-mid" offset="0.55" />
          <stop className="pull-chain-leather-lo" offset="1" />
        </linearGradient>
      </defs>
      <rect className="pull-chain-ground" height={TURF} width={width} y={turfTop} />
      <rect className="pull-chain-sideline" height={2} width={width} y={turfTop} />
      {marks.lines.map((x) => <rect className="pull-chain-yardline" height={TURF - 2} key={`l${x}`} width={3} x={x - 1.5} y={turfTop + 2} />)}
      {marks.hashes.map((x) => <path className="pull-chain-hash" d={`M${x} ${turfTop + 2}v5M${x} ${height - 5}v5`} key={`h${x}`} />)}
      <DownCounter ground={counter.ground} progress={stages.counter} scale={counter.scale} x={counter.x} />
      <Ball spot={ballSpot(lay, height)} />
      {shown.map((link, index) => (
        <ellipse className={link.edge ? "pull-chain-link-edge" : "pull-chain-link"} cx={link.x} cy={link.y} key={index} rx={linkW} ry={link.edge ? linkH * 0.47 : linkH} transform={`rotate(${link.angle} ${link.x} ${link.y})`} />
      ))}
      {clip.x > -10 && clip.x < width + 10 ? <rect className="pull-chain-clip" height={4.4 * lay.linkZoom} width={2.6 * lay.linkZoom} x={clip.x - 1.3 * lay.linkZoom} y={clip.y - 2.2 * lay.linkZoom} transform={`rotate(${clip.angle} ${clip.x} ${clip.y})`} /> : null}
      <Rod squash={squash} tilt={-pose.lean} x={pose.top.x} y={pose.top.y} zoom={lay.zoom} />
      {landed && dust < 1 ? (
        <g className="pull-chain-dust" opacity={0.55 * (1 - dust)}>
          <circle cx={lay.leadTo - 14 - 26 * dust} cy={ground - 3} r={3 + 7 * dust} />
          <circle cx={lay.leadTo + 14 + 26 * dust} cy={ground - 3} r={3 + 7 * dust} />
        </g>
      ) : null}
    </svg>
  );
}
