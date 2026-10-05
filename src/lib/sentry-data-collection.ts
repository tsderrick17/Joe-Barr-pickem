import type { NodeOptions } from "@sentry/nextjs";

type DataCollection = NonNullable<NodeOptions["dataCollection"]>;

/**
 * What the error reports may carry: nothing beyond the error itself. Sentry 11 replaced the
 * old `sendDefaultPii: false` switch with these per-category options, and their defaults
 * collect cookies, headers, user details and local variables, so each is turned off here.
 * Used by the browser, server and edge setups so they cannot drift apart.
 */
export const PRIVATE_DATA_COLLECTION: DataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
  urlQueryParams: false,
  graphQL: { document: false, variables: false },
  genAI: { inputs: false, outputs: false },
  databaseQueryData: false,
  queues: false,
  stackFrameVariables: false,
};
