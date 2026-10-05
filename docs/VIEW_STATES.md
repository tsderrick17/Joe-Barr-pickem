# View states and their screenshots

Every view the app renders, every state it can be in, and the test that would
fail if that state changed by even one pixel. **A new state or a new view ships
with its fixture scenario and screenshots in the same pull request, and a row in
this file.** Screenshots are recorded for Windows (`-win32`, run locally) and
Linux (`-linux`, run in CI; see "Refreshing baselines" below).

Widths: phone 360, phone 390, tablet 700, desktop 1280 (the Slate also 900).
Themes: day at every width; night at 390 and 1280 only. Fixed sample data,
fictional names, a frozen clock, and every `/api/*` call answered from fixtures.

## Slate (`/board`) — `test/visual/slate.visual.spec.ts`, fixtures `slate-fixtures.mjs`

| State | Scenario |
| --- | --- |
| Week not started, nothing picked, Survivor open | `upcoming-unpicked` |
| Picks saved, Survivor chosen | `upcoming-picked` |
| Pick'em only (no Survivor) | `upcoming-no-survivor` |
| Games live, Survivor | `live-survivor` |
| Games live, no Survivor | `live-no-survivor` |
| Week complete, Survivor | `complete-survivor` |
| Week complete, no Survivor | `complete-no-survivor` |
| Playoff round open | `playoff-upcoming` |
| Playoff round, six picks | `playoff-six-picks` |
| Playoff games live | `playoff-live` |

## Standings (`/`) — `standings.visual.spec.ts`, fixtures `standings-fixtures.mjs`

| State | Scenario |
| --- | --- |
| Viewer still in Survivor (two-column ticket) | `regular-in` |
| Viewer eliminated (one-column ticket) | `regular-out` |
| Eliminated rows hidden, Bowl Card open | `regular-hidden-rows` |
| Survivor has a champion | `regular-complete` |
| Wild Card, six picks | `playoff-wildcard` |
| Divisional, four picks | `playoff-divisional` |
| Commissioner: pad flips to Season Snapshot | `commissioner` (+ flipped shots) |
| Bowl Card with graded results | `bowl-results` |
| Bowl Card with a champion crowned | `bowl-champion` |
| Viewer not joined, entry open ("Claim your seat") | `bowl-claim-open` |
| Not joined, entry closed | `bowl-closed-not-joined` |
| Bowl Card minimized | `bowl-minimized` |

Night mode: `regular-in`, `playoff-wildcard`, `commissioner`, `bowl-results`, `bowl-claim-open`.

## Bowl picks (`/bowl-pool`) — `bowl.visual.spec.ts`

| State | Scenario |
| --- | --- |
| Entry open, not joined | `not-joined` |
| Some picks made | `picked` |
| Two games kicked off (locked buttons) | `games-started` |
| Everything picked, tiebreaker saved | `complete-saved` |
| A team chosen, not yet submitted | `unsaved-change` |
| Not a participant, first kickoff passed | `entry-closed` |

## Commissioner desk (`/admin`, `/admin/players`, `/admin/reminders`) — `commissioner.visual.spec.ts`, fixtures `commissioner-fixtures.mjs`

| View | States |
| --- | --- |
| Overview | `healthy` (game day), `attention` (failed score sync, open incident), `quiet` (off-week) |
| Grading (Activity log open) | `healthy`, `attention`, `quiet` |
| Game day (checks open) | `healthy` |
| Bowl Pool | `healthy`, `attention` (missing teams/lines, schedule change) |
| Season | `healthy` |
| System (health and alerts open) | `healthy`, `attention` |
| Players | one roster: commissioner, active, inactive, never signed in |
| Reminders | scheduled, sent, cancelled-with-reason |

The test coin (`ChipPlayground`) appears in the desk header at rest; its toss is
covered by `test/chip-toss-contract.test.mjs`.

## Account pages — `account.visual.spec.ts`

| View | States |
| --- | --- |
| Login | signed out |
| Notifications (`/profile`) | `profile-default`, `profile-custom` (fine-tune open) |
| Week Archive | `archive` (four weeks), `archive-empty` |
| Rehearsal preview (`/preview`) | default |
| `/survivor` | redirects to `/board#slate-matchups`; no screen of its own |

## Email images — `test/email-artwork-baseline.test.mjs`

Every category × image kind × density from `emailArtworkSample` (weekly and
playoff recaps, Sunday early/late reveals with Survivor, featured and playoff
reveals, Slate, final lines, early lock, Bowl results and lines) is compared
pixel for pixel with `test/email-artwork-baselines/<platform>/`.

## Refreshing baselines after an intended change

1. Run locally, look at the diff images in `test-results/`, then record Windows:
   `npm run test:visual -- -u` and `EMAIL_BASELINE_UPDATE=1 npm test -- --test-name-pattern="email artwork baseline"`.
2. Record Linux: `gh workflow run visual-baselines.yml --ref <branch>`, wait for
   it, `gh run download <id> -n linux-baselines`, and commit the `*-linux.png`
   files and `test/email-artwork-baselines/linux/`.
3. Never re-record to make an unexpected diff go away.
