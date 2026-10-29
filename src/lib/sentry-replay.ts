import * as Sentry from "@sentry/nextjs";

/** Starts the error-only screen recording. Kept in its own file so the page never downloads it until after it has appeared. */
export function startErrorReplay() {
  Sentry.addIntegration(Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }));
}
