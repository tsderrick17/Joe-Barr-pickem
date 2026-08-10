# Commissioner Runbook

## Release gate

Do not publish application code that depends on a database function or trigger
until the production database reports it as present. For the combined ATS and
Survivor release, run this read-only check in the Supabase SQL Editor:

```sql
select
  to_regprocedure('public.ensure_survivor_entries(uuid)') is not null
    as ensure_entries_ready,
  to_regprocedure(
    'public.save_slate_selections(uuid,uuid,uuid,jsonb,jsonb)'
  ) is not null as atomic_save_ready,
  (
    select count(*)
    from information_schema.triggers
    where trigger_schema = 'public'
      and trigger_name in (
        'validate_survivor_pick',
        'prevent_completed_survivor_pick_changes',
        'prevent_survivor_entry_reactivation',
        'prevent_audit_log_changes'
      )
  ) as integrity_trigger_count;
```

Both readiness values must be `true`, and the trigger count must be at least
four. A failed database check blocks the release even when the application
build succeeds.

## Normal automated flow

1. In preseason, the annual bootstrap creates the new season when needed and imports only a complete, validated 272-game regular-season schedule. Every game is pinned to its original scoring period and gameweek.
2. During the season, canonical schedule reconciliation updates only unlocked timing changes. It never deletes an omitted game or silently moves a game between pool weeks; unsafe changes are quarantined for review.
3. Supabase refreshes preliminary spreads before games lock without changing final, postponed, cancelled, or no-contest statuses.
4. Supabase checks official lines every minute and locks them at each game's assigned line-lock time.
5. Players can edit a pick until that game's kickoff; picks reveal individually at kickoff.
6. Starting three hours after kickoff, the score check runs every 15 minutes. Only verified completed games are saved and graded atomically. ATS pushes are losses.
7. The major weekly recap becomes eligible Tuesday at 8 AM Eastern after every result is trustworthy. A late result sends as soon as it settles.
8. Once every game and applicable pick is settled, the completed week stays visible for at least 24 hours. The normal default handoff is Wednesday at 3 AM Eastern; a next-week kickoff within 24 hours advances immediately. The next period is manually selectable on the next Eastern day, and every completed week remains accessible. Postponed, cancelled, missing-line, or ungraded records block an unsafe automatic handoff for commissioner review.

## Before the season

1. In Commissioner, confirm automatic bootstrap reports all 272 regular-season games across 18 weeks. Use the preview-first manual import only if the guarded automatic path needs recovery.
2. Confirm each game is assigned and pinned to the correct scoring week.
3. Confirm playoff scoring periods retain their configured pick counts: Wild Card 6, Divisional Round 4, Conference Championships 2, and Super Bowl 1.
4. Confirm active players can sign in and make a pick.
5. Confirm the automatic jobs are active in Supabase:
   - `lock-official-lines-every-minute`
   - `refresh-nfl-schedule-and-spreads-prelock-early`
   - `refresh-nfl-schedule-and-spreads-prelock-standard`
   - `refresh-final-nfl-scores-every-15-minutes`

   Run **Automation Preflight** to verify these schedules and their shared
   secret. The root-level numbered SQL files are historical build evidence and
   must not be replayed. Restore missing database behavior only through a new
   timestamped migration and the guarded Supabase migration workflow.

## Weekly dress rehearsal

Use test player accounts before Week 1 to verify:

1. A player can submit one pick and then add a second.
2. A player can change or remove an unstarted-game pick.
3. A player cannot change a pick after that game's kickoff.
4. Other players see a lock indicator before kickoff and the pick after kickoff.
5. The Commissioner page can run **Check final scores now**.
6. The most recent score-check status is visible to the Commissioner.
7. A favorite cover, underdog cover, and ATS push produce the expected result. A push must be a loss.
8. Commissioner shows no unexpected entries in **Game Exceptions**.
9. Commissioner shows the expected **Weekly handoff** state after the final score check.
10. A week with a pending final-game pick does not rubber-stamp until that pick is resolved.
11. Confirm the imported preview assigns future postseason games, in order, to Wild Card, Divisional Round, Conference Championships, and Super Bowl.

## Score recovery

If a final score appears missing:

1. Open Commissioner.
2. Choose **Check final scores now**.
3. Check the reported result and then **View most recent check**.
4. If the check failed, retain the displayed error and retry after the provider recovers.
5. If a game has no official line, its pick remains pending until the line issue is resolved.

## Important constraints

- Do not edit a locked official line without recording the reason.
- Do not manually change a final score unless the provider is wrong and the correction is documented.
- A postponed or cancelled game automatically voids its pending ATS and Survivor picks. The original receipt remains in the audit log; it is not a loss and does not consume an ATS slot or Survivor team. Players may replace it only with a game that has not started. These games still block automatic weekly handoff for commissioner review.
- A declared **no contest** never advances Survivor. A pending pick remains changeable if a legal replacement exists; when no legal replacement remains, ATS settles as a loss (the pool's push rule) and the Survivor entry is eliminated. No-contest games are excluded from future playoff-win capacity and never wait forever for a final-score feed.
- In **Commissioner → Game Exceptions**, record verified postponed, cancelled, or no-contest games. This is intentionally a commissioner action: schedule refreshes never silently overwrite a game's final or disruption status.
- Once a week is rubber-stamped, its period, games, picks, and official lines are database-locked. Complete any correction process before the automated handoff.
- Audit records are append-only. Record a correction as a new audit event; never rewrite the original history.
- Every ATS and Survivor save has a separate audit event. ATS records use `against_spread`; Survivor records use `straight_up` with `spread_applied: false`.

## Survivor

- Every active player is entered automatically when Survivor is opened for the season.
- A player selects one straight-up winner per scoring period and cannot reuse a team.
- A Survivor pick can be changed or cleared until its game's kickoff.
- Final scores are evaluated by the existing final-score job. A loss or tie eliminates the entry.
- A missed required weekly Survivor pick is an automatic elimination after the final eligible kickoff. A no-contest game does not create a Survivor advancement or a false no-pick elimination.
- Survivor database changes follow the current timestamped migration workflow and isolated lifecycle tests. Never replay the historical root-level migrations 027 through 030.
