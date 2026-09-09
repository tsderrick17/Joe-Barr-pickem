/** @param {{ eliminated?: string[]; remaining: number; champions?: string[] }} summary */
export function bowlRecapCopy({ eliminated = [], remaining, champions = [] }) {
  const parts = [];
  if (eliminated.length) parts.push(`${eliminated.join(", ")} ${eliminated.length === 1 ? "was" : "were"} eliminated today.`);
  if (Number.isInteger(remaining)) parts.push(`${remaining} ${remaining === 1 ? "entry remains" : "entries remain"}.`);
  if (champions.length === 1) parts.push(`Congratulations, ${champions[0]} — Bowl Pool Champion!`);
  if (champions.length > 1) parts.push(`Congratulations to our Bowl Pool co-champions: ${champions.join(", ")}!`);
  return parts.join(" ");
}
