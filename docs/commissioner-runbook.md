# Commissioner Runbook

## Normal automated flow

1. Supabase refreshes the NFL schedule and preliminary spreads daily during NFL months.
2. Supabase checks official lines every minute and locks them at the pool's assigned line-lock time.
3. Players can edit a pick until that game's kickoff; picks reveal at kickoff.
4. Starting three hours after kickoff, the score check runs every 15 minutes.
5. Only completed games are saved and graded. ATS pushes are losses.

## Before the season

1. In Commissioner, preview and import the available games.
2. Confirm each game is assigned to the correct pool week.
3. Confirm active players can sign in and make a pick.
4. Confirm the automatic jobs are active in Supabase:
   - `lock-official-lines-every-minute`
   - `refresh-nfl-schedule-and-spreads-daily`
   - `refresh-final-nfl-scores-every-15-minutes`

## Weekly dress rehearsal

Use test player accounts before Week 1 to verify:

1. A player can submit one pick and then add a second.
2. A player can change or remove an unstarted-game pick.
3. A player cannot change a pick after that game's kickoff.
4. Other players see a lock indicator before kickoff and the pick after kickoff.
5. The Commissioner page can run **Check final scores now**.
6. The most recent score-check status is visible to the Commissioner.
7. A favorite cover, underdog cover, and ATS push produce the expected result. A push must be a loss.

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
- Postponed and cancelled-game replacement policy is not implemented yet; resolve those cases manually until that dedicated workflow is added.
