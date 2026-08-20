# Uptime monitoring

The public health URL is:

`https://pickemjb.vercel.app/api/health`

The background-automation heartbeat URL is:

`https://pickemjb.vercel.app/api/health/automation`

The critical-worker heartbeat URL is:

`https://pickemjb.vercel.app/api/health/workers`

All three health endpoints return only an opaque HTTP 200 or 503 response.
They never expose database, worker, or application details publicly.

## Recommended setup

1. Keep the existing site monitor pointed at `/api/health`.
2. Keep **PickemJB automation heartbeat** pointed at
   `/api/health/automation` with a five-minute interval.
3. Create **PickemJB critical workers**, pointed at `/api/health/workers` with
   a five-minute interval.
4. Create a weekly heartbeat monitor named **PickemJB encrypted backup** and
   store its private ping URL as the GitHub Production environment secret
   `UPTIMEROBOT_BACKUP_HEARTBEAT_URL`. Never publish that URL.
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

The encrypted-backup heartbeat is sent only after the weekly export is
encrypted, decrypted, restored into the verification database, and retained as
a workflow artifact. A missed ping therefore means the complete backup proof
did not finish—not merely that GitHub Actions started the job.
