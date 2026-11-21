/**
 * The screenshot set every page follows (owner, 2026-11-21), so a state is pictured enough to catch a broken layout without picturing it
 * at every width in both themes:
 *  - every state by day on a phone (390) and a desktop (1280);
 *  - by night on a phone only, and only for the states that carry the most styles (night is colour tokens, not layout);
 *  - the narrow phone (360) and the tablet (700), plus any width a page names in `extra`, only for its most crowded states.
 */
export type Shot = { theme: "day" | "night"; label: string; width: number };

export function shots({ crowded = false, night = false, extra = {} }: { crowded?: boolean; night?: boolean; extra?: Record<string, number> } = {}): Shot[] {
  const widths: Record<string, number> = { "phone-390": 390, "desktop-1280": 1280, ...(crowded ? { "phone-360": 360, "tablet-700": 700, ...extra } : {}) };
  return [
    ...Object.entries(widths).sort(([, a], [, b]) => a - b).map(([label, width]) => ({ theme: "day" as const, label, width })),
    ...(night ? [{ theme: "night" as const, label: "phone-390", width: 390 }] : []),
  ];
}
