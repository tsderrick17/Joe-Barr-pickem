import Link from "next/link";

/** The Workshop's two rooms: the Showroom (every live piece) and the Lab (try-outs before they reach players). */
export function WorkshopTabs({ current }: { current: "showroom" | "lab" }) {
  return (
    <nav aria-label="Workshop" className="workshop-tabs">
      <Link aria-current={current === "showroom" ? "page" : undefined} href="/admin/workshop">Showroom</Link>
      <Link aria-current={current === "lab" ? "page" : undefined} href="/admin/workshop/lab">Lab</Link>
    </nav>
  );
}
