import * as Sentry from "@sentry/nextjs";
import { replayIntegration } from "@sentry/replay";
import { prepareBrowserSentryEvent } from "@/lib/sentry-event-filter";

type SentryIntegrationOption = NonNullable<Parameters<typeof Sentry.init>[0]["integrations"]>;
type SentryIntegration = SentryIntegrationOption extends (infer Integration)[]
  ? Integration
  : never;

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // This pool needs actionable error reports, not player behavior analytics.
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  integrations: [
    replayIntegration({
      maskAllText: true,
      blockAllMedia: true,
    }) as unknown as SentryIntegration,
  ],
  tracesSampleRate: 0.05,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1,
  sendDefaultPii: false,
  beforeSend: prepareBrowserSentryEvent,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
