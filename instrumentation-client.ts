import * as Sentry from "@sentry/nextjs";
import { prepareBrowserSentryEvent } from "@/lib/sentry-event-filter";
import { PRIVATE_DATA_COLLECTION } from "@/lib/sentry-data-collection";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // This pool needs actionable error reports, not player behavior analytics.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  integrations: [
    // Use the SDK's own replay so every Sentry package shares one version.
    Sentry.replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }),
  ],
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  dataCollection: PRIVATE_DATA_COLLECTION,
  beforeSend: prepareBrowserSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
