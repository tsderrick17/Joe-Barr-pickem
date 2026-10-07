// A small in-memory stand-in for the PostgREST client, enough to run the real route handlers against fictional
// tables and count what they cost: how many requests, how many rows come back, and how many bytes. It supports
// the builder methods the player routes use (select with a plain column list, eq, neq, in, is, not, order, range,
// limit, maybeSingle, single, and writes that only count) and fails loudly on anything else, so a route that
// starts using something new cannot slip past the measurement unnoticed.

function parseColumns(text) {
  const columns = String(text ?? "*").split(",").map((column) => column.trim()).filter(Boolean);
  if (columns.some((column) => /[()!:]/.test(column))) throw new Error(`The fake database does not support embedded selects: ${text}`);
  return columns;
}

export function createFakeDatabase(tables, { rpc = {} } = {}) {
  const requests = [];

  function record(entry) {
    requests.push(entry);
    return entry;
  }

  function from(table) {
    if (!(table in tables)) throw new Error(`The fake database has no table "${table}".`);
    const state = { table, columns: ["*"], filters: [], order: [], range: null, limit: null, single: null, write: null };

    const builder = {
      select(columns) { if (!state.write) state.columns = parseColumns(columns); return builder; },
      eq(column, value) { state.filters.push((row) => row[column] === value); return builder; },
      neq(column, value) { state.filters.push((row) => row[column] !== value); return builder; },
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
      then(resolve, reject) { return Promise.resolve(run()).then(resolve, reject); },
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
      const project = (row) => (state.columns[0] === "*" ? row : Object.fromEntries(state.columns.map((column) => [column, row[column]])));
      const data = rows.map(project);
      const result = state.single ? { data: data[0] ?? null, error: state.single === "one" && !data.length ? { code: "PGRST116", message: "no rows" } : null } : { data, error: null };
      record({ kind: "table", table, op: "select", rows: data.length, bytes: JSON.stringify(result.data).length });
      return result;
    }
    return builder;
  }

  return {
    requests,
    client: {
      from,
      rpc(name, args) {
        const handler = rpc[name];
        const data = typeof handler === "function" ? handler(args) : (handler ?? null);
        record({ kind: "rpc", table: name, op: "rpc", rows: Array.isArray(data) ? data.length : data == null ? 0 : 1, bytes: JSON.stringify(data ?? null).length });
        return Promise.resolve({ data, error: null });
      },
      auth: { admin: {} },
    },
  };
}
