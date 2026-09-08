const REQUIRED_COLUMNS = ["order", "bowl_name", "kickoff_at", "game_key"];

export function normalizeBowlDisplayName(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function parseLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') { cell += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { cells.push(cell.trim()); cell = ""; continue; }
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

export function parseBowlPoolScheduleCsv(input) {
  const lines = String(input ?? "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("Schedule CSV is empty.");
  const headers = parseLine(lines[0]).map((header) => header.toLowerCase());
  for (const required of REQUIRED_COLUMNS) {
    if (!headers.includes(required)) throw new Error(`Schedule CSV is missing required column: ${required}.`);
  }
  const rows = lines.slice(1).map((line, index) => {
    const values = parseLine(line);
    const row = Object.fromEntries(headers.map((header, column) => [header, values[column] ?? ""]));
    const order = Number(row.order);
    if (!Number.isInteger(order) || order < 1) throw new Error(`Row ${index + 2} has an invalid order.`);
    if (!row.game_key.trim() || !row.bowl_name.trim()) throw new Error(`Row ${index + 2} needs a game_key and bowl_name.`);
    const kickoff = new Date(row.kickoff_at);
    if (Number.isNaN(kickoff.getTime())) throw new Error(`Row ${index + 2} has an invalid kickoff_at.`);
    return {
      provider_game_id: row.game_key.trim(),
      bowl_name: normalizeBowlDisplayName(row.bowl_name),
      kickoff_at: kickoff.toISOString(),
      line_lock_at: kickoff.toISOString(),
      order_index: order,
      away_team: row.away_team?.trim() || null,
      home_team: row.home_team?.trim() || null,
      spread: row.spread?.trim() || null,
      is_cfp: ["true", "1", "yes"].includes(String(row.is_cfp ?? "").toLowerCase()),
    };
  });
  const keys = new Set(); const orders = new Set();
  for (const row of rows) {
    if (keys.has(row.provider_game_id)) throw new Error(`Duplicate game_key: ${row.provider_game_id}.`);
    if (orders.has(row.order_index)) throw new Error(`Duplicate order: ${row.order_index}.`);
    keys.add(row.provider_game_id); orders.add(row.order_index);
  }
  return rows.sort((a, b) => a.order_index - b.order_index);
}
