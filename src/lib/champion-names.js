/** "Alex", "Alex & Sam", "Alex, Sam & Lee": co-champions read as one title. */
export function championNames(names) {
  const list = names.filter(Boolean);
  if (list.length <= 1) return list[0] ?? null;
  return `${list.slice(0, -1).join(", ")} & ${list.at(-1)}`;
}
