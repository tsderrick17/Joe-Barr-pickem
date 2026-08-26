import * as Sentry from "@sentry/nextjs";
import { prepareBrowserSentryEvent } from "@/lib/sentry-event-filter";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // This pool needs actionable error reports, not player behavior analytics.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: prepareBrowserSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
