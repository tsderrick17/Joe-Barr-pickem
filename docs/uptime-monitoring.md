# Uptime monitoring

The public health URL is:

`https://pickemjb.vercel.app/api/health`

The background-automation heartbeat URL is:

`https://pickemjb.vercel.app/api/health/automation`

The critical-worker heartbeat URL is:

`https://pickemjb.vercel.app/api/health/workers`

The encrypted-backup health URL is:

`https://pickemjb.vercel.app/api/health/backup`

All three health endpoints return only an opaque HTTP 200 or 503 response.
They never expose database, worker, or application details publicly.

## Recommended setup

1. Keep the existing site monitor pointed at `/api/health`.
2. Keep **PickemJB automation heartbeat** pointed at
   `/api/health/automation` with a five-minute interval.
3. Create **PickemJB critical workers**, pointed at `/api/health/workers` with
   a five-minute interval.
4. Create **PickemJB encrypted backup**, pointed at `/api/health/backup` with a
   five-minute interval. This stays on UptimeRobot's free HTTP-monitor tier.
5. Treat any non-200 response, timeout, or missed heartbeat as down.
6. Add Tyler's email and text/push destination as the alert contacts.
7. Set recovery notifications so an outage and its resolution are both visible.

The automation URL returns 200 only when the internal watchdog has completed
successfully within the last 12 minutes. This independently proves the monitor
that watches line locks, scores, schedules, and delivery is itself still
running. Responses are intentionally opaque; investigate details in the
Commissioner dashboard.

The critical-worker URL separately proves that line locking succeeded within
five minutes, reminder processing within 12 minutes, and final-score processing
within 35 minutes. Its database table has exactly one row per worker, so the
monitor itself cannot create unbounded operational history.

The encrypted-backup URL reads the latest completed GitHub workflow through the
existing server-only read token. It returns 200 only when that latest run
succeeded recently. Because the workflow uploads its artifact only after
encryption and the decrypt/restore check, this proves the complete backup—not
merely that GitHub Actions started the job. It uses no paid push-heartbeat
feature and exposes no workflow details publicly.
