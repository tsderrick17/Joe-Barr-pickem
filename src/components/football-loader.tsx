/**
 * The loading football: the approved ball (ray-cast in 3D, football-stills/football-v15.html), pre-rendered as 72 full-size frames of one slow, smooth turn (a 9 x 8 grid) (public/football-spin.webp, made
 * from the still renders in football-stills/), stepped through by CSS and tipped nose-up (no wobble by
 * default). Nothing runs in JavaScript while it spins. With reduced motion it is a still ball.
 */
export default function FootballLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div aria-live="polite" className="football-loader" role="status">
      <span aria-hidden="true" className="football-loader-tilt"><span className="football-loader-ball" /></span>
      <span className="football-loader-label">{label}</span>
    </div>
  );
}
