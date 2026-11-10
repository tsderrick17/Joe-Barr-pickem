/**
 * The Commissioner Wheel: its ten spokes, what each one says, and how the bottom dial decides where a drag lands.
 * Kept free of the browser so the rules can be tested directly.
 */

/** @typedef {"ok" | "warn" | "bad" | "idle"} SpokeState */
/** @typedef {{ key: string, name: string, href: string, group: number, icon: string, line: string }} Spoke */

/** The four groups, clockwise from the top, each with its band colour on the wheel. */
export const GROUPS = [
  { label: "EVERY WEEK", color: "#2b6b52" },
  { label: "THE SEASON", color: "#8a6a35" },
  { label: "THE NUMBERS", color: "#2f5876" },
  { label: "WORKSHOP", color: "#8e1a2c" },
];

/** @type {Spoke[]} */
export const SPOKES = [
  { key: "gameday", name: "Game day", href: "/admin/gameday", group: 0, icon: "football", line: "The week's games, fixes and checks" },
  { key: "health", name: "Health", href: "/admin/health", group: 0, icon: "heartbeat", line: "Automation, alerts, sign-in and the log" },
  { key: "messages", name: "Messages", href: "/admin/reminders", group: 0, icon: "mail", line: "Emails and phone messages" },
  { key: "players", name: "Players", href: "/admin/players", group: 0, icon: "users", line: "Who is in the pool" },
  { key: "bowl", name: "Bowl Pool", href: "/admin/bowl-pool", group: 1, icon: "trophy", line: "Bowl schedule, lines and fixes" },
  { key: "season", name: "Season", href: "/admin/season", group: 1, icon: "calendar", line: "Set-up, schedule and readiness" },
  { key: "stats", name: "Pool stats", href: "/admin/stats", group: 2, icon: "chart", line: "How the pool picks, every season on record" },
  { key: "odds", name: "Odds credits", href: "/admin/odds", group: 2, icon: "coin", line: "What the odds feed spends, and how fast finals arrive" },
  { key: "limits", name: "Free limits", href: "/admin/limits", group: 2, icon: "gauge", line: "Every account the site runs on, inside its free lane" },
  { key: "workshop", name: "Workshop", href: "/admin/workshop", group: 3, icon: "wand", line: "Every custom piece of the pool" },
];

export const SPOKE_COUNT = SPOKES.length;

/** Which spoke an address belongs to, or -1 for the Wheel itself and anything else. */
export function spokeIndexForPath(pathname) {
  const path = String(pathname ?? "").replace(/\/+$/, "");
  return SPOKES.findIndex((spoke) => path === spoke.href || path.startsWith(`${spoke.href}/`));
}

/** Stages of the live operations map that belong to the Season spoke; every other stage is Game day's. */
const SEASON_STAGES = new Set(["schedule"]);

/**
 * What each spoke shows on the wheel, from the live operations map: a state (the ring colour) and, when something needs the Commissioner,
 * a count. A spoke the map says nothing about is "idle". With no map yet (still loading, or it failed) every spoke is idle.
 * @param {{ stages?: Array<{ id: string, state: string, label: string }>, openIncidentCount?: number, providerCreditSnapshot?: { used: number, limit: number } | null } | null | undefined} map
 * @returns {Record<string, { state: SpokeState, count: number, line?: string }>}
 */
export function spokeStatus(map) {
  /** @type {Record<string, { state: SpokeState, count: number, line?: string }>} */
  const status = Object.fromEntries(SPOKES.map((spoke) => [spoke.key, { state: "idle", count: 0 }]));
  if (!map) return status;
  const stages = map.stages ?? [];
  const gameStages = stages.filter((stage) => !SEASON_STAGES.has(stage.id));
  const seasonStages = stages.filter((stage) => SEASON_STAGES.has(stage.id));
  const attention = (list) => list.filter((stage) => stage.state === "attention").length;

  const gameAttention = attention(gameStages);
  const active = gameStages.find((stage) => stage.state === "active");
  status.gameday = gameAttention
    ? { state: "warn", count: gameAttention, line: `${gameAttention} to review` }
    : { state: "ok", count: 0, line: active ? `Now: ${active.label}` : "Running normally" };

  const seasonAttention = attention(seasonStages);
  status.season = seasonAttention ? { state: "warn", count: seasonAttention, line: "Needs set-up" } : { state: "ok", count: 0, line: "Set up" };

  const incidents = Math.max(0, Number(map.openIncidentCount ?? 0));
  status.health = incidents
    ? { state: "bad", count: incidents, line: `${incidents} open incident${incidents === 1 ? "" : "s"}` }
    : { state: "ok", count: 0, line: "All quiet" };

  const credits = map.providerCreditSnapshot;
  if (credits && credits.limit > 0) {
    const share = credits.used / credits.limit;
    status.odds = { state: share >= 0.88 ? "warn" : "ok", count: 0, line: `${credits.used} of ${credits.limit} used` };
  }
  return status;
}

/**
 * The "Needs you" list in the middle of the wheel: every stage that needs attention, then the watchdog's open incidents.
 * @returns {Array<{ title: string, detail: string, href: string, state: SpokeState }>}
 */
export function needsYou(map) {
  if (!map) return [];
  const items = (map.stages ?? [])
    .filter((stage) => stage.state === "attention")
    .map((stage) => ({
      title: stage.label,
      detail: stage.detail ?? "",
      href: SEASON_STAGES.has(stage.id) ? "/admin/season" : "/admin/gameday",
      state: /** @type {SpokeState} */ ("warn"),
    }));
  const incidents = Math.max(0, Number(map.openIncidentCount ?? 0));
  if (incidents) {
    items.push({
      title: `${incidents} open watchdog incident${incidents === 1 ? "" : "s"}`,
      detail: "The automation watchdog has something open",
      href: "/admin/health",
      state: "bad",
    });
  }
  return items;
}

/** Wraps a spoke number around the dial: one past the last is the first. */
export function wrap(index, count = SPOKE_COUNT) {
  return ((index % count) + count) % count;
}

/** How far apart neighbours sit on the dial, and how many show each side, for a screen this wide. */
export function dialGeometry(width) {
  const visible = width < 500 ? 2 : 3;
  return { visible, gap: Math.min(64, Math.max(36, (width - 150) / (2 * visible))) };
}

/**
 * Where one medallion sits on the dial's arc when the dial is turned to `position` (a spoke number, fractional while dragging).
 * The medallions ride a circle of `radius` px whose top is the dial's centre; the nearer to the centre, the bigger.
 */
export function dialPlace(index, position, { count = SPOKE_COUNT, visible, gap, radius }) {
  let offset = wrap(index - position, count);
  if (offset >= count / 2) offset -= count;
  const distance = Math.abs(offset);
  const angle = (offset * gap) / radius;
  return {
    x: radius * Math.sin(angle),
    y: radius * (1 - Math.cos(angle)),
    scale: distance <= 1 ? 1.2 - 0.3 * distance : 0.9 - 0.09 * (distance - 1),
    opacity: distance > visible + 0.4 ? 0 : Math.max(0, 1 - distance * 0.2),
    reachable: distance <= visible,
  };
}

/** The dial's position while a finger drags it `dx` px from where it started. */
export function dragPosition(start, dx, gap) {
  return start - dx / gap;
}

/**
 * Where a drag ends. Lifting the finger above the dial cancels it (stay put). A quick flick that did not reach the next notch still moves one
 * page, in the direction of the flick. Otherwise it opens the spoke nearest the centre, which may be the current page (stay put).
 * @returns {number} the spoke to open, or `current` to stay.
 */
export function releaseTarget({ current, nearest, moved, velocity = 0, cancelled = false, count = SPOKE_COUNT }) {
  if (cancelled || !moved) return current;
  if (nearest === current && Math.abs(velocity) > 0.45) return wrap(current + (velocity < 0 ? 1 : -1), count);
  return nearest;
}

/** The damped to-and-fro of the dial settling on a page: where it is `seconds` after letting go, starting `from` and settling on `target`. */
export function swingAt(target, from, seconds) {
  if (seconds >= 1.4) return target;
  return target + (from - target) * Math.exp(-5.5 * seconds) * Math.cos(2 * Math.PI * 1.6 * seconds);
}

/** The shortest way round from one dial position to a spoke, so the swing never takes the long way. */
export function nearestTurn(from, target, count = SPOKE_COUNT) {
  let start = from;
  while (start - target > count / 2) start -= count;
  while (target - start > count / 2) start += count;
  return start;
}
