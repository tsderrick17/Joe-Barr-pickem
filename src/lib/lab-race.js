// The Lab's horse race: the pool's season run as a thoroughbred race. Plain data and arithmetic, no React, so the rules the picture
// relies on (nobody runs backwards, the leader reaches the finish only when the pool is decided) can be checked on their own.
// Sample players only. Nothing here is pool data.

import { LAB_PLAYERS } from "./lab-samples.js";

/** Wins each player took in each regular-season week (two picks a week, so 0 to 2), weeks 1 to 18. */
const WEEKLY_WINS = {
  Earl: [2, 2, 1, 1, 2, 1, 1, 2, 1, /* wk 10 */ 1, 1, 1, 0, 1, 1, 1, 2, 0],
  Walt: [2, 1, 1, 2, 1, 1, 2, 1, 1, 1, 1, 0, 2, 1, 1, 1, 0, 1],
  Dottie: [1, 2, 1, 1, 2, 1, 1, 2, 1, 0, 2, 1, 1, 1, 0, 1, 1, 1],
  Rosie: [1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 0, 2, 1, 1, 1, 0, 1, 1],
  June: [1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 2, 0, 1],
  Lou: [1, 1, 2, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1],
  Marge: [1, 1, 1, 1, 0, 2, 1, 1, 1, 1, 1, 0, 1, 2, 1, 0, 1, 1],
  Hank: [1, 1, 1, 0, 2, 1, 1, 1, 0, 1, 1, 1, 0, 1, 2, 1, 0, 1],
  Bev: [1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 0, 1],
  Gus: [0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 0, 1],
};

/**
 * The playoff game days, one picks-per-player count each, and the wins each player took that day. The playoffs count from the regular
 * season's record; all 13 playoff games are picked, and a day's players can win no more than its games.
 */
export const LAB_RACE_DAYS = [
  { name: "Wild Card Saturday", short: "Wild Card Sat", games: 2, wins: { Earl: 2, Walt: 1, Dottie: 1, Rosie: 1, June: 0, Lou: 1, Marge: 1, Hank: 0, Bev: 0, Gus: 0 } },
  { name: "Wild Card Sunday", short: "Wild Card Sun", games: 3, wins: { Earl: 2, Walt: 1, Dottie: 2, Rosie: 1, June: 1, Lou: 2, Marge: 1, Hank: 1, Bev: 0, Gus: 0 } },
  { name: "Wild Card Monday", short: "Wild Card Mon", games: 1, wins: { Earl: 1, Walt: 0, Dottie: 0, Rosie: 1, June: 0, Lou: 0, Marge: 0, Hank: 0, Bev: 0, Gus: 0 } },
  { name: "Divisional Saturday", short: "Divisional Sat", games: 2, wins: { Earl: 1, Walt: 1, Dottie: 1, Rosie: 0, June: 0, Lou: 1, Marge: 0, Hank: 0, Bev: 0, Gus: 0 } },
  { name: "Divisional Sunday", short: "Divisional Sun", games: 2, wins: { Earl: 1, Walt: 0, Dottie: 1, Rosie: 0, June: 0, Lou: 0, Marge: 0, Hank: 0, Bev: 0, Gus: 0 } },
  { name: "Conference Sunday", short: "Conference Sun", games: 2, wins: { Earl: 1, Walt: 0, Dottie: 0, Rosie: 0, June: 0, Lou: 0, Marge: 0, Hank: 0, Bev: 0, Gus: 0 } },
  { name: "Super Bowl", short: "Super Bowl", games: 1, wins: { Earl: 0, Walt: 0, Dottie: 0, Rosie: 0, June: 0, Lou: 0, Marge: 0, Hank: 0, Bev: 0, Gus: 0 } },
];

export const LAB_RACE_WEEKS = 18;
const PLAYOFF_GAMES = LAB_RACE_DAYS.reduce((sum, day) => sum + day.games, 0);

/** The lanes, in the order the Pick'em standings read after week 9 (leader first). */
export const LAB_RACE_LANES = ["Earl", "Walt", "Dottie", "Rosie", "June", "Lou", "Marge", "Hank", "Bev", "Gus"];

/**
 * The race as a list of frames, one per week and then one per playoff game day, until the pool is decided. A frame holds every
 * player's wins to date, the picks still to play (`left`), who can still tie the leader, and whether the pool is decided. A player who
 * can no longer tie the leader even by winning every pick left has pulled up (the playoffs' rule about who is still eligible).
 */
function buildFrames() {
  const frames = [];
  const wins = Object.fromEntries(LAB_RACE_LANES.map((name) => [name, 0]));
  const push = (label, kind, left) => {
    const top = Math.max(...Object.values(wins));
    const leaders = LAB_RACE_LANES.filter((name) => wins[name] === top);
    const pulledUp = LAB_RACE_LANES.filter((name) => top - wins[name] > left);
    // Decided: nobody else can even tie the leader.
    const decided = leaders.length === 1 && pulledUp.length === LAB_RACE_LANES.length - 1;
    frames.push({ index: frames.length + 1, label, kind, left, wins: { ...wins }, leaders, pulledUp, decided });
    return decided;
  };
  for (let week = 1; week <= LAB_RACE_WEEKS; week++) {
    for (const name of LAB_RACE_LANES) wins[name] += WEEKLY_WINS[name][week - 1];
    push(`Week ${week}`, "week", 2 * (LAB_RACE_WEEKS - week) + PLAYOFF_GAMES);
  }
  let left = PLAYOFF_GAMES;
  for (const day of LAB_RACE_DAYS) {
    left -= day.games;
    for (const name of LAB_RACE_LANES) wins[name] += day.wins[name];
    if (push(day.name, "day", left)) break;
  }
  return frames;
}

export const LAB_RACE_FRAMES = buildFrames();

/** The frame the sample pool is "at", by default: the same week the other try-outs show. */
export const LAB_RACE_NOW = 9;

/** The moments the try-out can be set to, by frame number. */
export const LAB_RACE_MOMENTS = [
  { label: "Week 9", frame: 9 },
  { label: "Week 18", frame: LAB_RACE_WEEKS },
  { label: "Playoffs", frame: LAB_RACE_WEEKS + 4 },
  { label: "Decided", frame: LAB_RACE_FRAMES.length },
];

/** How far along the track (0 to 1, where 1 is the finish pole) each horse is at every frame. */
function buildPositions() {
  const out = [];
  const stopped = new Map();
  for (const frame of LAB_RACE_FRAMES) {
    const u = Math.min(frame.index, LAB_RACE_WEEKS) / LAB_RACE_WEEKS;
    const days = frame.index - LAB_RACE_WEEKS;
    // The leader covers most of the track across the 18 weeks, then creeps up the long final stretch a game day at a time; only the
    // moment the pool is decided carries it to the pole.
    const leaderX = frame.decided ? 1 : frame.kind === "week" ? 0.3 + 0.5 * u : 0.8 + 0.028 * days;
    // The gaps are stretched early (a single win is a length or two in week 1) and tighten as the season goes on.
    const gap = frame.decided ? 0.03 : 0.09 - 0.055 * u;
    const top = Math.max(...Object.values(frame.wins));
    const row = {};
    for (const name of LAB_RACE_LANES) {
      // A horse never runs backwards: one that fell behind this week simply holds its ground while the field moves on.
      const free = Math.max(0.05, out.length ? out[out.length - 1][name].x : 0, leaderX - gap * (top - frame.wins[name]));
      if (frame.pulledUp.includes(name) && !stopped.has(name)) stopped.set(name, out.length ? out[out.length - 1][name].x : free);
      const held = stopped.get(name);
      row[name] = { x: held !== undefined ? held : free, wins: frame.wins[name], pulledUp: frame.pulledUp.includes(name), finished: frame.decided && frame.leaders[0] === name };
    }
    out.push(row);
  }
  return out;
}

const POSITIONS = buildPositions();

/** Every horse at a frame (1 to the last): where it stands on the track, its wins, whether it has pulled up, whether it has won. */
export function labRaceAt(frame) {
  const at = Math.min(Math.max(frame, 1), LAB_RACE_FRAMES.length);
  return { frame: LAB_RACE_FRAMES[at - 1], horses: LAB_RACE_LANES.map((name) => ({ name, ...POSITIONS[at - 1][name] })) };
}

/** The headline for a frame: who leads and by how much, or who won. */
export function labRaceHeadline(frame, viewer = "Walt") {
  const { frame: now, horses } = labRaceAt(frame);
  const sorted = [...horses].sort((a, b) => b.wins - a.wins);
  const lead = sorted[0].wins - sorted[1].wins;
  const names = now.leaders.length > 1 ? `${now.leaders.slice(0, -1).join(", ")} and ${now.leaders[now.leaders.length - 1]} are level` : `${now.leaders[0]} leads by ${lead}`;
  if (now.decided) return `${now.leaders[0]} wins the pool after ${now.label}`;
  const you = sorted.findIndex((horse) => horse.name === viewer);
  const place = 1 + sorted.filter((horse) => horse.wins > sorted[you].wins).length;
  const tied = sorted.filter((horse) => horse.wins === sorted[you].wins).length > 1;
  return `${names} · You: ${tied ? "T" : ""}${place}`;
}

/** How long, in milliseconds, a replay spends getting to each frame: weeks fly by, the playoff days slow, and the finish takes a breath. */
export function labRaceStepMs(frame) {
  if (frame.decided) return 1500;
  return frame.kind === "week" ? 380 : 950;
}

export const LAB_RACE_PLAYERS = LAB_PLAYERS;
