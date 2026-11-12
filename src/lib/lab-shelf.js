/**
 * The Workshop Lab's shelf: the try-outs, newest first. The first one opens when nothing else is asked for.
 * @typedef {"tote" | "skins" | "clubhouse" | "survivor" | "feel"} LabTryOut
 */

/** @type {Array<{ id: LabTryOut, name: string }>} */
export const LAB_SHELF = [
  { id: "tote", name: "Tote board" },
  { id: "skins", name: "Pad skins" },
  { id: "clubhouse", name: "Clubhouse" },
  { id: "survivor", name: "Survivor table" },
  { id: "feel", name: "Feel test" },
];

/**
 * Which try-out to open: the one in the address (?try=), else the one last opened on this device, else the newest.
 * Anything that is not on the shelf is ignored.
 * @param {string | null | undefined} asked
 * @param {string | null | undefined} saved
 * @returns {LabTryOut}
 */
export function labChoice(asked, saved) {
  const known = (id) => LAB_SHELF.some((item) => item.id === id);
  if (known(asked)) return /** @type {LabTryOut} */ (asked);
  if (known(saved)) return /** @type {LabTryOut} */ (saved);
  return LAB_SHELF[0].id;
}
