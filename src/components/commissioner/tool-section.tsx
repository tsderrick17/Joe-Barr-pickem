import type { ReactNode } from "react";

/** A titled group of tools on a Commissioner page, always open (the old fold-down drawers are gone). */
export function ToolSection({ id, title, line, children }: { id: string; title: string; line: string; children: ReactNode }) {
  return <section aria-labelledby={`cw-${id}`} className="cw-section">
    <h2 id={`cw-${id}`}>{title}</h2>
    <p className="cw-section-line">{line}</p>
    {children}
  </section>;
}
