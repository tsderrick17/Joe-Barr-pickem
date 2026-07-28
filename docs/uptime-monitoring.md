# Uptime monitoring

The public health URL is:

`https://pickemjb.vercel.app/api/health`

It returns HTTP 200 only when the deployed app can complete a lightweight
Supabase database query. It returns HTTP 503 when that check fails, without
exposing database or application details.

## Recommended setup

1. Create an HTTP monitor in Better Uptime or UptimeRobot.
2. Monitor the health URL with a five-minute interval.
3. Treat any non-200 response or timeout as down.
4. Add Tyler's email and text/push destination as the alert contacts.
5. Set a recovery notification so an outage and its resolution are both visible.

Use the public health URL for availability only. The Commissioner page remains
the place to review line-lock, score-sync, and season-integrity details.
