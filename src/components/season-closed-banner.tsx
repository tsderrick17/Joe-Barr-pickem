/**
 * Shown instead of the ticket and receipt once the Super Bowl is graded ("See you next season!"), and to a
 * player who has been eliminated from the playoff race. Navy and old gold, like the Bowl Card crest.
 */
export default function SeasonClosedBanner({ eliminated = false }: { eliminated?: boolean }) {
  return (
    <section aria-label="Season status" className="season-closed-banner mb-6 border-y-4 border-double border-[#b38b4d] bg-[#16223a] px-4 py-6 text-center text-[#fbf8f1]" role="status">
      <p aria-hidden="true" className="text-[11px] tracking-[0.5em] text-[#b38b4d]">★ ★ ★</p>
      <h2 className="mt-2 text-[1.45rem] tracking-[0.04em] min-[420px]:text-3xl sm:text-4xl sm:tracking-[0.06em]" style={{ fontFamily: "var(--font-graduate), Georgia, serif", fontWeight: 400 }}>{eliminated ? "You have been eliminated, thanks for playing." : "See you next season!"}</h2>
      <p className="mt-1 text-lg italic text-[#e6d6b4]" style={{ fontFamily: "var(--font-cormorant), Georgia, serif" }}>Back August 1</p>
    </section>
  );
}
