import { ballSpot, chainLinks, chainTwang, fieldMarks, footSquash, FOOT, groundOf, layout, leadPose, ringPoint, rodHeight, strainLean, TURF } from "@/lib/pull-chain.js";

/**
 * The picture for pull to refresh: a first-down chain across the foot of the header, on a strip of turf with yard lines and hash marks, as wide
 * as the page. The rear rod is planted at the left and a football is spotted at the right. The lead rod is carried in from above, swinging
 * upright and pulling the chain taut as `progress` goes from 0 to 1; when it reaches 1 its rubber foot plants beside the ball (it compresses,
 * dust puffs, the chain twangs and the rod leans against the strain for `since` ms). The ball's nose is a couple of inches past the rod: a
 * first down. Pure: no state, so it can be drawn anywhere.
 */
const DISC = 6.2;          // the round target on top of a rod
const BANNER_TOP = 13;     // where the tapered banner starts under the disc
const TOP_WIDTH = 10, BOTTOM_WIDTH = 2.6;
const CHEVRONS = 4;

/** One first-down marker, as the chain crew carries it: a target disc on top, a long padded orange banner that tapers to the foot with
 *  black-and-white chevrons pointing down, and a black rubber foot that the chain is fastened to. */
function Rod({ x, y, tilt = 0, squash = 1, rod }: { x: number; y: number; tilt?: number; squash?: number; rod: number }) {
  const half = (at: number) => (TOP_WIDTH + (BOTTOM_WIDTH - TOP_WIDTH) * ((at - BANNER_TOP) / (rod - BANNER_TOP))) / 2;
  const step = (rod - BANNER_TOP) / (CHEVRONS + 1);
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
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

/** The spotted football lying on the turf, seen from the side, pointing right, with its laces on top and a stripe near each end. */
function Ball({ spot }: { spot: ReturnType<typeof ballSpot> }) {
  const half = spot.length / 2, tall = spot.height / 2;
  return (
    <g transform={`translate(${spot.x} ${spot.y})`}>
      <path className="pull-chain-ball" d={`M${-half} 0Q${-half * 0.55} ${-tall} 0 ${-tall}Q${half * 0.55} ${-tall} ${half} 0Q${half * 0.55} ${tall} 0 ${tall}Q${-half * 0.55} ${tall} ${-half} 0Z`} />
      <path className="pull-chain-ball-stripe" d={`M${-half * 0.62} ${-tall * 0.62}V${tall * 0.62}M${half * 0.62} ${-tall * 0.62}V${tall * 0.62}`} />
      <path className="pull-chain-ball-lace" d={`M${-half * 0.3} ${-tall * 0.82}H${half * 0.3}M${-half * 0.2} ${-tall * 1.0}V${-tall * 0.6}M0 ${-tall * 1.02}V${-tall * 0.62}M${half * 0.2} ${-tall * 1.0}V${-tall * 0.6}`} />
    </g>
  );
}

export default function PullChainScene({ width, height, progress, planted, since }: { width: number; height: number; progress: number; planted: boolean; since: number }) {
  const lay = layout(width);
  const ground = groundOf(height);
  const rod = rodHeight(height);
  const squash = planted ? footSquash(since) : 1;
  const lead = leadPose(progress, ground, rod, lay);
  const tilt = planted ? strainLean(since) : lead.tilt;
  const leadY = lead.y + (1 - squash) * FOOT;   // the rod sinks as the rubber compresses, so the foot stays on the turf
  const rear = ringPoint(lay.rear, ground - rod - FOOT, 0, rod);
  const front = ringPoint(lead.x, leadY, tilt, rod);
  const { links, clip } = chainLinks(rear, front, { chainLength: lay.chainLength, groundY: ground, twang: planted ? chainTwang(since) : 0 });
  const dust = planted ? Math.min(1, since / 380) : 1;
  const marks = fieldMarks(lay);
  const turfTop = height - TURF;
  return (
    <svg aria-hidden="true" height={height} viewBox={`0 0 ${width} ${height}`} width={width}>
      <rect className="pull-chain-ground" height={TURF} width={width} y={turfTop} />
      <rect className="pull-chain-sideline" height={1} width={width} y={turfTop} />
      {marks.lines.map((x) => <rect className="pull-chain-yardline" height={TURF - 1} key={`l${x}`} width={1.1} x={x - 0.55} y={turfTop + 1} />)}
      {marks.hashes.map((x) => <path className="pull-chain-hash" d={`M${x} ${turfTop + 1}v1.8M${x} ${height - 1.8}v1.8`} key={`h${x}`} />)}
      <Ball spot={ballSpot(lay, height)} />
      <Rod rod={rod} x={lay.rear} y={ground - rod - FOOT} />
      {links.map((link, index) => (
        <ellipse className={link.edge ? "pull-chain-link-edge" : "pull-chain-link"} cx={link.x} cy={link.y} key={index} rx={2.5} ry={link.edge ? 0.7 : 1.5} transform={`rotate(${link.angle} ${link.x} ${link.y})`} />
      ))}
      <rect className="pull-chain-clip" height={4.4} width={2.6} x={clip.x - 1.3} y={clip.y - 2.2} transform={`rotate(${clip.angle} ${clip.x} ${clip.y})`} />
      <Rod rod={rod} squash={squash} tilt={tilt} x={lead.x} y={leadY} />
      {planted && dust < 1 ? (
        <g className="pull-chain-dust" opacity={0.55 * (1 - dust)}>
          <circle cx={lay.leadTo - 5 - 10 * dust} cy={ground - 1} r={1 + 2 * dust} />
          <circle cx={lay.leadTo + 5 + 10 * dust} cy={ground - 1} r={1 + 2 * dust} />
        </g>
      ) : null}
    </svg>
  );
}
