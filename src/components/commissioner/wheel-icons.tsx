/** The Commissioner Wheel's icons: plain line drawings in the page's own colour, drawn inline so nothing extra is downloaded. */

const PATHS: Record<string, string[]> = {
  football: ["M21 3c-6.5 0-11.5 1.6-14.4 4.6S3 14.5 3 21c6.5 0 11.5-1.6 14.4-4.6S21 9.5 21 3z", "M15 9l-6 6", "M10 12l2 2", "M12 10l2 2", "M8 14l2 2", "M14 8l2 2"],
  heartbeat: ["M19.5 13.6L12 21l-7.5-7.4A5 5 0 1 1 12 7a5 5 0 1 1 7.5 6.6", "M3 13h3l2-3l3 5l2-3h2"],
  mail: ["M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M3 7l9 6l9-6"],
  users: ["M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8z", "M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2", "M16 3.1a4 4 0 0 1 0 7.8", "M21 21v-2a4 4 0 0 0-3-3.9"],
  trophy: ["M8 21h8", "M12 17v4", "M7 4h10", "M17 4v8a5 5 0 0 1-10 0V4", "M5 11a2 2 0 1 1 0-4h2", "M19 11a2 2 0 1 0 0-4h-2"],
  calendar: ["M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z", "M16 3v4", "M8 3v4", "M4 11h16", "M8 15h2v2H8z"],
  chart: ["M3 21h18", "M5 21V13h3v8", "M10.5 21V8h3v13", "M16 21V4h3v17"],
  coin: ["M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z", "M14.8 9a2 2 0 0 0-1.8-1h-2a2 2 0 1 0 0 4h2a2 2 0 1 1 0 4h-2a2 2 0 0 1-1.8-1", "M12 6v2", "M12 16v2"],
  gauge: ["M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z", "M12 13a1 1 0 1 0 0-2a1 1 0 0 0 0 2z", "M13.4 10.6L16 8", "M7 12a5 5 0 0 1 5-5"],
  wand: ["M6 21L21 6l-3-3L3 18l3 3", "M15 6l3 3", "M9 3a2 2 0 0 0 2 2a2 2 0 0 0-2 2a2 2 0 0 0-2-2a2 2 0 0 0 2-2", "M19 13a2 2 0 0 0 2 2a2 2 0 0 0-2 2a2 2 0 0 0-2-2a2 2 0 0 0 2-2"],
  book: ["M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0", "M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0", "M3 6v13", "M12 6v13", "M21 6v13"],
  close: ["M18 6L6 18", "M6 6l12 12"],
  left: ["M15 6l-6 6l6 6"],
  right: ["M9 6l6 6l-6 6"],
  wheel: ["M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z", "M12 15a3 3 0 1 0 0-6a3 3 0 0 0 0 6z", "M12 3v6", "M12 15v6", "M3 12h6", "M15 12h6"],
};

export function WheelIcon({ name, className }: { name: string; className?: string }) {
  return <svg aria-hidden="true" className={className} fill="none" focusable="false" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24">
    {(PATHS[name] ?? []).map((d) => <path d={d} key={d} />)}
  </svg>;
}
