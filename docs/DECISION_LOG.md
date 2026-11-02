# Durable decision log

This log records project rules that future changes must not casually reverse.
Entries preserve the original reasoning; a later change marks an older detail
as superseded and records the current contract rather than rewriting history.

## Where older decisions are

This file holds the most recent entries, newest first (2026-10-05 onward).
Older entries are archived unchanged, with the same standing, and are found
with a text search (for example `grep -rn "Survivor" docs/decisions`):

| Archive | Entries |
| --- | --- |
| [2026-10-early.md](decisions/2026-10-early.md) | 2026-10-01 to about 2026-10-06, plus the undated polish entries appended after them |
| [2026-Q3.md](decisions/2026-Q3.md) | 2026-08-09 to 2026-09-29 (including REF-001 to REF-034) |

Add new entries at the top of this file. When it passes about 150 KB, move
everything older than the current month into a new file under `docs/decisions/`
and add a row above.

## 2026-11-01 - The Season Snapshot axis runs from the lowest score to one or two wins over the leader

Supersedes the round spacings of the next entry. The owner wants the bottom line on the lowest score shown, the top line one or two wins over the leader (never on it), and never more than six lines. With round spacings (2, 4, 5 ...) those cannot all hold, so the spacing is now any whole number of wins that splits the axis evenly: of the two possible tops, the one that divides into more lines, at most six. Lowest 8 and leader 25 now draw 8, 14, 20, 26 instead of 4 to 28; a whole season from 0 with a leader at 25 draws 0, 9, 18, 27. In 6 Wk the spacing can change as the window scrolls (the numbers glide and fade as before). The rail now ends where the grid lines end instead of 14 px past them, and the 6 px above it is used: no top padding in the chart body or the rail, plot top 12 to 10 px.

## 2026-11-01 - The top of the Season Snapshot axis is always a numbered tick; the rail sits above it

Supersedes the next entry's unlabelled top. The owner wants a top number and line at all times. The top is now the first tick at least half a win over the highest line; to keep it close (weeks 1 to 6 with a leader at 9 end at 10, not 12), the tick spacing is the smallest round one (1, 2, 4, 5, 10, 20 or 50 wins) that needs no more than six gaps, so the axis can show up to seven numbers. In 6 Wk the spacing is checked for every half-week position of the window, so it still never changes while scrolling. The 6 Wk rail sits in a 12 px strip above the top line (All keeps the strip empty, so both views line up), and the "Wins" label moved 2 px right.

## 2026-11-01 - The Season Snapshot axis ends a win over the leader; the 6 Wk rail moves to the top

The owner saw weeks 1 to 6 topped at 12 when nobody had more than 9: the axis rounded its top up to the next tick (4-win spacing). The top is now exactly a win over the highest line in view, in both All and 6 Wk; the ticks stay on the fixed spacing and the top is labelled only when it lands on one. The bottom still starts on a tick. The 6 Wk position rail moved from under the "Week" label to the top of the plot, over that win of room, so it never covers a line and takes no space: both views put the axis and the week numbers in the same place. The gap between the heading rule and the chart is also smaller (top padding .5rem to .25rem, plot top 10 to 8 px).

## 2026-11-01 - A touch is a pull only if it starts mostly down

On the Season Snapshot a diagonal drag slid the chart and pulled the page down to refresh at the same time. The pull now decides in the first 6 px of a touch: mostly down is a pull and holds the finger to the page (the touch is cancelled, so a chart under it cannot also slide); sideways, diagonal or up belongs to the page or the chart and never pulls. A pull that began mostly down may still drift sideways and back up as before.

## 2026-11-01 - The 6 Wk axis is always for a full six-week stretch

The 6 Wk axis (2026-10-30) fitted whatever part of the timeline was on screen. At either end of the chart, and especially while pulling past it (the bounce on a phone), that part is fewer than six weeks, so the numbers rescaled to a short piece of the season. The owner does not want the axis to change there. The axis is now for the six-week stretch nearest the scroll position: `snapshotStretch` clamps the stretch to a full window inside the season, so the first and latest ends, and the bounce past them, give the axis of the first or latest six weeks. Between the ends it still follows the scroll to a twentieth of a week, on the spring and one tick spacing as before. All is unchanged.

## 2026-11-01 - A wrong final is corrected by hand, not from a Commissioner screen

`correct_final_game_score_atomically` (regrades every pick and Survivor entry from a corrected score, with an audit row) exists and is tested, but no route or screen calls it. The runbook used to say "use the audited score-correction control". The owner chose not to build one (a wrong final needs the provider or the NFL to get a score wrong): the runbook and project reference now say the correction is run against the database function by the developer. The Fix something drawer's label still says "verified score corrections"; it is left as is to keep the Today screenshots unchanged.

## 2026-11-01 - An NFL final the provider can no longer supply is entered by the Commissioner, verified and audited

The 2026-10-31 audit (REL-7, owner decision D5; the owner declined an ESPN fallback). The NFL score provider reaches back three days; a game still not final after that could never be graded, and the rule was only "never type an estimated score". Now `record_verified_final` (Commissioner → Fix something → Game Exceptions → "Enter a verified final · last resort") finalizes such a game from two typed scores and a required note of where they were checked. It refuses a game less than three days past kickoff, a game that already has a final (a wrong final goes through the audited correction function) and a postponed, cancelled or no-contest game. It grades through `finalize_games_atomically`, so ATS, Survivor and playoff rules are the same as the automatic path, clears the game's retry state, and writes a `final_score_entered_manually` audit row (scores, note, kickoff, picks graded) in the same transaction. The block shows only when such a game exists. The Bowl Pool is unchanged (ESPN only). Runbook: "Provider down or account lapsed for more than three days".

## 2026-10-31 - The rehearsal page is the Commissioner's

`/preview` (the sample-picks rehearsal) used to open for anyone who knew the address. It now draws only after `/api/profile` answers `isCommissioner`; a signed-in player sees "Commissioner only" with a link back to the Standings, and a signed-out visitor is still sent to sign in by the header. The page holds only fictional sample data, so this is a gate on the page, not on data; the Commissioner Workshop stays reached only from the Commissioner screen. The two layout guards that opened `/preview` unsigned against the real app (`test/e2e/visual-layout.spec.ts`) moved into the rehearsal walk-through spec in the screenshot suite, which signs in with a mocked Commissioner; the new screen is the `preview-player` Account state.

## 2026-10-31 - The decision log is split, dated reports move to history, and leftovers are deleted

- **Decision log:** `docs/DECISION_LOG.md` keeps the newest entries (2026-10-05 onward); older ones moved unchanged to `docs/decisions/2026-Q3.md` and `docs/decisions/2026-10-early.md` and keep their standing. All 291 entries are preserved; a table at the top of the log names the archives.
- **History:** the October 7 architecture map, the codebase improvement plan and the grading read note moved to `docs/history/` (their links were updated); the project reference and the code win where they disagree.
- **Docs fixed:** the heartbeat window in the SOP index is 35 minutes (as the code and uptime note say); the README no longer says every pull request gets a Vercel preview (only `main` and `preview/...` branches are built); the operations guide has a secrets and keys inventory (no values).
- **Deleted:** the empty `test/site-nav-auth.test.mjs`, the unused starter images in `public/`, and the one-off scripts `check-email-artwork.mjs` and `merge-duplicate-rules.mjs`.
- **One ladder:** the score retry ladder (10 x6, 20 x3, 60, 120, 240 minutes) lives in `src/lib/score-retry-ladder.js`; the score worker and the credit charts both read it. The unused playoff flag on the polling helpers is gone (both seasons use one ladder).
- **Readiness route:** the Bowl readiness page reads the season's games and entries once and uses their ids for the other reads (it used to repeat the same query four times), and a failed read now answers 500 instead of being assessed as empty ("no lines" would have read as every game missing a spread).

## 2026-10-31 - The Bowl launch rule is written once, and the header works out the date in the browser

- **One rule:** "December 7, 3:00 AM Eastern" lives only in `bowlPoolLaunchAt` (`src/lib/bowl-pool.js`). The schedule sync no longer writes its own `YYYY-12-07T08:00:00.000Z` into `bowl_pool_seasons.player_visible_at`; it calls the helper. (The SQL migrations that seed or dispatch a season still carry the same 08:00 UTC; they are history and the database function, not a second copy the app reads.)
- **Header tab:** the inline script in `<head>` used to hold the launch time as a number worked out when the page was built, so from August 1 2027 it would have shown "NCAA Bowls" all year until the account answered and the tab then moved. It now carries the rule (month, day, UTC time from the helper) and works out the season year in the browser the way `seasonYearAt` does (Eastern time, new season on August 1). A test runs the built script at instants across several seasons and requires it to agree with `bowlSeasonOpen`.

## 2026-10-31 - Bowl scores are never taken from the odds feed, unchecked reads fail loud, and the weekly prune keeps its own clock

- **ESPN only:** the Bowl Pool score worker no longer falls back to The Odds API's scores. A game is settled from ESPN's final alone (the rule from the cancellation work); the odds feed only supplies lines. A final with a missing score is skipped, never settled.
- **Reads that were unchecked now fail loud:** the Bowl Pool page (`GET /api/bowl-pool`) answers 503 "could not be loaded right now" when the entries, picks, results, lines, teams or players read fails, instead of showing standings with no picks or every name as "Player". The Slate's active-week games read logs its failure. The championship game save throws instead of being ignored.
- **Weekly prune:** counted from the last prune the watchdog recorded (7 days), not from a weekday, so a missed run is made up on the next.
- **Keep-alive:** the isolated test database gets its own weekly `select 1` workflow, and the scheduled-workflow keep-alive re-enables it.
- **Deferred on purpose:** the `engines` field in package.json moves to Node 24.x after the Dec 7 Bowl launch, not before.

## 2026-10-31 - CI decides what a pull request needs, and Dependabot patch updates can merge themselves

The 2026-10-31 audit (EFF-2, CLEAN-7, owner decision D6). The "changes" job of Application quality downloaded the repository's full history (over a gigabyte, mostly screenshot baselines) on every pull request just to list the changed files; it now asks GitHub's pull request API, and runs the screenshot suite if the list cannot be read. The required `database-lifecycle` check (about five minutes in a queue with one shared database) now has the same kind of gate: it runs when `supabase/`, `src/`, `scripts/`, the integration, browser and helper tests, or the package and workflow configuration changed. The audit proposed `src/lib` and `src/app/api` only; `src/` as a whole is used because the isolated run also drives the real login and Slate pages in a browser (player-flow), which a component change can break. A skipped job counts as passing for a required check, and a failed file check never skips the run (only an explicit "false" does).

Not done, on measurement: building once for the four screenshot shards and splitting `build` out of `verify`. The build is 34 seconds of a 3-4 minute check, each shard builds in parallel on its own free runner, and sharing the output would add an upload and four downloads of a similar size, so the wall time would not improve.

Decision D6: a Dependabot pull request in which every dependency is a patch version of an npm package is set to auto-merge by `dependabot-auto-merge.yml`, which only asks GitHub to merge once the required checks pass. Minor and major versions, and GitHub Actions (which run with the repository's secrets), still wait for the owner. It needs the repository's "Allow auto-merge" setting; until then it only says so.

## 2026-10-31 - A watchdog incident reaches the Commissioner by email and on their phone, and low provider credits have their own alert

The 2026-10-31 audit (REL-6, owner decision D3) found the watchdog had one channel: if the Brevo key or account lapsed, the alert saying so was itself sent through Brevo. `notifyCommissioners` (now `src/lib/watchdog-notify.ts`) sends each new incident by email and, through the existing Web Push sender, to every device the Commissioner turned notifications on for; the notification opens the Commissioner Desk and a later alert for the same incident replaces it. The channels run independently and the alert counts as delivered when either gets through; a failure of either is saved as an operational warning (Recent warnings) and sent to Sentry, and only both failing makes the watchdog retry. A Commissioner with no phone set up is not a failure.

The audit also found that below 50 Odds API credits the score worker stops spending them, which silenced the stalled-scores alert and reported nothing, so a plan change or miscount would pause NFL grading until the 1st unnoticed. A new critical alert `odds-credits-below-reserve` says so. It uses the balance the last score run reported and counts only when that report is from the current UTC month (credits renew on the 1st) and the season is not complete, so a stale low balance from last January cannot alarm in July. The 50 is now one constant (`PROVIDER_CREDIT_RESERVE`) shared by the worker, the health page and the alert. The panel's line about alerts now says email and phone.

## 2026-10-31 - Worker warnings are saved, reported once, and shown on the Automation tab

The 2026-10-31 audit (REL-5) found that the lines the runbook tells the owner to look for (`Bowl Pool games ESPN no longer lists`, `A Bowl Pool game could not be updated`, a failed pool-integrity check and the like) were written only to the Vercel log, which Hobby keeps for a short time, and Sentry captured no console output. The workers now call `noteOperationalWarning(job, message, details)` (`src/lib/operational-warnings.ts`) instead of `console.error`/`console.warn`. It still writes the log line, saves the warning to the new `operational_warnings` table through `record_operational_warning` (one row per job and wording, counting repeats and keeping the latest details; rows quiet for 30 days are dropped by the same call), and sends a Sentry `warning` the first time it appears and again only if it returns after 12 quiet hours. The same warning is saved at most once every 10 minutes per server instance, so a loop that hits it for every game does not write a row per game. It never throws, and if the save fails the warning still goes to Sentry. Commissioner -> Automation shows the last week's warnings (newest first, up to eight) under the incidents, with a plain "No warnings this week" when there are none; a warning is not an incident and sends no email.

The audit proposed saving warnings in `sync_runs.details.warnings`. The Bowl worker writes no `sync_runs` row (its heartbeat is the only run record), so a separate table is the one place every job can write to. Health routes, request routes and the season-phase fallbacks keep their log lines: they run on every page view or probe, and a database write there would multiply the load exactly when the database is struggling. The static email artwork fallbacks stay log-only too: the image route covers them and players see nothing.

## 2026-10-31 - ESPN's cancelled status cancels a Bowl game, after two runs in a row

The owner decided (audit decision D4) that an ESPN-cancelled bowl should not wait for the Commissioner. `syncScores` now counts only `STATUS_FINAL` as a result, so a cancelled game's 0-0 is never graded. `STATUS_CANCELED` cancels the game on the second consecutive Bowl worker run that sees it (the first sighting is saved in `espn_cancelled_seen_at`; a run where ESPN no longer says it clears the mark; an unreadable ESPN neither confirms nor clears), through `record_bowl_game_cancelled_by_espn`, which is the Commissioner's cancellation plus an open schedule-change row carrying the reason, so the Commissioner sees it in the exceptions panel and the readiness count until reviewed. `STATUS_POSTPONED` and anything else stay manual: a wrong automatic postponement would be harder to see than a late one, and the overdue-final alert already names the game. Players see "Final score pending" instead of a blank line or venue once a game is six hours past kickoff with no final (`bowlGameNote`).

## 2026-10-31 - A Bowl worker failure is a failed run, and a game with no final is an alert for both pools

The 2026-10-31 audit found that the Bowl worker recorded `success` when ESPN could not be read (both ESPN reads returned "nothing"), the readiness panel's cron health read the NFL jobs instead of `bowl_scores`, and neither pool alerted on a game that never received a final score. ESPN reads now throw a typed `ProviderUnavailable`; `syncBowlPool` lets the work that needs no ESPN finish (games going live, missing-pick losses, grading, the champion) and then ends the run as failed with the reason. Readiness reads the `bowl_scores` heartbeat. One shared rule (`src/lib/final-overdue.js`): a game still scheduled or live six hours after kickoff is overdue, shown as the Bowl health issue kind `final` and the NFL watchdog incident `final-overdue-nfl`. NFL score checks now stop explicitly 72 hours after kickoff (`FINAL_SCORE_POLLING_LIMIT_HOURS`; they already stopped through the provider look-back), and health no longer counts those older games as pending score checks. Not in this change (PR E2): treating only ESPN's `STATUS_FINAL` as final, the automatic cancel of an ESPN-cancelled bowl, and the players' "Final score pending" state.

## 2026-10-31 - Bowl games follow kickoff order when a time is confirmed or a game is rescheduled

The 2026-10-31 audit found that the Bowl lists (Bowl Card, picks page, standings) read games by `order_index`, but only a newly added game was put in kickoff order. A game whose time ESPN confirmed or moved, and a postponed game the Commissioner rescheduled with `reschedule_bowl_game`, kept their old place and sat out of date order. The ESPN schedule pull now renumbers whenever it inserts a game or changes a kickoff, and `reschedule_bowl_game` renumbers at its end, in both cases only when the season's list was in kickoff order before the change (a minute of slack), so an order the Commissioner arranged by hand is never rearranged. "Not in chronological order" is now a warning on the readiness page (`warnings` from `assessBowlPoolIntegrity`), not a health failure: it no longer turns the deploy check or the watchdog red, because with the lists self-ordering it can only mean a deliberate arrangement. Tests: `test/bowl-schedule-sync.test.mjs`, `test/bowl-pool-integrity.test.mjs`, and the isolated `test/integration/bowl-pool-season-rehearsal.test.mjs`.

## 2026-10-31 - The Commissioner can Reschedule a postponed Bowl game and set a missing line from the desk

Walking the Commissioner's Bowl tools found two gaps. The Reschedule backend (`reschedule_bowl_game`) had no button: the exceptions panel could record a postponement but never undo it. And a game the provider feeds gave no line had no remedy at all: with no `bowl_pool_game_lines` row its picks are never graded (`grade_bowl_pool_final_picks` joins on the line) and the Bowl health check stays red. The panel now has a Reschedule form (new date and time, read as Eastern) on every postponed game, and a "Bowl Pool lines" panel (`/api/admin/bowl-pool/lines`) lists games with no line whose lock is within a day, or that are final, where the Commissioner picks the favorite and types a half-point spread (or a pick'em). A hand-entered line is official at once (locked now, `manual_override`, history row, source "Commissioner"), is only ever inserted (a line a feed supplied, preliminary or locked, is never replaced from here), and can be set after the game is final so its picks can finally be graded. The schedule CSV import stays an API-only backup that closes at player launch: the seeded schedule is the real fallback, and a CSV carries no teams, so it could not rescue a feed outage on its own.

## 2026-10-31 - A postponed or cancelled Bowl game keeps its picks, and Reschedule works

The Bowl season rehearsal (Step 2 of the Bowl Pool readiness plan) found three faults in how a disrupted game is handled, none of which any earlier test touched. (1) The matchup freeze refuses any kickoff change on a game with picks, and Reschedule changes the kickoff of a postponed game, which always has picks, so Reschedule could never succeed. (2) The Bowl page treated a game as locked only after its kickoff, so a postponed or cancelled game with a future kickoff stayed pickable and was sent with every Submit; the route answered the whole Submit with "no longer open", so a player who had picked the game could save nothing more. (3) Skipping that game in Submit would have been worse: `save_bowl_pool_submission` deletes the picks it is not given for games that have not kicked off, which for a postponed game means the player's pick, and for a cancelled game their voided pick. Decisions: a game that is not `scheduled` is locked on the page and skipped by the route; the function deletes an omitted pick only on a game still open; the freeze lets the postponed-to-scheduled step through and nothing else; Reschedule marks the new kickoff confirmed and locks the line at 8 AM Eastern on the new day like every other Bowl game (it locked at kickoff before); and rescheduling cancels the game's queued reminders and releases their keys, as the schedule pull already did (the cancelled reminders kept their keys, so a rescheduled game never got a new countdown). Proven in `bowl-season-calendar.test.mjs` (the reminder schedule from December 1 to January 27 on the real calendar), `bowl-exceptions-reschedule.test.mjs`, `bowl-pool-entry-rules.test.mjs`, and `test/integration/bowl-pool-season-rehearsal.test.mjs` (the database side, in the isolated workflow).

## 2026-10-31 - Bowl health stays green on launch day while the later playoff rounds wait for teams

The 2026-10-31 audit found that from the player-visible launch (Dec 7, 3 AM Eastern) every team-less Bowl game counted as a health problem, but the playoff quarterfinals, semifinals and title game cannot have both teams until earlier rounds finish (Dec 19 to Jan 15). That would have turned `/api/health/bowl-pool` red, the UptimeRobot Bowl monitor red and every production smoke gate failing for about six weeks, and the watchdog's one Bowl incident (a single key) would have hidden any later, real problem. Now an ordinary bowl without both teams is a problem at once, while a College Football Playoff game after the first round needs its teams only within 36 hours of kickoff (`bowlGameNeedsTeams`, `BOWL_TEAMS_DUE_HOURS`). The integrity check also returns each problem with a kind, and the watchdog raises one incident per kind (teams, line, order, settlement, structure); alert text names the bowl and date instead of a game id. `test/bowl-health-launch.test.mjs` runs the health check at launch day, a week out and 12 hours before a Rose Bowl-style game. Also in this change: the racy "starts the Bowl Card's read" screenshot test now waits for the read it asserts on (it failed once on main though it passed on the PR).

## 2026-10-31 - A Bowl line becomes official only at 8 AM Eastern on game day, even with no odds match

The 2026-10-31 audit found that the provider sync's "no odds match" branch (always taken while the Odds API is off) made every preliminary ESPN line official the moment it was saved, with no game-day check, and wrote a line-history row for every game on every run. That broke the written rule (preliminary until 8 AM on game day) and would have frozen Bowl lines at ESPN's opening number weeks early. The owner confirmed the rule (D2). Now the no-match branch locks a line only when its lock time has come (`lineIsDueToLock`); `lockProvisional` skips an already-official line and writes the history row only when its guarded update really changed a row, so a repeat run adds nothing. The old source-text test is replaced by `test/bowl-line-lock-sync.test.mjs`, which runs the stage (Dec 8 and 12:59 stay preliminary; 13:05 locks once with one history row; a repeat run and a lost race change nothing).

## 2026-10-31 - The weekly backup holds the data and the sign-in accounts, and proves it

The 2026-10-31 audit found that the weekly "encrypted database backup" ran `supabase db dump` with no flags, which dumps the schema only (Supabase's CLI reference: the default dump contains no data or custom roles, and leaves out `auth`), and that its restore check only counted tables, so the monitor was green while there was nothing to restore. The owner decided (D1) to include players' sign-in accounts, so a restore keeps every PIN working. The export is now four parts in one encrypted tar (roles, schema, data, auth accounts without sessions and tokens), and the restore check compares row counts per table with the restored copy and requires rows in the key tables (`scripts/backup-verify.mjs`). Retention stays 90 days: the owner also asked for one copy a month kept a year, but GitHub caps artifacts at 90 days on a public repository; a longer keep needs storage outside GitHub (a separate owner decision). A Restore runbook is in OPERATIONS.md.

## 2026-10-31 - The two Bowl Pool announcements can be previewed and test-sent from the Email center, but not edited

The owner asked to see the December 7 opening announcement and the December 14 last call before players do. Both are in the Email center's email image studio as read-only entries (`readOnly` in `src/lib/reminder-templates.ts`): the preview is built from the current Bowl Pool season's real first game and National Championship date (`bowlInvitationMessage`, `src/lib/bowl-invitation-message.ts`), with the same words the sweep queues, and "Send this to my email and phone" sends a `test` row of that kind to the Commissioner alone (no automation key, so it never uses up the once-only real message). Their wording is not saved or reset there: the words were approved in code and fill in from the schedule, so a saved override would go stale; the template save and reset routes refuse them. With no scheduled game yet the preview says so instead of guessing.

## 2026-10-31 - A last call goes to players who have not joined the Bowl Pool, 24 hours before the first kickoff

The owner asked for one more reminder, 24 hours before the first kickoff, to players who have not opted in (email and phone). It is its own reminder kind (`bowl_pool_last_call`, migration `20261031040000`), queued by the reminder sweep like the opening announcement, and it asks only players with no Bowl entry of any kind, decided when it is sent so a player who joins after it is queued is not nagged. A player who joined and then opted out is left alone: leaving was their choice. Entry closes at the first kickoff, so that is the clock: if the first game's kickoff moves, the queued last call is cancelled and its key released (`cancelQueuedBowlReminders`) so the sweep builds a new one for the new time. With no confirmed time on the first game there is nothing to count back from, so there is no last call (the Commissioner would see the missing game time in readiness first).

## 2026-10-31 - The Bowl Pool opens with one email and one phone notification, queued the morning they are due

The owner approved (2026-10-31) telling everyone the Bowl Pool is open: one email and one phone notification on Monday, December 7 at 9 AM Eastern (six hours after players first see the pool, so nobody is woken), to everyone with pool emails on, never to be sent twice, and not counting Bowl picks in the app-icon badge. The words are queued the morning they are due, not months ahead, so the first game, the title game's date and the season's years are the schedule's own at that moment; they are saved on the reminder so a retry is identical. The phone follows the email, as every notification does, so a player who has pool emails off hears nothing. The email is skipped (dropped, not retried) if the first game has started, since seats are closed. The phone title is "The Bowl Pool is open"; the email's subject adds ": claim your seat". New reminder kind `bowl_pool_open` (migration `20261031030000`).

## 2026-10-31 - The Bowl schedule pull matches by name, trusts only confirmed times and never makes a TBD team

Before the December 1 pull was ever run, it was checked against ESPN's real postseason list and the 42 games seeded in September, and would have gone wrong in several ways: it paired games by nearest kickoff, so a moved bowl or one ESPN added late took another bowl's teams (the Poinsettia Bowl onto "Frisco", the Sun Bowl onto "Las Vegas"); it read the bowl's name from the event's matchup text, so a new game would be called "Away at Home"; it would have imported the FCS playoff and the Celebration Bowl; it turned ESPN's "TBD" teams into real team rows a player could pick (which then froze the game); it took ESPN's midnight placeholder as a kickoff (reminders at 9 PM the night before, picks locking at midnight); it flagged College Football Playoff games as ordinary bowls once teams were set; and a cancelled reminder kept its unique key, so a rescheduled game never got a new one. Decisions: pair by bowl name (the end of ESPN's name is ours, sponsors ignored), time only to tell identical headlines apart; leave out FCS games and the Celebration Bowl (owner's choice, 2026-10-31); a kickoff is taken only when ESPN confirms it, otherwise the row stays "Time TBD" with no reminder, and the database allows such a placeholder to be corrected even after picks exist (a confirmed kickoff stays frozen); a game gets both teams or neither; a cancelled reminder gives up its key. Migration `20261031010000` adds the five FBS bowls ESPN lists that the September calendar lacked (San Juan, Poinsettia, Holiday, Sun, Arizona), renumbers by kickoff, and relaxes the freeze. Proven against saved copies of ESPN's real lists (`test/fixtures/espn-bowl-schedule-*.json`) in `bowl-pool-espn-schedule.test.mjs` and `bowl-schedule-sync.test.mjs`, and against the real database in `test/integration/bowl-schedule-times.test.mjs`.

## 2026-10-31 - Haptics are always on: the Vibration switch is gone

The owner tried every tap on an iPhone, liked them all, and decided players should not be able to turn them off. The Vibration switch on the Notifications page is removed, along with everything behind it. Phones that had turned it off before (`pickem-vibration` = "off" in `localStorage`) are deliberately ignored, so they tick and buzz like everyone else; tests cover that case. This supersedes the switch in the 2026-10-30 rollout entry. Devices without haptics still get nothing, and every button works the same either way.

## 2026-10-30 - The 6 Wk Season Snapshot axis follows the weeks in view

Late in the season, a 6 Wk axis that counted from zero left the bottom half of the chart empty and squeezed every line into the top. The 6 Wk axis now fits the weeks in view: a win or more under the lowest line and over the highest, counting where a line crosses the edge of the view, so the range moves continuously with the scroll. It glides on a critically damped spring (about a third of a second, no overshoot; a range that changes again mid-glide carries the motion on), and the lines move with it. One tick spacing (1, 2, 4, 5, 10 or 20 wins, chosen so the widest window has about five ticks) holds for the whole view, so the numbers slide past like a ruler instead of all changing at once; numbers that join fade in and numbers that leave fade out. Lines and grid are clipped above the week numbers so nothing crosses them mid-glide. All keeps counting from zero as the honest overview, and the playoff chart keeps its own rule. Reduced-motion settings jump straight to the new range. Measured in a recorded drag: about 60 frames a second, the lines moving at most about 2 px per frame.

## 2026-10-30 - The 6 Wk Season Snapshot draws its own position rail

The 6 Wk range scrolls sideways, and the browser's scroll bar sat on top of the week numbers (a classic bar takes 10 px from the plot's box; a floating one paints over its bottom edge) and looked nothing like the pad. The native bar is hidden in that view and the page draws a slim rail beneath the "Week" label instead, in the pad's own theme tokens: a mouse drags its thumb or presses its track; a finger or trackpad scrolls the chart itself and the thumb follows; the chart stays a focusable group, so the arrow keys scroll it too. The week numbers now always sit fully inside the plot. The screenshot state launches the browser with scroll bars drawn (headless Chromium hides them everywhere else) so a returning native bar would show.

## 2026-10-30 - Uptime monitors for the pool's outcomes, not only its jobs

The existing monitors prove that the site is up and the jobs run. Three new public probes prove the outcomes the pool depends on: `/api/health/lines` (every game past its lock time has an official line; a game locking within three hours with no line ever captured would lock as a pick'em), `/api/health/recap` (the Tuesday recap for the latest settled week was sent or deliberately cancelled within three hours of its due time), and `/api/health/week-handoff` (a settled and graded week handed over within two hours of its scheduled time). Each reports only after the work was due plus a grace, stays healthy when there is nothing to check (off-season, a week still being played, a postponed game, which is a documented hold), answers only 200 or 503, caches only a healthy answer at the CDN and writes the reason to the server log. A keyword monitor on the home page (text "Lead Pipe Locks", alert when missing) catches a page that answers 200 but is broken. They are not part of the deployment smoke gate: a pool-level alarm must not block a deploy. The slow monitors (automation 15 minutes; settlement, Bowl Pool and the three new ones 30; backup 60) were lengthened in the same change to save Vercel CPU.

## 2026-10-30 - Session tokens are verified locally

Every signed-in API call asked Supabase Auth to confirm the session (`auth.getUser`), a network round trip on top of the player lookup. The project signs sessions with an asymmetric key (ES256, public key set at `/auth/v1/.well-known/jwks.json`), so `authenticateActivePlayer` now verifies the token locally with `auth.getClaims` (signature and expiry) on one client per server instance, which keeps the key set for ten minutes. A token signed with a symmetric or unknown key still goes to Supabase Auth. Accepted trade-off, owner-approved as part of the efficiency plan: a session that was signed out stays usable until its token expires (at most an hour). Deactivating a player still takes effect at once, because `players.active` is read on every request. Tests sign real ES256 tokens: valid, expired, forged, not a token, an unknown key, and a deactivated player.

## 2026-10-30 - Efficiency audit: what was looked at and deliberately left alone

The 2026-10-30 efficiency audit (Vercel and Supabase numbers, plus local measurements) also reviewed these and changed nothing, so they are not reopened without new evidence:
- Sentry. On the server it adds about 15 ms to a cold start and nothing measurable to a warm request. In the browser, `bundleSizeOptimizations.excludeTracing` (with the browser `tracesSampleRate` removed) left every page's first-load JavaScript the same size (358, 349 and 327 KB gzip for the Standings, the Slate and sign-in), because this Turbopack build does not apply that option. Error reports, replays on error and the 5% trace sample stay as they are.
- The Trophy Room's turntable frames load progressively (a phone gets the 4.4 MB small set) and the browser keeps them for a day.
- The 46 KB gzip global stylesheet: splitting it per page is a large refactor for little gain once it is cached.
- Database indexes: the pool's tables are tiny (hundreds to a few thousand rows), so sequential scans are the fastest plan.
- Fonts: not touched (owner rule). Not preloading the Bowl Pool lettering on pages that do not use it is a possible later change, for the owner to decide.
- A function wakes in about 200 ms of CPU and then answers in about 4 ms, and supabase-js costs about 1 ms of CPU per query, so the number of calls (background schedules, health checks, the badge) is what was cut, not code speed.

## 2026-10-30 - The Standings and the Slate ask for their data before their code arrives

Vercel Speed Insights scored the Slate 85 on desktop. A lab run on an emulated slow phone showed the layout does not jump (0.003) and taps answer in 56 ms; the wait is loading, and the page only asked for its data once all of its code had downloaded and started. An inline `<head>` script (`src/lib/early-read.js`) now starts the Standings' (`/api/home`) or the Slate's (`/api/board?bootstrap=1`, with the same `week`) first read straight away (on the Standings also the Bowl Card's read when this device showed the card last time, the bowl-prefetch rule), using the session the Supabase client keeps in localStorage and the installed-app header, and `fetchWithSession` takes that answer when the page asks for the same URL: still one request. It is skipped when signed out or within a minute of the session expiring, and anything unusual (another URL, a non-OK answer, older than 15 seconds) falls back to the page's own request, which can refresh the session. A page that gives up on a hung early answer (the Slate's 15-second limit) gets the same AbortError its own request would and retries by itself. The loading football's picture is no longer preloaded from `<head>` (it competed with the page's code on a slow connection); it is fetched once the page has started, so it is ready for the next loading screen. Measured: data requested 0.4 s sooner on a returning visit, first game row drawn about 0.2 to 0.3 s sooner. Fonts were left alone (owner rule); not preloading the Bowl Pool lettering on pages that do not use it is a possible follow-up for the owner to decide.

## 2026-10-30 - Standings and Slate reads wait on the database fewer times

`/api/home` waited on the database 7 times in a row (12 in a playoff round) and `/api/board?bootstrap=1` 8 times (11), because each read waited for the one before it even when it needed nothing from it. Independent reads now run together: the Standings in 4 rounds (6), the Slate in 5 (7). The requests are the same and the responses identical (checked across every fixture scenario); failures are still judged in the order the pages have always reported them, and reads a page might not reach are guarded so an early answer never leaves a failure unhandled. The fake database counts rounds and the route budgets hold them exactly. This matters most while the functions and the database sit far apart, and still saves a round trip per round after they share a region.

## 2026-10-30 - The app badge re-reads at most every five minutes

Coming back to the Home Screen app re-read the picks-to-make number at most once a minute, and each read costs about seven database requests (the sign-in check, the player, the active week, its games, picks, season and Survivor rows). The number only changes when picks are saved (that refreshes it at once, unchanged) or a game kicks off, so a return now re-reads it at most every five minutes.

## 2026-10-30 - Uptime probes reach a function less often

The probes were 36% of Vercel CPU on 2026-10-30: the three worker probes ran about 100 times each in 12 hours despite a 10-minute CDN window, because the CDN keeps a copy per region and the monitors check from several places. Each worker probe now keeps a healthy answer for its own grace window: line locks 10 minutes (12-minute grace, unchanged), reminders 15 (20-minute grace), scores 25 (45-minute grace). The slow monitors are checked less often in UptimeRobot (automation 15 minutes, settlement and Bowl Pool 30, backup 60); that setting lives in UptimeRobot, not in code. A failing answer is still never cached, and the core `/api/health` probe still runs live every time.

## 2026-10-30 - Background jobs call Vercel only when there is work

Vercel's own numbers showed that most of the pool's Fluid CPU went on idle background calls: the score worker every ten minutes around the clock (about 180 ms each, almost always with nothing to do), the email-schedule reconciliation every fifteen minutes and the watchdog every ten. A call costs about 200 ms of CPU however little it does, so the number of calls is what matters. Supersedes the earlier rule that "score sync is deliberately not gated": the worker's other duties (season rollover, week handoff, Survivor no-pick eliminations, playoff day-start snapshots) fall due either on events the gate can see (a final 170 minutes after kickoff, a week waiting to open, picks that can be settled now) or at times the worker now records after each run (`automation_dispatch_state.next_due_at`: handoff time, the week's final kickoff, the start of each Eastern playoff day, the next week's start). A safety run still comes at least once an hour, and the off-season gate is unchanged. The reconciliation runs at :05 and :35, still five minutes after the 7:00 AM Eastern spread refresh and the Tuesday 6:30 AM recap eligibility. The watchdog runs every fifteen minutes; its 35-minute heartbeat window absorbs one missed run, and its Monday storage-cleanup window widened to fifteen minutes so exactly one run lands in it. Expected saving about 27 minutes of Fluid CPU a month; players see no change.

## 2026-10-30 - The scheduler's run log is pruned weekly

pg_cron records every run in `cron.job_run_details` and never removes them; with the every-minute line-lock gate that is about 2,200 rows a day, and by 2026-10-30 the log was 113 MB of the database's 160 MB (Free plan limit 500 MB, reached around mid-2027 at that pace). The weekly `prune_operational_storage` now also deletes run-log rows older than 7 days (it reports them as `cron_run_log`), and the migration clears the backlog once. The cron schema is reached through dynamic SQL only where it exists, and a missing privilege is a warning, so neither the weekly cleanup nor the annual turnover that calls it can fail because of the log.

## 2026-10-30 - Functions run next to the database

An efficiency audit read Vercel and Supabase directly. Supabase is in West US (Oregon), but the functions ran in Vercel's default region, Washington DC (`iad1`), so every database call crossed the country, and a player request makes 8 to 16 of them, partly in sequence. `vercel.json` now pins the functions to Portland (`pdx1`). Before numbers, for the later comparison: Fluid Active CPU 2 h 17 m for Sep 30 to Oct 30 (64K invocations); last 12 h 888 invocations and 90.5 s of CPU (crons 51%, health probes 36%, players and admin 13%); `/api/health` answered in 0.37 to 0.53 s from Portland against 0.06 s for a static page; database 159.78 MB of 500 MB, 113 MB of it the pg_cron run log; Speed Insights `/board` desktop score 85. The rest of the audit's changes follow in their own pull requests.

## 2026-10-30 - The Workshop gains the pull-to-refresh strip, the trophy banners and more to adjust

Second step of the endless Workshop board. Added the real pull-to-refresh scene (chain, pole, dust, Dial-A-Down; a slider pulls it by hand and a tap plays a whole pull) and the three trophy banners (Pick'em, Bowl Pool, Survivor: title, name, years, and three colour knobs that turn the cloth's hue, lightness and strength). The easing of the pick highlight, megaphone and crest rules became settings (a variable with today's curve as its default, so players see no change), and every piece can be shown larger or smaller in its tile (the Workshop's own view, not a setting to copy). Menu > Play everything plays every piece at once. Not added: the trophy turntable (120 pictures to fetch, too heavy to repeat across an endless board), the app badge and Home Screen banner (they live on the phone itself, not on anything the page draws), and chat typing dots (no such piece exists). Also fixed: the crest's gold rules were scoped to the old card wrapper and so stopped drawing in the new board.

## 2026-10-30 - The Workshop is one endless board with its settings hidden

Owner wanted the Workshop to stop being a fixed grid of cards: every piece mashed together on an "infinity grid", more to adjust, and the controls out of sight until wanted. It now opens full screen at `/admin/workshop` (the desk's Workshop tab is a link; Desk goes back). One patch of tiles of different sizes repeats in every direction, every other row shifted half a patch so the repeat is harder to spot; drag, scroll, pinch or the edge buttons move and zoom it, and only the copies on screen are drawn, so pieces scrolled past stop running. A tap plays that one copy; each piece's settings open from its small tune button in a panel (right side on a computer, bottom sheet on a phone) and are shared by every copy. The board follows day and night like the rest of the site. Settings are remembered on that device only; a setting becomes what players see only when the Commissioner copies it and sends it over (no Publish button, so nothing tried here can change the live site). The Bowl Card's two split-flap styles are separate cards with their own pace. New pieces and more settings follow in a second change.

## 2026-10-30 - Haptics roll out to every tappable place, behind a Vibration switch

The owner felt Tick, Light tick and Lock-in on an iPhone (identical, since an iPhone has one tick), so the rollout went ahead. Every tap that picks, saves or turns something gives its feel (the places are listed in the project reference). Rules kept: an iPhone ticks only from the finger's own tap, so the tap layer must stay mounted through the tap (a layer that unmounted or a button that was re-keyed by the same click gave no tick: found when the Slate's team button was re-keyed on every pick, so the animation key moved to the button's content), and a disabled button's layer lets taps through. Players can turn it all off with a Vibration switch on the Notifications page (kept per device; the Feel test ignores it). Left out on purpose: scrolling, loads, animations, arriving notifications and the Commissioner desk.

## 2026-10-30 - The Players page shows who has the app, notifications and when they were last here

Owner wanted, for each player: emails, the app, notifications, last login, visits over the last week, and phone or computer and browser, with a tidier page. The page is now one card per player with a figures strip on top. New data is deliberately coarse and cheap: the visits are one row per player per Eastern day (a count of days out of seven, not every page view), the device is a fixed label made from the User-Agent (the raw text is not stored), and "has the app" is known only once the installed app has made a request (it marks them with `X-Pickem-App`), so it reads "not yet" until then. An iPhone cannot tell the website about its Home Screen app from a Safari tab, so the page says what was last seen, not what is installed.

## 2026-10-30 - iPhone haptics: the finger must flip the switch

The owner's iPhone (iPhone 16, iOS 26.6.1, Home Screen app, System Haptics on) felt nothing in the Feel test. Cause: in iOS 26.5 Apple stopped the switch tick when a page flips the switch from code (WebKit only ticks for a real finger's click; the open-source ios-haptics library documents the same break). Updating iOS does not help. What still works is an invisible label with a hidden switch laid over the button, so the finger's own tap flips it (`src/components/haptic-tap.tsx`, the approach ios-haptics 3.2 adopted). That allows exactly one tick per tap and none after a wait or mid-drag, so on an iPhone the choices tick and success, warning, ratchet and the pull's lock-in stay silent; the Feel test's timing experiments were removed and a plain switch added to compare. Android is unchanged. If even this stops working in a later iOS, iPhone haptics are dropped and Android keeps them.

## 2026-10-30 - The Add to Home Screen banner closes one way

Owner found the banner had three ways to make it go away (Hide, the ✕ and "I already have it") and that the iPhone step "Not there? Open this page in the Safari app first" confused more than it helped (it showed in Safari itself). Now the ✕ is the only way to close it and keeps it away 14 days, as before; "Show me how" gives way to the steps instead of turning into Hide; "I already have it" (180 days) and the Safari aside are gone. Supersedes the "I already have it" detail of the Home Screen entries below. The notifications banner is unchanged (its ✕ also waits 14 days).

## 2026-10-30 - The trophy table turns only by its arrows

Owner: turning the trophies only with the arrows is cleaner. Dragging, swiping and flicking the table are removed (a finger on the table now simply scrolls the page); the arrows and arrow keys turn it slowly and evenly, one trophy at a time, as before. Also, the rafters said "No Pick'em champion yet" for a moment every time the page opened, because the turntable showed before the champions had loaded: now the rafters stay bare until they arrive, and the note shows only for a trophy nobody has won.

## 2026-10-30 - Haptics start with a Commissioner-only Feel test

Owner wants a thoughtful, satisfying haptic layer but cannot test every phone (only an iPhone). The plan is five feels with one meaning each, used the same everywhere (see PROJECT_REFERENCE). Because iPhone support is a workaround that is unproven inside a Home Screen app, step 1 ships only a Commissioner-only "Feel test" on the Notifications page: a button per feel, a pretend pull-chain (a notch per count, a lock-in on letting go) and, on an iPhone, experiments (a tick one second after a tap, three quick ticks, success as a tick) so the owner can feel what an iPhone actually allows. The Android patterns are untested by the owner (no Android phone): they are conventional short patterns, kept in one table in `src/lib/haptics.js` for tuning. Rolling the feels out to the rest of the app, with a Vibration on/off switch, waits until the owner has felt this.

## 2026-10-30 - On Android one Install tap also turns notifications on

Owner asked for one button where the phone allows it. Android and Chromebook browsers hand the site a one-tap Install; when the player accepts, the site now asks for notifications right away and saves the phone, so the player taps Install and then Allow and is done. iPhone cannot do this (Apple allows neither a website install button nor a notification question outside the Home Screen app), so iPhone keeps the Share steps plus the in-app one-tap banner. If the browser does not show the question straight after installing, nothing is lost: the in-app banner asks on first open.

## 2026-10-30 - Notifications are one tap away inside the app

Owner: adding the app and turning on notifications must be effortless for players who are not comfortable with phones. After adding the app, a player used to have to find the name menu, then Notifications, then the button. Now the Home Screen app shows a one-tap banner in the same place and navy/gold look as the Add to Home Screen banner (which never shows inside the app, so they never meet): Turn on asks the phone straight from the tap and saves the subscription. A phone that says no gets a plain "you can turn them on any time under Notifications" and is not asked again; Not now waits 14 days, like the install banner.

## 2026-10-29 - Night mode official Slate lines are a brighter teal

The official (teal) spread lines, the "Teal lines" note and the selection-chip lines were only 2.9:1 to 4.2:1 against the dark night rows (AA needs 4.5:1). Night mode now sets its own `--official-line-color` (`#26b3a5`, 5.7:1 or better on every night row); the selection chip uses it too instead of the dark day teal. Day mode is unchanged. A browser test checks every official line on the night Slate to 4.5:1, since the screenshot gate's per-pixel tolerance cannot see a colour shift this small.

## 2026-10-29 - The error recorder loads after the page appears

The Sentry screen recording (kept for errors only, all text masked) was part of every page's first download: about 38 KB gzip, 365 KB down to 327 KB on the login page. It now loads from `src/lib/sentry-replay.ts` once the page has finished loading and the browser is idle, so the first download no longer carries it. Trade-off, accepted by the owner: an error in the first moments of a visit is still reported but has no recording. `bundleSizeOptimizations` also drops debug logging and iframe/shadow-DOM recording the site never uses. The recording stays error-only and fully masked; nothing about what is collected changed.

## 2026-10-29 - Phone notifications mirror the emails

The owner asked that phone notifications "very clearly mirror the exact details and timing of the emails". They are not a second schedule: they ride on the email delivery. `deliverEmailReminder` notifies the phones of every player whose email it just sent, with the email's subject and message and the page the email's button opens (shared `reminderDestinationPath`). Consequences, chosen on purpose: the on/off choices are the email choices (a player gets a phone notification only for the emails their plan sends them, so email notifications must be on); an already-sent email never re-notifies on a repeat run; a retried email notifies when it finally goes out; a phone failure is only logged. Reminder categories added to email later notify with no extra work. Still Commissioner-only until the owner has seen it on a phone; the icon badge count and opening it to every player come next.

## 2026-10-29 - The app icon number is picks still to make; phone notifications open to every player

Owner chose the icon number (Pick'em picks left plus Survivor, this week) and, having tested notifications on their own phone ("it works"), opened the Notifications-on-this-phone section to every player: a player must first have the app on the Home Screen (the install helper and the iPhone-tab message already say so). One rule, `picksStillToMake`, serves both the push (`picksStillToMakeFor`, one batch of reads per reminder, each phone gets its own player's number) and `/api/badge` (the app reads it on open, on return at most once a minute, and after saving picks). Bowl Pool picks are not counted yet; add them before the Bowl Pool opens on 2026-12-07 if the owner wants them in the number.

## 2026-10-26 - Rarely changing pictures are kept by the phone for a day

- Decision: the trophy turntable frames (`/trophies/*`, 124 files), the team logos (`/team-logos/*`) and the loading football (`/football-spin.webp`, 630 KB) are served with `Cache-Control: public, max-age=86400, stale-while-revalidate=2592000` (`next.config.ts`). Pages, data, the manifest and the service worker keep the default (re-checked every time).
- Why: Vercel serves files in `public/` with `max-age=0, must-revalidate`, so a phone re-asked for every one of these on every page view (a round trip each, before it could draw them). Kept a day, repeat visits draw them at once; after a day they refresh in the background.
- Trade-off: a re-rendered trophy (a new champion) or a changed logo can take up to a day to show on a phone that already has the old one.
- Do not: give pages, `/api/*`, the manifest or `sw.js` a long cache (grades and app changes must show at once).

## 2026-10-26 - Accessibility sweep: screen-reader names and two unreadable night colors

- Decision: an automated accessibility check (axe-core, WCAG 2 A/AA) of Standings, the Slate, Notifications, sign-in, the Trophy Room and the Commissioner desk, day and night, led to: the Survivor chip on the ticket is announced as an image with its label; the Survivor Table and Bowl Card scrollers can be reached and scrolled with a keyboard and are named; Standings has a (hidden) page heading; the Grading period picker keeps its name on a phone, where its visible label is hidden; at night the Grading tab's LIVE tag keeps dark ink on its light amber paper (it was light on light, contrast 1.3:1), and the Reminders "No email needed" note uses the night teal (it was dark teal on dark, 2:1). Day mode is pixel-identical.
- Left as is (owner's call): a few muted labels sit just under the 4.5:1 guideline (eliminated players' struck-through names 4.0:1, small teal labels on the Slate 4.4:1, the chat Hide button at night 4.2:1).
- Do not: give the LIVE tag a themed ink again while its paper stays light, or hide a form label without another name on the control.

## 2026-10-26 - Date formatters are built once and reused

- Decision: every `new Intl.DateTimeFormat(...)` in `src/` (21 files) goes through `dateFormat(locale, options)` in `src/lib/date-format.js`, which builds each distinct format once and reuses it (`eastern-time.js` already kept its own). Output is identical.
- Why: building a formatter costs about 80 µs and using one about 5 µs, and several were built inside loops. The playoff eligibility math (run by Standings, the Slate and every pick save during the playoffs) built one per pick and per game: a full season with 12 players took about 290 ms of server time per call, now about 23 ms. The unit suite went from 51 to 34 seconds. It also trims the Slate's per-game date labels on phones.
- Do not: write `new Intl.DateTimeFormat` in a function that runs per row or per request; use `dateFormat` (or `eastern-time.js` for Eastern parts).

## 2026-10-26 - Add to Home Screen: one tap from every page, for every player, on every phone and Chromebook

- Decision: a phone that is not running the Home Screen app is offered the install everywhere: a slim banner under the header of every page and a card on the Notifications page. Android and Chromebooks get Chrome's own one-tap Install when it offers one, and the menu steps until then; every iPhone browser gets one tap on "Show me how" and its own steps (Safari, or Chrome/Edge/Firefox's own Share button); a page open inside another app's window (Facebook, Instagram, Gmail, the Google app) is sent to Safari or Chrome first, with Copy link. "Not now" keeps the banner away 14 days, "I already have it" 180 days; the card is always there. A computer, the installed app and an Android phone known to have the app see no banner. The banner is for everyone, unlike the notification controls, which stay Commissioner-only until the pool opens them.
- Why: the owner wants every player to move to the app ("it's super important that this works perfectly on all mobile platforms"), with players on Android, iPhones and Chromebooks, and asked for one click everywhere, simple and plain enough for anyone. An iPhone has no install button for a web page, so one tap to the steps is the nearest thing. Chrome on an iPhone is not sent to Safari: since iOS 16.4 other browsers add the same kind of Home Screen web app, and notifications reach it.
- How it is checked: a full Chromium in the screenshot suite confirms the app is installable (the suite's own headless browser reports nothing either way), and every phone and browser above is scripted and recognised.
- Do not: show the banner on a computer or in the installed app, bring it back sooner than 14 days after "Not now" (180 after "I already have it"), change the manifest `id`, or set `prefer_related_applications` (Chrome would stop offering the install).

## 2026-10-26 - Phone notifications (Web Push): the foundation, Commissioner-only first

- Decision: the pool can send notifications to a phone added to the Home Screen. This first step is the foundation only: the service worker (`public/sw.js`), the key store (`push_vapid_keys`, made by the server on first use, so no Vercel setup), the saved subscriptions (the existing `push_subscriptions` table, unused since July), the routes `/api/push/key`, `/api/push/subscription` (PUT, DELETE) and `/api/push/test`, and a "Notifications on this phone" section on the Notifications page with turn on, send a test and turn off. Only the Commissioner sees it until reminders are sent this way. The reminders, the icon badge and opening it to every player come next. Passkeys were considered and dropped by the owner.
- Why: the owner asked for push and an icon badge as quality-of-life features. Email reminders stay; push is a second path, not a replacement. Browser push was built on 2026-07-28 and made email-only the same evening; that build left only the table, and nothing from it is reused except the table.
- Safety: the server posts to the subscription's address, so only https addresses on Apple, Google, Mozilla and Microsoft push services are accepted; a notification can only open a page on this site; a phone belongs to the player signed in on it; ten devices at most per player.
- Do not: put the private key anywhere but the database, accept a subscription address from another host, or send a push that carries a pick before kickoff.

## 2026-10-25 - The Other Stats column "Shutout Free Streak" is now "Shutout Free Weeks in a Row"

- Decision: the Trophy Room's Other Stats heading (and the cell's spoken label, "Shutout Free Weeks in a Row: 9 now, 23 best") reads "Shutout Free Weeks in a Row" instead of "Shutout Free Streak". The figures (best run, current run beneath) are unchanged.
- Why: the owner asked for that name; the column counts weeks in a row, matching Perfect Weeks in a Row beside it.
- Do not: rename it back, or reword the neighbouring "Perfect Weeks in a Row" heading, without asking.

## 2026-10-25 - A player's week counts for Perfect Weeks and the streaks as soon as both of their picks are graded

- Decision: the weekly figures on both Trophy Room views (Perfect Weeks, Shutout Free Streak, Perfect Weeks in a Row, and the group's weekly histogram) count a regular week for a player once both of that player's picks are graded (a win or a loss), without waiting for the whole week to be final. A finished week (complete, or every game final) still counts for everyone, with a pick not made as a loss; a week with a pending or voided pick is still left out. `playerWeeks` in `src/lib/group-stats.js`.
- Why: the owner saw Wins and Hit rate move on game day but Perfect Weeks and the streaks stay put until Monday night's game ended, even though a player's 2-0, 1-1 or 0-2 week was already certain. Wins come from graded picks; the weekly figures were the only ones gated on the whole week. A one-pick week is not counted early: the second pick could still be made before its kickoff.
- Do not: count a week early for a player with a pick still pending, or treat a not-yet-made pick as a loss before the week is final.

## 2026-10-25 - A long game name on the Bowl Card spills into its cell, not under the next column

- Decision: the Bowl Card's game heading has `min-width: 0` (`60-bowl-pool.css`). A word wider than the column ("Championship", about 110px, in a 99px usable cell on a phone, 103px on a tablet) used to stretch the heading's grid track to its own width: the heading ran past the cell's right edge, its rule ran into the border, and the next column painted over the last letter ("NATIONAL CHAMPIONSHIF" on the owner's iPhone). Now the heading keeps the cell's width and the word spills evenly into the cell's side padding, clear of both borders.
- Why: the owner saw the National Championship column cut off. The fixture's game names are short, so no screenshot showed it; `table-edges.visual.spec.ts` now renames every game "National Championship" and checks at 360, 390 and 700px that each heading and its text stay inside the cell (mutation-checked: fails without the rule).
- Do not: shrink the heading's size or letter-spacing to fit one word (the font stays as designed), or remove `min-width: 0` from the heading.

## 2026-10-25 - The pull-to-refresh pole has no foot plate: just the skinny black pole

- Decision: the first-down marker in the pull-to-refresh scene ends in a bare skinny black pole (`TIP_HALF` 0.55 units either side) instead of the small black rubber foot plate (3 units wide) it had. The chain clasp, the banner and the landing (the pole's bottom end lands exactly at the ball, with the dust puff) are unchanged. The football is spotted relative to the pole's tip (`ballSpot`), so it moved about a pixel closer to the pole; its drawing is unchanged.
- Why: the owner found the base unnecessary; a plain pole reads cleaner against the ball.
- Do not: draw a plate or flange back on the pole without asking; `FOOT` (the length of the bare pole below the banner) still sets where the pole meets the turf.

## 2026-10-25 - A touch screen's scroll indicator gets its own strip under the Survivor Table and Bowl Card

- Decision: on a touch screen (`(hover: none) and (pointer: coarse)`), `div.bowl-standings-scroll` and `div.survivor-standings-scroll` have `.5rem` of padding under the last row. With a mouse nothing changes (those scrollbars already take their own room), so every desktop and phone-width screenshot, which is taken with a mouse, is unchanged. `table-edges.visual.spec.ts` checks the strip with touch emulation and checks that a mouse gets none.
- Why: on an iPhone the horizontal scroll indicator floats over the bottom edge of the scroller, and the frozen name cells (sticky, each on its own layer) are drawn over it, so the indicator seemed to slide under the names. This was read from the owner's screenshots, not reproduced (no iOS in the test tools), so if the indicator still goes under the names the cause is something else.
- Do not: take the strip off to save a few pixels, or add it for mouse users (a classic scrollbar already has room).

## 2026-10-25 - The Survivor Table and Bowl Card are the page's colour behind their rows, so a sideways pull shows the page

- Decision: `.survivor-standings-scroll` and `.bowl-standings-scroll` use the colour of the page's main area (`var(--themed-bg-18)`, what `main` paints; day `#f5f0e6`, night `#121b22`) instead of the pool's pale paper (`--pool-paper`, `--bowl-card-bg`; the Bowl Card section's override and the unused `--bowl-card-bg` role are gone). Each row, header and sticky cell paints its own colour, so nothing in the normal view changes (all 106 Standings screenshots are identical). A new behaviour test (`table-edges.visual.spec.ts`) checks that both scrollers compute to the colour of whatever is behind them (the first coloured ancestor), day and night, at phone width where they scroll sideways.
- Why: on an iPhone a table that scrolls sideways can be pulled past its edge, and the gap shows the scroller's own background. These two had the pool's pale paper, so the gap read as a white panel beside a beige page. Making them transparent was tried first, but it changes how text inside them is smoothed (a few thousand pixels across 54 screenshots); the page colour gives the same result with no change to the pictures.
- Correction, same day: the first version used `--themed-bg-28`, which is what `body` paints (white by day), but `main` sits on top of `body` in beige, so the tables turned white instead. The test now compares with the nearest coloured ancestor rather than `body`.
- Do not: give a sideways-scrolling table (or any scroller a phone can pull past its edge) a different paper colour than the page behind it; put the colour on the rows instead.

## 2026-10-25 - The Bowl Pool megaphone is centred in its box, its lettering is larger, and the sound arcs are gone

- Decision: the picked-team megaphone no longer draws the three sound arcs, and its swing-up no longer ends in a cheer. The svg's viewBox is now the drawing's own outline once tilted (`1 -8.6 98.5 48.7`), so the megaphone sits in the middle of its pick box; the old viewBox reserved room for the arcs on the right and let the tilted bell stick out of the top, which put it about 3 to 5 px left of and 3 to 4 px above centre. The tilt's pivot is fixed in drawing units (`transform-origin: 12px 25.85px`) so the swing-up is unchanged. The lettering is about 20% larger on one line (10.2 against 8.6) and 13% on two lines (8.4 against 7.4). The size is the same on screen as before to within 3% (2.3rem tall on desktop, 3.78rem wide on phones).
- Why: the owner liked the megaphone but found it off-centre, the school name too quiet, and the sound arcs distracting. This supersedes the 2026-10-19 detail that a newly picked megaphone "gives a cheer".
- Lettering fit: `LETTER_SPACING` (0.06em) is now set by the component and counted when a line is checked or squeezed. Before, a squeezed line (such as a long school name) ran about one letter-space per letter past the room it was given, so it could touch the band. Lines are centred at x 50.5 (one line) or 54.5 (two lines) so they clear the band.
- Screenshots: the `picked` Bowl state now picks Georgia Southern and Ohio State (two-line names) as well as Troy, so both layouts are in the baselines.
- Do not: put sound arcs or any extra drawing outside the outline back without widening the viewBox symmetrically; set the pivot in percentages again (it moves with the viewBox).

## 2026-10-25 - Pool chat is readable at night: names, moderator bar and small text get night colours

- Decision: the chat's player names, MOD tag, moderator side bar, removed-message text and Delete link read colour roles (`--chat-name-ink`, `--chat-mod-badge-ink`, `--chat-moderator-rule`, `--chat-deleted-ink`, `--chat-delete-button-ink`) defined in `00-tokens.css`. Day values are the old colours, so day is pixel-identical. At night the names are a light blue (`#b7c6e3`), the moderator bar and MOD tag are gold like day, and the removed-message and Delete text are lighter. No new night rule was added (the budget stays at 6).
- Why: at night the names were dark blue (`#34415a`) on a dark box and the moderator bar was grey, so a player's name and who is a moderator were hard to see. The owner approved the look from before and after pictures.
- Do not: put chat colours back as literals in `42-pickem-ledger.css`, or add a night override for them; change the role values in the night block instead.

## 2026-10-24 - A postponed game holds the weekly handoff, and says so

- Decision: while a game in the active week is `postponed`, `advanceScoringPeriods` answers `blocked` with "A postponed game is still open: wait for it to be played, or record it as cancelled or no contest." and never calls `complete_scoring_period_atomically`. The week hands off at its normal time once the game is played, or recorded as cancelled or no contest. Cancelled and no-contest games still settle the week as before.
- Why: the app, the runbooks and the project reference counted a postponed game as settled, but the database function (migration `20260809007000`) only accepts final, cancelled and no-contest games, so at the handoff time the call failed and the app threw "The weekly handoff could not be completed safely." The throw sat early in the score sync, so it failed the whole sync on every run until the Commissioner acted. The Operations map already told the Commissioner a postponed game "requires review before week handoff". The database contract is the highest authority, so the app and the docs now match it.
- Do not: release a postponed game from the handoff in the app alone (the database would still refuse), or make the handoff throw again. Releasing postponed games from the hold needs a new migration and a decision from the owner: a game that moves past the week boundary would otherwise keep the whole pool on the old week until it is played.

## 2026-10-24 - The Commissioner desk is shot at two widths, not four

- Decision: `commissioner.visual.spec.ts` shoots every desk page at phone 390 and desktop 1280, day and night. The day shots at phone 360 and tablet 700 (22 images) and their baselines are gone. The behavior tests that check the Performance tables fit their cards at 560, 768 and 1280 px stay.
- Why: the desk's baselines were half of the 78 MB of committed screenshots (one page is 1.5 MB) and every re-record adds that weight to the history for good. The desk has one user, who uses a phone and a desktop; night mode already shot only those two widths. Lossless PNG recompression was measured and saves only 3 %, so fewer images is the only real lever.
- Do not: re-add the extra widths without a layout bug they would have caught; the player screens (Slate, Standings, Bowl) keep all four widths.

## 2026-10-24 - Display-choice, Bowl Card reveal, season-closed Survivor and health-cache tests run the code

- Decision: tests that matched the text of `page.tsx`, `bowl-card.tsx`, `survivor/route.ts` and the health routes now run them. `display-preference.visual.spec.ts` (new, behavior tests, no screenshots) checks the Standings page: a display choice shows before its save is answered, a refresh that carries the old choice cannot undo it, a second tap while saving is ignored, a failed save puts the old choice back with a message, and the page waits behind the loading shell for the Bowl Card's first load (a frozen clock moves 100 ms at a time: not shown before 2.5 s with no answer, shown at once with one). `season-closed-routes.test.mjs` posts a malformed body to the Survivor save: 409 `season_closed` in the off-season, and no pick written; in season the same request gets as far as its body (400). `health-cpu-budget.test.mjs` calls `healthProbeCacheControl` and the core probe (never cached, healthy or failing). `display-preference-race.test.mjs` is deleted; its check that the in-flight guard is a ref and not state (to avoid a second redraw mid-roll) has no behavior to observe and is dropped. The test that the player pages treat a missing season phase as in season and show the banner is dropped: the `off-season`, `playoff-eliminated` and `playoff-forfeited` screenshot states cover the banner, and every other state omits the phase. Every new test was mutation-checked (the line it guards removed, the test fails). `assert.match` calls in tests: 647 to 618.
- Why: matching source text broke on harmless edits and passed on broken behavior; AGENTS.md forbids it for markup and stylesheets and prefers tests that run the code.
- Do not: re-add regexes over `page.tsx`; extend these specs and mutation-check new cases.

## 2026-10-24 - The screenshot check runs as four parallel shards

- Decision: the `visual` job in `quality.yml` is a four-way matrix (`visual (1/4)` to `visual (4/4)`), each shard running `playwright test --shard=n/4` against its own production build; the email artwork test runs in shard 1. `playwright.visual.config.ts` sets `fullyParallel: true` so tests are spread across shards and workers one by one. `visual-baselines.yml` (record with `-u`) still runs the whole suite in one job. Failure screenshots upload as `visual-diffs-1` to `visual-diffs-4`.
- Why: the check took 9 to 20 minutes and every merge to `main` makes the next pull request rerun it, so landing several pull requests in a row cost an hour. Without `fullyParallel` the commissioner file alone held a quarter of the tests, so file-level shards would have been lopsided. The repository is public, so extra runners cost nothing. Branch protection requires `verify` and `database-lifecycle`, not `visual`, so renaming the job breaks nothing; `merge-when-green.sh` matches the names by prefix.
- Do not: shard `visual-baselines.yml` (it has to produce one artifact), or add a required check that names a single shard.

## 2026-10-24 - Night form fields are a cascade layer; the ticket and receipt colours are shared roles

- Decision: the nine night rules that restyled every `input`, `textarea` and `select` (and the Bowl board's button ink) are replaced by one `@layer fields` block in `14-slate-rows.css`, declared after Tailwind's `utilities` layer in `globals.css`. Each declaration reads a night-only role (`--field-*`, `--select-*`) as `var(--field-edge, revert-layer)`: by day the role does not exist, so the declaration reverts and the field keeps whatever Tailwind or the page gave it; at night the layer beats Tailwind's utilities exactly as the old unlayered rules did. A layer loses to every hand-written (unlayered) rule, so the fields the desk styles itself (`.desk-input`, `select.desk-button`, `select.grading-rail-control`, `.pool-select select`, `input.asset-text`, `select.asset-select`) now read the same roles with their own day colour as the fallback; the two classes shared with buttons are qualified with `select.` so buttons are untouched. `color-scheme: dark` is no longer repeated on fields: the night block on `html` sets it and it inherits. The Bowl opt-out link reads `--bowl-optout-ink`, which replaces the night rule for `#bowl-selections button` (the pick boxes already took their ink from `--bowl-sel-ink-950`). The ticket's colours (`--ticket-*`) and the receipt strip's (`--receipt-*`, including the Bowl board's own receipt) moved from their component files into day and night pairs in `00-tokens.css`; the non-colour receipt variables (notch, scallop, bite masks) stay with the strip. Night rules 18 to 6, hex colours 160 to 107 (hex values in the token file are not counted); day and night screens are pixel-identical.
- Why: the old rules won only because an unlayered rule beats Tailwind's layered utilities, which made every field's colour a night-only override that the hand-written classes then had to lose to by accident of specificity. Putting the night field skin in a named layer states that intent, and the roles give the desk's fields one source for their night colours. The six night rules that remain each define the night values of a component's own roles at the place they are used: the main night token block, the Bowl palette blocks (three selectors) and the Bowl claim and picks board paper (two selectors). The Bowl palette's day values are declared on `.bowl-pool-page` and `.bowl-card-section` themselves, and a night value declared higher up (on `html`) would lose to that scope's own day declaration of the same name, so the night values have to be declared on the same elements; the day and night declarations of the main token block likewise belong together.
- Do not: put a field role in `:root` (its day value would stop the layer reverting and change every field by day), add unlayered night rules for fields, or move a `--bowl-*` palette block into the global night block (it would lose to the scope's own day values).

## 2026-10-24 - The Bowl picks board's night ink is roles on the board, and the night rules that remain

- Decision: the Bowl picks board (`#bowl-selections`) restates the Tailwind slate inks and field backgrounds its markup uses (`--color-slate-600`, `--color-slate-700`, `--color-slate-950`, `--themed-bg-25`, `--themed-bg-26`) and its text colour from `--bowl-sel-*` role tokens in `00-tokens.css`, in one day-and-night rule in `60-bowl-pool.css`; the day token values are the root's own values, so day mode is unchanged. Three night rules (two in `14-slate-rows.css`, one in `00-tokens.css`) are gone. Night rules 21 to 18, duplicate selectors 81 to 80, hex colours 162 to 160.
- Why: restating a Tailwind variable in the scope that uses it works because a token such as `--bowl-sel-ink-600: var(--color-slate-600)` is resolved at the root, before the scope redefines the variable, so there is no cycle. The 18 night rules that remain are of two kinds and are meant to stay. Eight define the night values of a component's own roles where they are used (the Bowl palette blocks, the ticket, the receipt strip, the main night token block); moving them to the token file would also define those roles outside their scopes, such as the Bowl pieces on the Assets page by day. Ten restyle native form fields and the Bowl board's buttons: each field's day colours are Tailwind classes that differ from field to field (zinc-400, slate-400, a theme border, a hand class), so one day rule cannot reproduce them, and `revert-layer` cannot stand in because it also discards every hand-written rule for the field. A change that gave all fields one shared day look would change day mode.

## 2026-10-24 - The Slate's instruction cards and the receipt chip's remove button take their night look from roles

- Decision: the Slate's instruction cards (the PICK'EM / SURVIVOR card and the notes grid beneath it) were styled by Tailwind colour classes in `slate-header.tsx` that five night rules in `14-slate-rows.css` restated; they are now `--slate-*` role tokens in `00-tokens.css` (ink, card edge, card background, card ink, accent, notes rule, notes background and ink), read by plain rules in `11-slate-receipt.css` (`.slate-instructions`, `.slate-action-instructions`, `.slate-how-to-grid`), and the colour classes are gone from the markup. The receipt chip's remove button reads `--chip-remove-hover-bg` and `--chip-remove-hover-ink` (the day rule was `color: #9d1e1e`; the night rule is deleted). Night rules 27 to 21, hex colours 172 to 162.
- Why: same as the earlier slices. One night look is kept as it was: the notes grid beneath the cards is a dark panel at night (the old night rule for the card's child divs also matched it), and transparent by day. Checked by the Slate, Slate flow, Standings and chat suites (214 states) against baselines recorded from the previous branch tip, then CI; the remove button's hover colours are not screenshot-covered.

## 2026-10-24 - The pool chat takes its night look from roles, and gets a screenshot state

- Decision: the chat's box, form rule, hint and empty-state ink, message ink, message rule, moderator bar, message field (background, edge, focused edge, ink, placeholder) are `--chat-*` role tokens in `00-tokens.css`, day value equal to what the Tailwind classes gave, night value equal to what the six night rules in `40-pool-chat.css` painted. The markup carries layout only: the colour classes are gone and the pieces have `pool-chat-composer`, `pool-chat-input`, `pool-chat-note`, `pool-chat-empty` and `pool-chat-body`. The input rules name `.pool-chat` first so they outrank the page-wide night rules for form fields. Night rules 36 to 27, hex colours 184 to 172. Two night looks are kept as they were, though they look like oversights: the moderator's left bar is the same grey as the message rules at night (the old night rule repainted every border of a message), and a focused message field keeps its grey edge at night (only the ring and the page-wide outline show the focus).
- Why: the chat had no screenshot at all (the other suites keep it hidden or empty), so a night colour could not be checked. `chat.visual.spec.ts` opens it with four messages and shoots it closed, with the emoji picker open and with a draft typed, at phone 390 and desktop 1280, day and night; the emoji pictures are masked because the colour emoji settle a few pixels differently from run to run.

## 2026-10-24 - Survivor rows and the Pick'em pad take their night look from roles

- Decision: the Survivor table's row colours (header, body, alternate, your own row, and the ring around it), the Pick'em pad's ink, paper and ruled-line colours, and the playoff board's viewer row are global role tokens in `00-tokens.css` (`--survivor-*`, `--viewer-*`, `--pad-*`, `--playoff-viewer-bg`) with the night values in the existing night block; the day rules in `41-survivor-table.css`, `12-survivor-chip.css` and `13-pickem-pad.css` read them. The IN / OUT and name colours of the Survivor table's sticky cells were Tailwind text classes that your own row restated at night, so they are now `is-in`, `is-out` and `is-inactive` classes in the markup and CSS, with `--viewer-in-ink`, `--viewer-out-ink`, `--viewer-muted-ink` and `--viewer-name-ink` for your own row. Deleted as dead or redundant: a night rule for `td` cells that the Survivor table (divs, not a table) has never had, the sticky cells' night background (the row variable already gives it), and the pad row's night `border-color` (the day rule already reads the same variable). Night rules 46 to 36, hex colours 202 to 184.
- Why: same as the earlier slices, one place to read each piece's night look. Checked by the Standings, Slate and Bowl suites (234 states, day and night) against baselines recorded from `main`, then CI. Not covered by a screenshot: an OUT or inactive player's own row at night.

## 2026-10-23 - Commissioner toggles and tables, and the page's night base, take their night look from roles

- Decision: the pool display toggle (`--pool-toggle-*`: ink, edge, background and their hover and focus values) and the provider chart and grading worker tables' rules (`--chart-head-rule`, `--chart-row-rule`) are global role tokens in `00-tokens.css`, with the night values in the existing night block; the five night repaint rules in `50-commissioner.css` are gone. The page's night base (`--background`, `--foreground`, `color-scheme: dark`) moved from `14-slate-rows.css` into that same night block. Night rules 53 to 46, hex colours 217 to 202.
- Why: same as the earlier slices: one place to read each piece's night look. What is left as night rules is night-only by nature: native form controls and the Slate instruction cards (no day rule exists, the day look is the browser's or Tailwind classes in the markup), the pool chat's Tailwind-class repaints, the Bowl palette block, and the Survivor viewer-row variables. Checked by the Commissioner, Standings, Slate and Bowl suites against baselines recorded from the previous branch tip, then CI.

## 2026-10-23 - The ticket, the Pick'em viewer row, the playoff paper and the chat dock take their night look from roles

- Decision: the Standings ticket (`.my-ticket`) keeps its paper, edge, heavy rule, dashed rule, dotted rule, small ink, open ink and barcode in `--ticket-*` roles on `20-ticket.css`; one `html[data-theme="night"] .my-ticket` block sets them, and the day rules for the race and footer rules, picks, selection, survivor, open, instructions, completion and barcode read them. The Pick'em viewer-row teal glow and rail are `--viewer-glow` and `--viewer-rail`, the playoff board's ruled paper is `--playoff-grid-rule`, `--playoff-margin-rule` and `--playoff-paper`, and the chat dock background is `--chat-dock-bg`, all in `00-tokens.css` with the night values in the existing night block. The matching night repaint rules are gone (night rules 72 to 53, hex colours 221 to 217, duplicate selectors 82 to 81).
- Why: same as the Bowl pages and the Slate receipt: one place to read what each piece looks like at night, and a day edit can no longer be silently outranked by a night rule. The Pick'em Pad's `box-shadow: none` night rule is deleted because the day rule for the same selector is more specific and already says it. Day mode is pixel-identical; night mode is identical in the Standings, Slate and Bowl suites against baselines recorded from `main`, then CI.

## 2026-10-23 - Slate: the receipt link, the marker and the chips take their night look from variables

- Decision: the receipt's "View full ticket" link, the only link in the receipt strip, now reads `--receipt-link-ink`, `--receipt-link-hover-bg` and `--receipt-link-hover-ink`; the receipt strip's phone background is `--receipt-strip-bg` (night only, transparent otherwise). The pink team marker is one gradient token (`--team-marker-gradient`), the Slate chips' official line colour is `--selection-chip-official-ink`, and the empty-action rule colour is `--action-empty-edge`; day and night values sit side by side in `00-tokens.css`. Night rules 87 to 72, hard-coded hex colours 227 to 221. Night rules that only repeated the day value were removed (chip left border, chip text, marker background and tail, team selection shadow, the mini nav's divider and border, which the receipt never shows).
- Why: the receipt strip is the only mini nav, so the nav's own night rules were really the receipt link's night look, and the variable I set for it last time (`#eaf7f4`) was never the colour that showed; it is now the real one (`#d6e2df`). Checked by the Slate, Slate flow, Bowl Pool, Bowl flow and Standings suites (250 states, day and night) against baselines recorded from `main`, locally, then CI. The instruction cards beside the Slate header stay as night rules: their day colours are Tailwind classes in the markup, so there is no day rule to hang a variable on.

## 2026-10-23 - The receipt strip's night colours are roles, not repaint rules

- Decision: the Slate receipt (ticket stub, pick chips, sealed Survivor chips, pool note, Bowl metrics) already kept its paper, ink and rule in `--receipt-*` variables on `.slate-receipt-strip`; the rest of its night colours were separate rules in `14-slate-rows.css`. They are now variables too (`--receipt-label-ink`, `--receipt-link-ink`, `--receipt-chip-*`, `--receipt-sealed-*`, `--receipt-note-*`, `--receipt-metric-*`), read by the day rules in `11-slate-receipt.css` and set for night in the one block that already held the paper colours. Night rules 105 to 87, no hex colours added. The Survivor name beside the chip and the Bowl metric cells use `var(--x, inherit)` so a day screen without the variable inherits exactly as before.
- Why: same as the Bowl pages: one place to read what the receipt looks like at night. Two night looks are kept as they were, though they look like oversights: the receipt's `ALL PICKS SAVED` and unsaved notes are the same grey at night (the generic night rule outranked the green and amber day rules), and the receipt link keeps its night colour on hover. If either is meant to differ, change the `--receipt-note-done-ink` or `--receipt-note-unsaved-ink` night value. Checked by the Slate, Slate flow, Bowl Pool and Bowl flow suites (144 states, day and night) against baselines recorded from `main`, locally, then CI.

## 2026-10-23 - Bowl Card standings: night mode joins the same palette of roles

- Decision: the Bowl Card table's night colours, which were split between `50-commissioner.css` (a 36-line night block) and `60-bowl-pool.css` (which overrode part of it), are now roles in the Bowl palette: `--bowl-card-bg`, `--bowl-head-edge`, `--bowl-head-ink`, `--bowl-cell-ink`, `--bowl-name-rule`, `--bowl-line-ink`, `--bowl-row-bg` and `-alt-bg`, `--bowl-win-ink`, `--bowl-loss-ink`, `--bowl-locked-ink`, `--bowl-open-ink`, `--bowl-pick-ink`, `--bowl-scroll-thumb` and `-hover`. The day rules read the roles and the one night block sets them, using the colours that were actually winning (a rule in the first file that the second overrode was dropped, for instance the game cells' `#1c2c36`, the bowl names' `#f6f7f2` and the rows' `--blue-15`). Night rules 132 to 105, hex colours 235 to 227, duplicate selectors 85 to 82.
- Why: the table had two night definitions that disagreed and a reader could not tell which one painted the screen. Checked by the Bowl Pool, Bowl flow and Standings suites (146 states, day and night) against baselines recorded from `main`, locally, then CI. The scrollbar colours are not in any screenshot (the browser draws them overlaid); their hover keeps the night thumb colour, as before.

## 2026-10-23 - Bowl picks page: night mode is one palette of roles, not 16 repaint rules

- Decision: the Bowl pages (`60-bowl-pool.css`) now name what they paint with as roles in the page scope: `--bowl-ink`, `--bowl-subtitle`, `--bowl-cta-bg`, `--bowl-row-line`, `--bowl-board-bg` and `-edge`, `--bowl-pick-edge`, `--bowl-pick-on` and `-on-hover`, `--bowl-tile-bg`, `-edge`, `-seam`, `--bowl-megaphone-glow`. The day rules read the roles; one night block redefines them (for the Bowl Pool page, the Bowl Card section, and `html` itself so the Bowl pieces on the Assets page keep their night look). Night rules 148 to 132, `!important` 9 to 8, hex colours 237 to 235. The pressed pick box has its own hover rule, because its night colour used to win over the generic hover by specificity and would otherwise flash cream. Dead day rules removed with it: the old `#bowl-selections` border and background block (overridden by a later rule), the `#e7dfcb` row lines (overridden by the schedule rule), and the night rules that repeated the day value (legend bar, official line, `!important` row rule).
- Why: by hand, one screen at a time, because a night rule often exists only to outrank a day rule, and a mechanical fold-in changed the screen twice. Checked by running the Bowl Pool, Bowl flow and Standings suites locally against baselines recorded from `main` (146 states, day and night, identical), then in CI. Not yet converted: the Bowl Card standings table, whose night colours are split between `50-commissioner.css` and `60-bowl-pool.css` (next slice).

## 2026-10-23 - Night mode: four colour overrides become theme-pair tokens; the other 148 night rules stay on purpose

- Decision: a night rule that only swapped a colour is replaced by a role token (`--themed-text-N`, `--themed-bg-N`, `--themed-border-N`, `--themed-shadow-N`) read by the day rule, with the day and night value together in `00-tokens.css`, but only when no other rule that matches the same element and sets the same property would then win over the day rule. Night rules 152 to 148, hard-coded hex colours 238 to 237 (budgets lowered). Two earlier passes were wrong and were caught by the Bowl picks night screenshots: a generic night rule for the pressed pick box, and a day rule on the schedule rows' children that outranked the row's own day rule. The checker now treats a rule with no class, id or tag (`> :not(...)`) as matching everything.
- Why: a night override has more weight than the day rule it changes, so most night rules exist because a more specific day rule would otherwise win. Turning those into tokens means re-scoping or reordering the day rules, a design change with unseen states (hover, focus) that screenshots do not cover, so the remaining rules are left as night rules. Do not retry this as a mechanical pass.

## 2026-10-23 - The Bowl email scheduler and score route are tested by running them

- Decision: `test/automatic-bowl-emails.test.mjs` runs `ensureAutomaticBowlPoolEmails` against a scripted database: one lines-are-set email per game day at the day's earliest line lock, one pick-due reminder per scheduled game three hours before kickoff (none once that time has passed or the game is postponed), each day's recap only from 5 AM Eastern the next morning, a duplicate (23505) skipped without counting, any other queueing error or a missing Commissioner a failure. `test/sync-bowl-scores-route.test.mjs` runs the `sync-bowl-scores` route: 500 without the secret, 401 on a wrong token, the Bowl season gate, the `bowl_scores` lease, a busy lease as a skip, any other failure as a 500 with its message. The matching text checks in `bowl-email-pipeline.test.mjs` are gone; the NFL-route and migration rules stay.
- Why: the text checks passed whenever the words were in the file. Mutation-checked: duplicate code, reminder cut-off, recap time, postponed filter, game ids, lease name, gate kind, token check, 500 status. The remaining Bowl text tests are SQL contracts or the ESPN source rule.

## 2026-10-23 - The rehearsal is checked by walking it

- Decision: `test/visual/rehearsal-walkthrough.visual.spec.ts` opens `/preview` and walks the six scenarios in the four views (Ticket, Slate, Pick'em Pad, Email): blank ticket, the Week 5 handoff, Monday's W/L stamps and the Pad's win counts, no win counted before its game is final, the playoff round's sealed picks, and which sample image each email carries. It replaces `rehearsal-ticket-lifecycle.test.mjs`, which matched the page's source text. No screenshots are compared; the Account "preview" state still covers how it looks.
- Why: the text checks passed whenever the words were in the file, not when the page showed the right thing. Mutation-checked: a game left non-final, a scenario label changed, a reveal email given the Slate image, the Survivor recap line changed.

## 2026-10-23 - The reminder-schedule job is tested by running it

- Decision: `test/reminder-schedule-maintenance.test.mjs` runs the real `/api/cron/maintain-reminders` route and `maintainAutomaticReminderSchedule` with the reconcilers and lease scripted (auth, off-season gate, `reminder_schedule` lease, order of the three reconcilers, busy-lease skip, 500 with the reason). The text assertions on the maintenance module and route were removed; the SQL and migration contract tests in `critical-automation-reproducibility.test.mjs` stay.
- Why: the gating SQL itself can only be proven by the isolated database workflow, so it stays a contract test; the TypeScript side was text-matching behavior. Mutation-checked: wrong lease name, gate removed, auth inverted, a reconciler dropped.

## 2026-10-23 - Period rollover is tested by running it, and the app-calls-RPC rules live with the architecture rules

- Decision: `test/advance-scoring-periods.test.mjs` runs the real `advanceScoringPeriods` against a scripted database (earliest due period, blocked/waiting outcomes, the pending Pick'em and Survivor gates, rollover only after `weekRolloverAt`). The "app calls the atomic function" and ESPN Bowl protected-path source rules moved from `atomic-grading-and-line-lock.test.mjs` to `test/architecture-rules.test.mjs`; the season-year and retry-ladder checks now import the modules. SQL contract tests stay in place.
- Why: the text twins broke on harmless edits and passed when behavior broke. Each new test was mutation-checked (latest period picked; Survivor gate off).

## 2026-10-23 - Documentation caught up with the Trophy Room launch week

- Decision: `docs/PROJECT_REFERENCE.md` gains a Trophy Room section (open to players since 2026-10-23; pictures and banners; the Pick'em-only tables; the one-minute server cache); `docs/OPERATIONS.md` records the polling cadences (and corrects the Grading page's quiet interval to 15 minutes, as the code has it), the first-load retry, the Fluid CPU calibration history and the CI notes (cached CLI images, Playwright pinned, `npm audit` gate).
- Why: the facts were only in decision-log entries and tests.

## 2026-10-23 - Fluid CPU estimate recalibrated to 2 h 55 m

- Decision: the per-active-player cost in `src/lib/vercel-usage-estimate.js` goes from 22 to 18.3 seconds a day so the model reproduces Vercel's meter, 2 h 55 m for the 30 days ending 2026-10-23 with 11 active players (the background jobs are unchanged at about 2.5 minutes a day).
- Why: the dashboard still read higher than Vercel after the 2026-10-19 calibration (3 h 16 m); the meter keeps falling as polling has slowed. The Trophy Room opened to players on 2026-10-23: its data is built once a minute for everyone, so watch the meter over the next weeks and recalibrate if it moves.

## 2026-10-23 - Saving picks, the worker-health route and the reminder lease are tested by running them

- Decision: `picks-route-read-failures.test.mjs` runs the real pick-saving route (a failed scoring-period read is a retried 503, never a 404; a missing week is a 404; a completed week is read-only). `critical-worker-health-route.test.mjs` runs the public worker-health route (200 or 503 with only a status and a time, the ten-minute allowance, trouble remembered from its first sign, a state-read error is unavailable, the problem detail only in the log). `pin-login-route.test.mjs` now checks that a failure to clear old PIN attempts is reported. `automation-lease-retry.test.mjs` checks the reminder worker's ten-minute lease. The matching source-text assertions were removed from `fail-loud-reads`, `critical-worker-heartbeat` and `pool-lifecycle-hardening`; the SQL contracts, the Sentry configuration values and the two source rules that cannot run without a live pool stay.
- Why: the text twins passed whenever the words were in a file. Each new test was mutation-checked (read error ignored, completed week allowed, trouble start reset each time, state error ignored, problems leaked into the body, always-200, clear failure swallowed, lease length changed).

## 2026-10-23 - The screenshot suite runs on four workers and is skipped when a pull request cannot change a screen

- Decision: CI runs the screenshot suite (`visual`) with four Playwright workers (two locally), and a `changes` job skips it on pull requests whose changed files are all outside `src/`, `public/`, the screenshot/e2e/helper/email-artwork tests and the build, dependency and quality-workflow configuration. Pushes to `main` always run it.
- Why: each merge reruns the next pull request's checks, and `visual` (about ten minutes of a twelve-minute wait) dominated it. Test-only, docs, migration and script changes cannot alter a screenshot. Four cores are what GitHub gives a public repository on `ubuntu-24.04`; images are unoptimized in CI, which was the original reason for two. Measured on the pull request that made the change: the screenshot step went from about 10 minutes (two workers) to 6.6-8.1 (four), and the whole `visual` job from 12.5 to 7.7 minutes with the email-artwork change below. The email-artwork check in the same job now runs from its own test file (4 seconds) instead of `npm test` with a name pattern, which still started every test file (1 min 22 s).

## 2026-10-23 - Playoff recap, email plans and season turnover are tested by running them

- Decision: `test/playoff-recap-behavior.test.mjs` runs the real playoff-day recap builder against a scripted database (the game day it covers, scheduled-games scoping, an unsettled day refused, champions named only on the round's last day) and renders the recap email (champion, co-champions, eliminations). `email-plans.visual.spec.ts` clicks Essentials, Regular and Full Card on the Notifications page and checks the playoff toggles. `test/season-rollover-behavior.test.mjs` runs the annual boundary and cleanup steps and the bootstrap status reader. The matching source-text assertions were removed from `playoff-email-policy`, `annual-season-turnover`; the SQL/migration contracts and the two reveal-snapshot source rules stay.
- Why: the text twins passed whenever the words were in a file. Each new test was mutation-checked (scheduled games ignored, champions on any day, champion copy changed, elimination gate off, regular plan with and without the recap/reveals, boundary error ignored, empty cleanup answer accepted, wrong turnover year).

## 2026-10-23 - The refresh pole's foot is a black cuff, post and small flange

- Decision: the foot of the first-down pole is drawn after the real marker: a black cuff where the orange banner ends, a narrow black post, and a small flat flange at the bottom, with a steel clasp where the chain is fastened (plain black, no highlight). It replaces the single grey rubber stopper. The spotted football is unchanged (an attempt to redraw it with pebbled leather and a seam was rejected as worse).
- Why: owner request, with a photo of the real marker as the reference; the first flange was too wide, and the round bolt and the shine on the post were dropped.

## 2026-10-23 - The refresh chain runs ten yards back, and the flag is clipped to the pole

- Decision: the chain's fixed end is ten yards behind the lead pole (it was a few pixels off the left edge), so the chain climbs at about 2 degrees instead of 8 and the pole first shows about a third of the way across. The flag hangs on a link a little way back from the lead pole (the true middle of a ten-yard chain is off the page). The chevrons on the orange banner are clipped to the banner's outline, so they can no longer poke past its edges.
- Why: owner feedback. A real chain is ten yards long and the picture is zoomed in on its last three, so the far end is yards away and the slope must be shallow. The chevrons' stroke and mitred corners overshot the tapering banner by a hair.

## 2026-10-23 - The Trophy Room opens to every player

- Decision: `TROPHY_ROOM_PLAYER_OPENS_AT` is 2026-10-23T12:00Z, so every active player can open the Trophy Room (and sees its link in the name menu) from that time, for good; the Commissioner always could. Supersedes the plan to open it with the Bowl Pool on 2026-12-07.
- Why: owner decision after the trophy, banners, tables, phone memory and speed work. The data is built once a minute for everyone (decision of 2026-10-21), so the opening costs little CPU.

## 2026-10-23 - Other Stats column labels are centred on one another

- Decision: the column labels of the Other Stats heading (Player, the streaks, Wins, Losses, Hit rate, Pushes picked) are vertically centred on one another instead of sitting on a common bottom line. Refines the 2026-10-23 entry that bottom-aligned them.
- Why: owner review on a phone: one-line labels beside three-line ones looked low.

## 2026-10-23 - Trophy Room: no places on Other Stats, A to Z by default, no visible heading over the trophies

- Decision: the Other Stats table has no rank column or tie marks; it opens sorted A to Z by player name, the Player heading is a sort button (a second tap reverses), and choosing a column sorts by it. The Record table keeps its places. The "The trophies" heading above the turntable is no longer shown (it stays for screen readers).
- Why: owner review: places make no sense across so many different stats, and the heading was redundant over the picture of the trophies.

## 2026-10-23 - Other Stats: Player and Rank sit on the label row

- Decision: in the Other Stats heading the group headings (with their gold rules) have a row to themselves, and Player and Rank are in the row of column labels with everything else, all bottom-aligned, instead of spanning both rows and floating between them.
- Why: owner review on a phone: Player sat in the middle of the heading, level with nothing.

## 2026-10-23 - Trophy Room polish before it opens to players

- Decision: the Other Stats headings have more room; the spin arrows are more visible (darker disc, brighter outline, 80% opacity); a banner's title (PICK'EM CHAMPION and the others) always wraps onto two lines and is larger and bolder (the years keep their lettering); Consecutive Donut Free Weeks is now Shutout Free Streak and Consecutive 2-0 Weeks is now Perfect Weeks in a Row; the Record table gains a sortable Perfect Weeks column, the count of 2-0 weeks in all, as its last column (`streaks.sweeps.total`).
- Why: owner review ahead of opening the Trophy Room to every player.

## 2026-10-23 - The Pick'em trophy: a smooth marble column, marble that belongs to the stone, collars cast into it

- Decision: the Pick'em trophy's column is a smooth turned column (no scalloped flutes). Its marble is painted from the column's own profile with 3D noise (`marbleOnProfile` in `tools/trophy-render/lib.js`): veins are soft, grey and diagonal, run on continuously and never repeat or pinch, in place of a small tiled picture wrapped round the stone. Every gold collar (the two on the column, the two where the lattice anchors, and a slimmer one round the foot) swells out of the stone in a smooth ogee and sits in a hairline seating groove, with an engine-turned face between two rope rolls; the rubies grow in size from the top collar to the bottom one, and the foot's collar has none. All 120 pictures, the three sharp resting views and the phone set were re-rendered.
- Why: owner feedback: the column was not convincing, the marble looked janky (streaked, repeating), and the gold bands looked pasted on.

## 2026-10-23 - Pull to refresh: the chain is stretched first, the foot is planted and stays

- Decision: the pole no longer starts with the chain taut. It is drawn out leaning, at one height, with the chain slack in humps on the turf, until the chain is stretched to its full length (one slight boing, `chainTwang`); only then does it drop, straightening, and land with the dust. The foot, once planted, does not squash, bounce or swing: the pole stands upright and still. The down counter is a little larger (shorter post) with six thick slats instead of twelve thin ones; the field gets mowing stripes, a darker far side and a near sideline; the red marker on the chain is a simple flag through it that hangs a little below. Supersedes the 2026-10-21 rules that the chain is taut throughout and that the pole swings once past upright.
- Why: owner feedback after using it: the first motion should read as stretching a chain, and the old landing bounced off the ground and hovered.

## 2026-10-21 - Source-text tests, stage 2 (third slice): Grading route, season ladder, Bowl Pool entry rules

- Decision: the Grading dashboard's route is run against a scripted database (`grading-dashboard-route.test.mjs`: refused before any read unless Commissioner; the answer carries every field the dashboard draws; every worker's latest run is read), the season ladder's paging is run (`season-ladder-loader.test.mjs`), and the Bowl Pool's entry rules run through the real submit route (`bowl-pool-entry-rules.test.mjs`: entry and opt-out close at the first kickoff, a seat holder can still pick open games, a kicked-off game is never saved, a pick must be one of the game's teams). The Bowl Pool's player flow is a browser test (`bowl-flow.visual.spec.ts`: claim a seat, choose, submit, opt out). Their text twins were deleted. Each test was mutation-checked.
- Why: the Bowl Pool opens to all players on 2026-12-07; its entry rules and flow now fail when broken, instead of passing on the words in the source.

## 2026-10-23 - Playwright is upgraded on purpose, not by Dependabot

- Decision: Dependabot ignores minor and major updates of `@playwright/test`. A test checks that the package version and the Playwright container tags in `quality.yml` and `visual-baselines.yml` are one version. An upgrade bumps all three together and re-records the Linux baselines.
- Why: the npm group PR #547 bumped `@playwright/test` to 1.64 while the screenshot job runs in the 1.63 container, so every visual test failed with "Executable doesn't exist"; a new browser can also move pixels.

## 2026-10-23 - A first load that fails is tried again by itself before the player sees an error

- Decision: the Standings and the Slate retry a failed first load once, 1.5 seconds later, and show "taking too long" only when the retry also fails. The Slate's first request now also has the Standings' fifteen-second limit, so a request that hangs is dropped and retried instead of leaving the football spinning. While the Standings error is showing, coming back to the tab (or focus) loads again at once instead of waiting out the 30-second return gap. Browser tests with failing and hanging requests are in `load-retry.visual.spec.ts`.
- Why: iPhone Safari cuts off or suspends a request when the tab is in the background, and a cold start can run long; the page treated any failed first load as "taking too long" (a screenshot from 2026-10-22 showed it while the site and its health checks were fine).

## 2026-10-23 - Next.js 16.4.2 (security release)

- Decision: `next` and `eslint-config-next` move to 16.4.2. `next` stays exact-pinned.
- Why: advisories published for Next 16.0.0 to 16.4.0 (unauthenticated remote code execution through the image optimization API with SVG files and through `use cache` functions, and a Server Actions denial of service) made `npm audit --audit-level=high` fail in every pull request's `verify` job. 16.4.2 is the patched release.

## 2026-10-21 - Elements are styled by name, not by their place in a list

- Decision: the Worker activity table's cells, the Pick'em ledger's first pick cell, the Slate's Survivor instruction and the Trophy Room's Player heading are styled through class names (and an adjacent-sibling rule on a named cell), not `:nth-child(n)`. `scripts/css-report.mjs` now counts index-based selectors (`indexSelectors`, 17 left: generic dashboard table styling, the Slate row grid, animation stagger on a fixed set of marks) and the stylesheet budget ratchets it down. Selectors that use an id as the specificity anchor (`#bowl-selections`) are left as they are: turning an id into a class changes which rule wins.
- Why: a column reorder silently relabelled the Started and Finished lines of the Worker table. Specificity was kept equal rule by rule, and the screenshots gate that nothing moved.

## 2026-10-21 - Source-text tests, stage 2 (second slice): Season Snapshot, polling cadence, Sentry filter

- Decision: the Season Snapshot's source-text tests are gone. Its access gate now runs the real loader with a scripted database (`season-snapshot-access.test.mjs`: players see nothing and only Week 6 is read before the release; a chart cached for the Commissioner never reaches a player), and page-by-page reading runs `readAllPages` (`read-all-pages.test.mjs`). The remembered-choices and loads-once tests already existed as browser tests, so their text twins were deleted. Polling cadence is pinned by behavior with a fake clock (`polling.visual.spec.ts`: home every 5 minutes, chat every 3, grading every minute while live and every 15 when quiet, none while hidden, one refresh on return), and the Sentry filter runs (`sentry-event-filter.test.mjs`). Rules about how the code is put together live in `architecture-rules.test.mjs`, on purpose lint-style.
- Why: tests that match source text break on harmless refactors and pass when behavior is wrong. Each new test was mutation-checked (the code was broken, the test failed).

## 2026-10-21 - The Trophy Room data is built once a minute, not once per page open

- Decision: `/api/trophy-room` builds its figures through `createShortCache` (60 seconds, one build shared by requests that arrive together, a failed build never kept). Access is checked before the cache, so a player who may not see the Trophy Room still gets the 404.
- Why: the figures are the same for everyone and only change when a game is graded, but each page open read every pick, game and line ever recorded. The Trophy Room opens to all players on 2026-12-07, and the project stays on Vercel Hobby, so its Fluid CPU has to stay low. A graded game still shows within a minute.

## 2026-10-21 - Keep the Supabase CLI's container images between isolated runs

- Decision: `isolated-integration.yml` restores the CLI's container images from the Actions cache (keyed on the pinned CLI version, so a new version starts a new cache) before the database-types check, and saves them after the first successful pull. `scripts/database-types.mjs` still retries a rate-limited pull a few times.
- Why: `supabase gen types` pulls a postgres-meta container from a public registry that caps anonymous downloads per runner address and answers "too many requests" for hours once it has; a short retry cannot outwait that, and it blocked four merges on 2026-10-21.

## 2026-10-21 - Trophy Room: banners on a canvas, no cross-fade in the turn

- Decision: a banner is drawn on a canvas at full device resolution; its cloth is laid down a couple of pixels of height at a time, each row shifted by a swing from the rod and a travelling wave (`src/lib/banner-wave.js`) and lit by how it leans. Edges, stitching and lettering bend in one smooth curve; nothing is rotated or scaled, so it stays sharp. The table shows the nearest single picture (never two blended), and follows a finger with a short glide; the phone set is the same 120 views at 660 wide.
- Why: the SVG banner was cut into 12 strips (stair-stepped edges, broken stitching) and was rasterized small and scaled by the unfurl, so it looked pixelated. Blending neighbouring pictures ghosted every trophy, which read as blur.

## 2026-10-21 - Restore Survivor champions eliminated after the crown

- Decision: a one-time migration (`20261021030000_restore_champions_eliminated_after_crown.sql`) puts a crowned Survivor champion's entry back to active when the no-pick rule eliminated it after the crown (no losing game, an audit row from the rule, eliminated after the championship). It uses the integrity trigger's own audited score-correction guard for that statement only and writes `survivor_champion_entry_restored` for each entry. Owner approved it for Zac's entry.
- Why: the rule fixed in 20261021020000 had already eliminated the champion, and the trigger forbids reactivation, so the data stayed wrong even though the app now reads the champion from the season record.

## 2026-10-14 - Standings starts the Bowl Card's read with its own

**Status:** Accepted

On Standings the Bowl Card is drawn only after the main Standings data arrives,
and the card then fetched its own: two reads in a row before the loading football
goes. A device that showed the Bowl Card on its last visit now starts the card's
read at the same time as the main one (on the first load of the page only) and the
card takes that same response. The number of requests is unchanged (one Bowl Card
read per page load); the wait becomes the longer of the two reads instead of their
sum. A first visit, or a device that hid the card, behaves as before. The early
read is dropped after 15 seconds and shared only for the first moment after it is
taken, so a refresh always reads fresh.

**Reason:** The commissioner asked whether loading can be faster. This removes a
real serial wait without adding server work (the Vercel Hobby CPU budget is
unchanged) and without changing what any player can see.

## 2026-10-14 - The Assets page becomes the Workshop

**Status:** Accepted

The Assets page is the **Workshop**: the same real pool pieces with sample data,
now fully hands-on. The loading football can be dragged, paused on any of its 108
frames, stepped, or played; the chip has all 32 NFL teams; the pick highlight, the
split-flap counters and the Bowl crest take typed names and numbers; the Submit
button can be shown unsaved or saved; the pennant has more schools. Every card
keeps "Live values", and "Your settings" copies whatever differs from live. It
reads and writes no pool data.

**Reason:** The commissioner wanted a place that is fun to spend time in, with
every piece fully interactive, instead of a list of sliders.

## 2026-10-14 - Commissioner desk: five tabs, with repair and health in drawers

**Status:** Accepted

The desk's seven tabs (Overview, Grading, Game day, Bowl Pool, Season, System,
Assets) become five: **Today** (the live map, the game pipeline and key counts,
up next), **Performance** (provider cost, the polling chart, account capacity),
**Season**, **Bowl Pool**, and **Workshop** (the old Assets page). Repair and
health tools are drawers at the bottom of Today (Game-day guide, Fix something,
Checks and manual runs, Health and safety); Fix something and Health and safety
open by themselves when the live map reports attention. No control was removed
or rewired; each keeps its own server route, authentication, and safeguards. The
three manual checkers stay separate because two of them can write; a combined
"run all" button was considered and not built.

**Reason:** The commissioner found the desk to hold too much information, poorly
presented. One page for the day, one for performance, and drawers for the rare
tools show less by default without hiding anything.

## 2026-10-14 - Provider cost chart: 15- and 30-day averages only

**Status:** Accepted

The Provider performance chart in Grading plots credits per settled game as a
15-day and a 30-day moving average, both game-weighted over the last 15 or 30
Eastern calendar dates. The per-slate credits line, the settlement-latency line
and its right axis, and the "Settlement average" tile are removed. "Games on
time" and a budget-pace line were considered and deferred.

**Reason:** The commissioner wants the chart to tell one story: is polling getting
cheaper or dearer over time. Per-slate points and latency were noisy and did not
answer it. The 15-day line is unchanged in definition; the 30-day line uses the
same rule over a longer window.

## 2026-10-12 - Season Snapshot opens to players once Week 6 has settled

**Status:** Accepted

Players now get the flip button and the snapshot data once every Week 6 Pick'em
pick has settled (the same test the chart uses to plot the active week), rather
than as soon as Week 6 begins. It then stays open through the playoffs until the
August 1 rollover. Commissioners still always have it. Home and the data route
read Week 6's games and picks for this check only while Week 6 is in play.

**Reason:** The commissioner wants the reveal to land with six full weeks on the
chart. Supersedes the Week 6 start in "Season Snapshot opens to players at Week
6; weeks plot together".

## 2026-10-06 - AUTH-002 - Extend request-scoped access to Pick'em saves

**Status:** Accepted for the Pick'em save route

Pick'em save validation still rejects malformed bodies before token or pool
reads. A valid submission then uses the shared active-player result, keeping
invalid sessions at 401, inactive or missing players at 403, temporary auth or
profile failures at 503, and missing configuration at 500. Safe token and
profile reads retain their bounded retry; the selection mutation is never
replayed on an uncertain outcome. Failure codes are additive to the existing
human-readable error field. Isolated player-flow evidence is required before
release.

## 2026-10-05 - AUTH-001 - Distinguish invalid sessions from dependency failure

**Status:** Accepted for the Season Snapshot pilot; extended by AUTH-002

An unavailable authentication service or failed player lookup must not be
reported as an invalid session. Use a request-scoped result with explicit
401/403/503 outcomes and a stable code; keep missing server configuration an
intentional 500. Start with a read route so the contract can be exercised
without changing save retry behavior. Migrate other routes only with their own
failure tests and isolated player-flow evidence. Do not cache authorization.

## 2026-10-05 — PERF-001 — Reuse grading game rows for the line query

**Status:** Accepted for the selected-period grading dashboard read

The dashboard already loads the selected period's game IDs with its full game
rows. Reuse that result to select locked lines instead of issuing an ID-only
`games` request. Normalize the read to one promise so other dashboard queries
can remain concurrent, and keep the same failure handling. The observed
request-count reduction is one per loaded period; no latency or Vercel CPU
claim is made without isolated and production measurements.
