# Sentry operating guide

This project uses Sentry for actionable production errors and a small amount of performance visibility. It deliberately does not collect player identities or session replays by default.

## Build and release requirements

- Production builds should provide `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` so the Next.js Sentry plugin can upload and associate source maps.
- Vercel should provide `VERCEL_GIT_COMMIT_SHA` to server/edge runtimes and `NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA` to the browser bundle. These values become the Sentry release name.
- Keep `NEXT_PUBLIC_SENTRY_DSN` as a non-sensitive Production variable only. Never put an auth token in a `NEXT_PUBLIC_*` variable.

## Recommended project alerts

Configure these in Sentry for the production environment:

1. **New production issue:** notify when a new issue is first seen, with the route and release in the notification.
2. **Error spike:** notify when an issue exceeds 5 events in 5 minutes or 20 events in 1 hour. This catches a broken deploy without paging on a single mobile network blip.
3. **Regression after deploy:** notify when an issue first seen in the current release affects at least 3 events or 2 users in 30 minutes.
4. **Unresolved admin failures:** notify on `app.surface:admin` when the same issue recurs after it has been resolved.

Route tags are pathname-only (`app.route`) and never include query strings. Network failures captured by the admin player page include only the endpoint and method, never authorization headers or player data.

## Triage checklist

1. Open the issue and confirm the release, environment, `app.route`, and `error.kind`.
2. Check whether the issue is a single browser/network event or a release-wide regression.
3. Use the linked source-mapped frame and request context to reproduce locally.
4. Resolve only after a production verification confirms the fix; leave recurring issues unresolved so the regression alert remains useful.

## Replay and privacy

Browser replay is sampled only when an error is captured. All text is masked and media is blocked. `sendDefaultPii` remains disabled, and the event filter removes user identity fields. Do not add request bodies, access tokens, PINs, or email addresses to Sentry contexts.
