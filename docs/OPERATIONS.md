# Lead Pipe Locks operations

## Backup and retention

The weekly GitHub Action **Encrypted database backup** creates a complete
encrypted database export every Monday morning at 9:17 AM Eastern during
daylight time (8:17 AM during standard time). It retains the encrypted artifact
for 90 days.

Before enabling it, add one GitHub repository secret:

- `BACKUP_ENCRYPTION_KEY` — a unique, long passphrase stored somewhere safe
  outside GitHub.

The existing `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, and
`SUPABASE_PROJECT_ID` secrets are reused. To test, open GitHub **Actions** →
**Encrypted database backup** → **Run workflow**. Do not download or decrypt a
backup unless recovery is genuinely required.

Retention policy: scoring, picks, locks, seasons, championships, and audit
history are never automatically deleted. Operational delivery records and sync
logs are kept while the Commissioner dashboard reports their age and volume;
they are reviewed before any archival deletion so a disputed season always has
its full record.

## Provider allowance

Final-score checks use escalating cooldowns for a game that has not finalized:
15 minutes, 30 minutes, 1 hour, 2 hours, then every 6 hours. A low observed
Odds API balance reserves the remaining allowance for line integrity and is
shown as an Automation Health warning. Normal completed games still grade as
soon as the provider reports final scores.
