export function shouldRunBowlScoreSync(now = new Date()) {
  return now.getUTCMinutes() % 15 === 0;
}
