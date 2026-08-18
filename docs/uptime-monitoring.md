# Uptime monitoring

The public health URL is:

`https://pickemjb.vercel.app/api/health`

The background-automation heartbeat URL is:

`https://pickemjb.vercel.app/api/health/automation`

It returns HTTP 200 only when the deployed app can complete a lightweight
Supabase database query. It returns HTTP 503 when that check fails, without
exposing database or application details.

## Recommended setup

1. Keep the existing site monitor pointed at `/api/health`.
2. Create a second HTTP monitor named **PickemJB automation heartbeat** and
   point it at `/api/health/automation` with a five-minute interval.
3. Treat any non-200 response or timeout as down.
4. Add Tyler's email and text/push destination as the alert contacts.
5. Set a recovery notification so an outage and its resolution are both visible.

The automation URL returns 200 only when the internal watchdog has completed
successfully within the last 12 minutes. This independently proves the monitor
that watches line locks, scores, schedules, and delivery is itself still
running. Responses are intentionally opaque; investigate details in the
Commissioner dashboard.
