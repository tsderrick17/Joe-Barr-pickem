import { chainLinks, chainTwang, footSquash, FOOT, leadPose, LEAD_TO, REAR_X, ringPoint, rodHeight, WIDTH } from "@/lib/pull-chain.js";

/**
 * The picture for pull to refresh: a first-down chain along the foot of the header. The rear rod is planted at the left; the lead rod is
 * carried in from above, swinging upright and pulling the chain taut as `progress` goes from 0 to 1, and when it reaches 1 its rubber
 * foot plants (it compresses, dust puffs, the chain twangs for `since` ms). Pure: no state, so it can be drawn anywhere.
 */
function Rod({ x, y, tilt = 0, squash = 1, rod }: { x: number; y: number; tilt?: number; squash?: number; rod: number }) {
  const bandAt = rod * 0.38;
  return (
    <g transform={`translate(${x} ${y}) rotate(${tilt})`}>
      <rect className="pull-chain-rod" height={rod - 4} width={3.4} x={-1.7} y={4} />
      <rect className="pull-chain-band" height={2.6} width={3.4} x={-1.7} y={bandAt} />
      <rect className="pull-chain-knob" height={5.5} rx={2.4} width={5.2} x={-2.6} y={0} />
      <path className="pull-chain-foot" d={`M-1.9 0H1.9L3.1 ${FOOT - 1.2}Q3.1 ${FOOT} 2 ${FOOT}H-2Q-3.1 ${FOOT} -3.1 ${FOOT - 1.2}Z`} transform={`translate(0 ${rod}) scale(1 ${squash})`} />
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
