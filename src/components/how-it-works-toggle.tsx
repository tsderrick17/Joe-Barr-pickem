"use client";

type Props = { open: boolean; controls: string; onToggle: () => void; className: string };

/** The "How it works" button that opens and folds the instructions under it (the Slate and the Bowl Pool). The chevron turns with the fold. */
export default function HowItWorksToggle({ open, controls, onToggle, className }: Props) {
  return (
    <button aria-controls={controls} aria-expanded={open} className={`how-toggle ${className}`} onClick={onToggle} type="button">
      <span>How it works</span>
      <svg aria-hidden="true" className="how-toggle-chevron" fill="none" height="10" viewBox="0 0 12 8" width="12"><path d="M1.5 1.75 6 6.25l4.5-4.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" /></svg>
    </button>
  );
}
