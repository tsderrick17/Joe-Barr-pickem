/**
 * The id each production build carries so a phone still showing an old build is told on its next tap. Vercel refuses an id longer than
 * 32 characters (a whole commit hash is 40), so the first twelve of the commit are used; none outside Vercel (tests, local builds).
 * @param {string | undefined} commit
 */
export function deploymentIdFor(commit) {
  const id = (commit ?? "").trim().slice(0, 12);
  return id || undefined;
}
