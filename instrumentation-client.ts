import * as Sentry from "@sentry/nextjs";
import { prepareBrowserSentryEvent } from "@/lib/sentry-event-filter";
import { PRIVATE_DATA_COLLECTION } from "@/lib/sentry-data-collection";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // This pool needs actionable error reports, not player behavior analytics.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  dataCollection: PRIVATE_DATA_COLLECTION,
  beforeSend: prepareBrowserSentryEvent,
});

// The screen recording is the heaviest part of the error recorder, so it loads after the page has appeared and the browser is idle.
// It only keeps a short buffer and uploads it when an error happens (replaysOnErrorSampleRate).
// With no DSN (screenshot tests, local work) nothing can be sent, so nothing is recorded either.
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const startReplay = () => {
    const whenIdle = window.requestIdleCallback ?? ((callback: () => void) => window.setTimeout(callback, 2000));
    whenIdle(() => void import("@/lib/sentry-replay").then((replay) => replay.startErrorReplay()));
  };
  if (document.readyState === "complete") startReplay();
  else window.addEventListener("load", startReplay, { once: true });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
