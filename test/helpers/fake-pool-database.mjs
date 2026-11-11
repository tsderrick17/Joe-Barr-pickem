// A small in-memory stand-in for the PostgREST client, enough to run the real route handlers against fictional
// tables and count what they cost: how many requests, how many rows come back, and how many bytes. It supports
// the builder methods the player routes use (select with a plain column list, eq, neq, lt, in, is, not, order, range,
// limit, maybeSingle, single, and writes that only count) and fails loudly on anything else, so a route that
// starts using something new cannot slip past the measurement unnoticed. One embedded select is understood: an inner
// join to the table a row points at (`scoring_periods!inner(season_id)` on a row with `scoring_period_id`), filtered
// through dotted columns (`scoring_periods.season_id`).

const EMBED = /^(\w+)!inner\(([^()]*)\)$/;
function parseColumns(text) {
  const columns = [];
  let depth = 0;
  let current = "";
  for (const character of String(text ?? "*")) {
    if (character === "(") depth += 1;
    if (character === ")") depth -= 1;
    if (character === "," && depth === 0) { columns.push(current.trim()); current = ""; } else current += character;
  }
  columns.push(current.trim());
  const kept = columns.filter(Boolean);
  if (kept.some((column) => /[()!:]/.test(column) && !EMBED.test(column))) throw new Error(`The fake database does not support this embedded select: ${text}`);
  return kept;
}

export function createFakeDatabase(tables, { rpc = {} } = {}) {
  const requests = [];
  // Every query answers on the next turn of the event loop, together with every other query started in the same
  // turn, like a database that answers concurrent queries in one round trip. `rounds` counts those turns: how many
  // times a read had to wait on the database one after another.
  let rounds = 0;
  let waiting = [];
  function answerLater(answer) {
    return new Promise((resolve) => {
      if (waiting.length === 0) setImmediate(() => { rounds += 1; const ready = waiting; waiting = []; for (const finish of ready) finish(); });
      waiting.push(() => resolve(answer()));
    });
  }

  function record(entry) {
    requests.push(entry);
    return entry;
  }

  function from(table) {
    if (!(table in tables)) throw new Error(`The fake database has no table "${table}".`);
    const state = { table, columns: ["*"], filters: [], order: [], range: null, limit: null, single: null, write: null };

    const builder = {
      select(columns) { if (!state.write) state.columns = parseColumns(columns); return builder; },
      eq(column, value) { state.filters.push((row) => read(row, column) === value); return builder; },
      neq(column, value) { state.filters.push((row) => read(row, column) !== value); return builder; },
      lt(column, value) { state.filters.push((row) => read(row, column) < value); return builder; },
      in(column, values) { const set = new Set(values); state.filters.push((row) => set.has(row[column])); return builder; },
      is(column, value) { state.filters.push((row) => (value === null ? row[column] == null : row[column] === value)); return builder; },
      not(column, operator, value) {
        if (operator !== "is") throw new Error(`The fake database does not support not(${operator}).`);
        state.filters.push((row) => (value === null ? row[column] != null : row[column] !== value));
        return builder;
      },
      or() { return builder; },
      order(column, options = {}) { state.order.push({ column, ascending: options.ascending !== false }); return builder; },
      range(from, to) { state.range = [from, to]; return builder; },
      limit(count) { state.limit = count; return builder; },
      maybeSingle() { state.single = "maybe"; return builder; },
      single() { state.single = "one"; return builder; },
      insert() { state.write = "insert"; return builder; },
      update() { state.write = "update"; return builder; },
      upsert() { state.write = "upsert"; return builder; },
      delete() { state.write = "delete"; return builder; },
      then(resolve, reject) { return answerLater(run).then(resolve, reject); },
    };

    // The row a row points at in an embedded table: `scoring_periods` through `scoring_period_id`.
    const joined = (row, embedded) => {
      if (!(embedded in tables)) throw new Error(`The fake database has no table "${embedded}".`);
      return tables[embedded].find((other) => other.id === row[`${embedded.replace(/s$/, "")}_id`]) ?? null;
    };
    const read = (row, column) => {
      if (!column.includes(".")) return row[column];
      const [embedded, field] = column.split(".");
      return joined(row, embedded)?.[field];
    };

    function run() {
      if (state.write) {
        record({ kind: "table", table, op: state.write, rows: 0, bytes: 0 });
        return { data: null, error: null, count: null };
      }
      let rows = tables[table].filter((row) => state.filters.every((filter) => filter(row)));
      for (const { column, ascending } of [...state.order].reverse()) {
        rows = [...rows].sort((a, b) => (a[column] === b[column] ? 0 : (a[column] < b[column] ? -1 : 1) * (ascending ? 1 : -1)));
      }
      if (state.range) rows = rows.slice(state.range[0], state.range[1] + 1);
      if (state.limit !== null) rows = rows.slice(0, state.limit);
      const embeds = state.columns.map((column) => EMBED.exec(column)).filter(Boolean);
      // An inner join keeps only rows whose joined row exists.
      for (const [, embedded] of embeds) rows = rows.filter((row) => joined(row, embedded));
      const project = (row) => (state.columns[0] === "*" ? row : Object.fromEntries(state.columns.map((column) => {
        const embed = EMBED.exec(column);
        if (!embed) return [column, row[column]];
        const other = joined(row, embed[1]);
        return [embed[1], Object.fromEntries(embed[2].split(",").map((field) => field.trim()).map((field) => [field, other[field]]))];
      })));
      const data = rows.map(project);
      const result = state.single ? { data: data[0] ?? null, error: state.single === "one" && !data.length ? { code: "PGRST116", message: "no rows" } : null } : { data, error: null };
      record({ kind: "table", table, op: "select", rows: data.length, bytes: JSON.stringify(result.data).length });
      return result;
    }
    return builder;
  }

  return {
    requests,
    get rounds() { return rounds; },
    client: {
      from,
      rpc(name, args) {
        const handler = rpc[name];
        return answerLater(() => {
          const data = typeof handler === "function" ? handler(args) : (handler ?? null);
          record({ kind: "rpc", table: name, op: "rpc", rows: Array.isArray(data) ? data.length : data == null ? 0 : 1, bytes: JSON.stringify(data ?? null).length });
          return { data, error: null };
        });
      },
      auth: { admin: {} },
    },
  };
}
