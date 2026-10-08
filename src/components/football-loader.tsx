/**
 * The loading football: the approved ball, pre-rendered as 24 frames of one spin (public/football-spin.webp, made
 * from the still renders in football-stills/), stepped through by CSS and tipped nose-up 40 degrees with a small
 * wobble. Nothing runs in JavaScript while it spins. With reduced motion it is a still ball.
 */
export default function FootballLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-live="polite" className="football-loader" role="status">
      <span aria-hidden="true" className="football-loader-tilt"><span className="football-loader-ball" /></span>
      <span className="football-loader-label">{label}</span>
    </div>
  );
}
