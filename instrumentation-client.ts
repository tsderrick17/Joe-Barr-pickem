import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // This pool needs actionable error reports, not player behavior analytics.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend(event) {
    // Never attach a player's identity, email address, or other account data.
    delete event.user;
    return event;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
