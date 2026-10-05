import * as Sentry from "@sentry/nextjs";
import { prepareSentryEvent } from "@/lib/sentry-event-filter";
import { PRIVATE_DATA_COLLECTION } from "@/lib/sentry-data-collection";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  release: process.env.VERCEL_GIT_COMMIT_SHA,
  tracesSampleRate: 0.05,
  dataCollection: PRIVATE_DATA_COLLECTION,
  beforeSend: prepareSentryEvent,
});
