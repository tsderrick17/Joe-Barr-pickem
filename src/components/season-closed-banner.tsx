/**
 * Shown on the player pages once the Super Bowl is graded. The season's final tables stay on screen, read-only,
 * until the new season opens on August 1.
 */
export default function SeasonClosedBanner() {
  return (
    <section aria-label="Season status" className="season-closed-banner mb-5 border-l-4 border-[#1d1d1f] bg-[#f3ead6] px-4 py-3 text-[#171719]" role="status">
      <p className="font-bold">The season is over.</p>
      <p className="mt-1 text-sm">Final results are shown below. The next season opens August 1.</p>
    </section>
  );
}
