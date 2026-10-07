// next/server with `after` replaced: outside a real request, Next's after() refuses to run. The route's background
// work is collected so a test can run it, or ignore it, deliberately.
import * as real from "next/server.js";

export const NextResponse = real.NextResponse;
export const NextRequest = real.NextRequest;
export const after = (callback) => { (globalThis.routeAfterCallbacks ??= []).push(callback); };
export default real;
