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

1. Supabase refreshes the NFL schedule and preliminary spreads before the 8 AM Eastern line lock during NFL months without changing final, postponed, or cancelled game statuses.
2. Supabase checks official lines every minute and locks them at each game's assigned line-lock time.
3. Players can edit a pick until that game's kickoff; picks reveal at kickoff.
4. Starting three hours after kickoff, the score check runs every 15 minutes.
5. Only completed games are saved and graded. ATS pushes are losses.
6. Once every game in the active week is final and every final-game pick is graded, that week remains on the Standings for at least 24 hours. The normal handoff is Wednesday at 3 AM Eastern; a next-week kickoff within 24 hours advances immediately. Postponed, cancelled, or ungraded final-game picks block the automatic handoff for commissioner review.

## Before the season

1. In Commissioner, preview and import the available games.
2. Confirm each game is assigned to the correct scoring week.
3. Confirm playoff scoring periods retain their configured pick counts: Wild Card 6, Divisional Round 4, Conference Championships 2, and Super Bowl 1.
4. Confirm active players can sign in and make a pick.
5. Confirm the automatic jobs are active in Supabase:
   - `lock-official-lines-every-minute`
   - `refresh-nfl-schedule-and-spreads-prelock-early`
   - `refresh-nfl-schedule-and-spreads-prelock-standard`
   - `refresh-final-nfl-scores-every-15-minutes`

   Run these files once in the Supabase SQL Editor to create or restore the automated jobs:
   - `supabase/019_schedule_final_score_refresh.sql`
   - `supabase/020_schedule_daily_nfl_refresh.sql`
   - `supabase/021_schedule_official_line_locking.sql`
   - `supabase/022_add_line_lock_sync_runs.sql`
   - `supabase/023_freeze_completed_scoring_periods.sql`
   - `supabase/024_add_runtime_query_indexes.sql`
   - `supabase/025_store_game_finalization_times.sql`
   - `supabase/026_replace_unlocked_picks_atomically.sql`
   - `supabase/027_add_survivor_pick_integrity.sql`
   - `supabase/028_save_slate_selections_atomically.sql`
   - `supabase/029_harden_survivor_and_audit_history.sql`
   - `supabase/030_separate_ats_and_survivor_audits.sql`
   - `supabase/031_repair_ats_atomic_replacements.sql`
   - `supabase/033_repair_completed_change_delete_guards.sql`
   - `supabase/034_schedule_prelock_spread_refresh.sql`
   - `supabase/035_restore_mode_specific_audits.sql`
   - `supabase/036_harden_scoring_period_continuity.sql`
   - `supabase/037_add_automation_execution_leases.sql`
   - `supabase/038_finalize_games_atomically.sql`
   - `supabase/039_add_automation_preflight.sql`
   - `supabase/040_void_disrupted_game_picks.sql`
   - `supabase/041_record_game_disruptions_atomically.sql`
   - `supabase/042_repair_disrupted_pick_voiding.sql`

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
- In **Commissioner → Game Exceptions**, record verified postponed or cancelled games. This is intentionally a commissioner action: schedule refreshes never silently overwrite a game's final or disruption status.
- Once a week is rubber-stamped, its period, games, picks, and official lines are database-locked. Complete any correction process before the automated handoff.
- Audit records are append-only. Record a correction as a new audit event; never rewrite the original history.
- Every ATS and Survivor save has a separate audit event. ATS records use `against_spread`; Survivor records use `straight_up` with `spread_applied: false`.

## Survivor

- Every active player is entered automatically when Survivor is opened for the season.
- A player selects one straight-up winner per scoring period and cannot reuse a team.
- A Survivor pick can be changed or cleared until its game's kickoff.
- Final scores are evaluated by the existing final-score job. A loss or tie eliminates the entry.
- Run migrations 027 through 030 before publishing Survivor. Together they add automatic enrollment, atomic Slate saves, separate ATS and straight-up Survivor audit records, append-only history, completed-week protection, and irreversible elimination records.
