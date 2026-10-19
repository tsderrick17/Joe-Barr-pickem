import { chainLinks, chainTwang, footSquash, FOOT, leadPose, LEAD_TO, REAR_X, ringPoint, rodHeight, WIDTH } from "@/lib/pull-chain.js";

/**
 * The picture for pull to refresh: a first-down chain along the foot of the header. The rear rod is planted at the left; the lead rod is
 * carried in from above, swinging upright and pulling the chain taut as `progress` goes from 0 to 1, and when it reaches 1 its rubber
 * foot plants (it compresses, dust puffs, the chain twangs for `since` ms). Pure: no state, so it can be drawn anywhere.
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

export default function PullChainScene({ height, progress, planted, since }: { height: number; progress: number; planted: boolean; since: number }) {
  const ground = height - 4;
  const rod = rodHeight(height);
  const squash = planted ? footSquash(since) : 1;
  const lead = leadPose(progress, ground, rod);
  const leadY = lead.y + (1 - squash) * FOOT;   // the rod sinks as the rubber compresses, so the foot stays on the turf
  const rear = ringPoint(REAR_X, ground - rod - FOOT, 0, rod);
  const front = ringPoint(lead.x, leadY, lead.tilt, rod);
  const { links, clip } = chainLinks(rear, front, planted ? chainTwang(since) : 0);
  const dust = planted ? Math.min(1, since / 380) : 1;
  return (
    <svg aria-hidden="true" height={height} viewBox={`0 0 ${WIDTH} ${height}`} width={WIDTH}>
      <rect className="pull-chain-ground" height={4} width={WIDTH} y={ground} />
      {[30, 60, 90, 120, 150, 180, 210].map((mark) => <path className="pull-chain-yard" d={`M${mark} ${ground}v4`} key={mark} />)}
      <Rod rod={rod} x={REAR_X} y={ground - rod - FOOT} />
      {links.map((link, index) => (
        <ellipse className={link.edge ? "pull-chain-link-edge" : "pull-chain-link"} cx={link.x} cy={link.y} key={index} rx={2.5} ry={link.edge ? 0.7 : 1.5} transform={`rotate(${link.angle} ${link.x} ${link.y})`} />
      ))}
      <rect className="pull-chain-clip" height={4.4} width={2.6} x={clip.x - 1.3} y={clip.y - 2.2} transform={`rotate(${clip.angle} ${clip.x} ${clip.y})`} />
      <Rod rod={rod} squash={squash} tilt={lead.tilt} x={lead.x} y={leadY} />
      {planted && dust < 1 ? (
        <g className="pull-chain-dust" opacity={0.55 * (1 - dust)}>
          <circle cx={LEAD_TO - 5 - 10 * dust} cy={ground - 1} r={1 + 2 * dust} />
          <circle cx={LEAD_TO + 5 + 10 * dust} cy={ground - 1} r={1 + 2 * dust} />
        </g>
      ) : null}
    </svg>
  );
}
