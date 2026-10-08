// A scripted stand-in for the Supabase client: every query-builder call is recorded, and awaiting the chain asks
// `respond(table, calls)` for `{ data, error }`. For tests of one function's decisions (what it reads, whether it
// writes), where the shared fake database (which counts writes but keeps no state) is more than needed or too little.
export function recordingDatabase(respond, { rpc = () => ({ data: null, error: null }) } = {}) {
  const queries = [];
  const rpcCalls = [];
  return {
    queries,
    rpcCalls,
    from(table) {
      const calls = [];
      const query = { table, calls };
      queries.push(query);
      const chain = new Proxy({}, {
        get(_, property) {
          if (property === "then") return (resolve, reject) => Promise.resolve(respond(table, calls)).then(resolve, reject);
          return (...args) => { calls.push([property, args]); return chain; };
        },
      });
      return chain;
    },
    rpc(name, args) {
      rpcCalls.push({ name, args });
      return Promise.resolve(rpc(name, args));
    },
  };
}
export const wrote = (calls) => calls.some(([name]) => ["insert", "update", "upsert", "delete"].includes(name));
export const insertedRow = (calls) => calls.find(([name]) => name === "insert")?.[1][0];
