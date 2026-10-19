# View states and their screenshots

Every view the app renders, every state it can be in, and the test that would
fail if that state changed by even one pixel. **A new state or a new view ships
with its fixture scenario and screenshots in the same pull request, and a row in
this file.** Only the Linux screenshots (`-linux`, recorded and checked in CI; see "Refreshing
baselines" below) are committed. Local runs use personal, untracked baselines.

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
| Off-season: "See you next season!" banner instead of the receipt, read-only, no how-to copy | `off-season` |
| Eliminated from the playoff race mid-playoffs: same banner, no receipt | `playoff-eliminated` |
| Forfeited the playoffs: "You forfeited, thanks for playing." banner, no receipt | `playoff-forfeited` |
| The Forfeit link at the foot of every playoff Slate (`playoff-upcoming`, `playoff-six-picks`, `playoff-live`), and its three questions, one at a time | `forfeit-step-1/2/3-phone-390` (behavior test in `slate-flow.visual.spec.ts`; the link is absent from regular weeks, forfeited, eliminated and off-season Slates) |

## Standings (`/`) — `standings.visual.spec.ts`, fixtures `standings-fixtures.mjs`

| State | Scenario |
| --- | --- |
| Viewer still in Survivor (two-column ticket) | `regular-in` |
| Viewer eliminated (one-column ticket) | `regular-out` |
| Eliminated rows hidden, Bowl Card open | `regular-hidden-rows` |
| Survivor has a champion | `regular-complete` |
| Wild Card, six picks | `playoff-wildcard` |
| Divisional, four picks | `playoff-divisional` |
| Off-season: banner instead of the ticket, every table whole (hidden choices suspended), no hide or "− OUT" buttons | `off-season` |
| Viewer eliminated from the playoff race mid-playoffs: banner instead of the ticket | `playoff-viewer-out` |
| Viewer forfeited the playoffs: banner instead of the ticket, FORFEITED stamp on their row (every playoff state also shows one other player's stamp) | `playoff-viewer-forfeited` |
| Season Snapshot in the playoffs: a Season / Playoffs switch beside the title (opens on Playoffs); Season shows the 6 Wk / All range | `commissioner-playoff` (flipped, both halves) |
| Commissioner: pad flips to Season Snapshot | `commissioner` (+ flipped shots) |
| Bowl Card with graded results | `bowl-results` |
| Bowl Card with a champion crowned | `bowl-champion` |
| Viewer not joined, entry open ("Claim your seat") | `bowl-claim-open` |
| Not joined, entry closed | `bowl-closed-not-joined` |
| Bowl Card minimized | `bowl-minimized` |

Night mode: `regular-in`, `playoff-wildcard`, `commissioner`, `bowl-results`, `bowl-claim-open`, `off-season`.

## Bowl picks (`/bowl-pool`) — `bowl.visual.spec.ts`

| State | Scenario |
| --- | --- |
| Loading (the Bowl Pool still arriving: spinning football alone) | phone |
| Entry open, not joined | `not-joined` |
| Some picks made | `picked` |
| Two games kicked off (locked buttons) | `games-started` |
| Everything picked, tiebreaker saved | `complete-saved` |
| A team chosen, not yet submitted | `unsaved-change` |
| Not a participant, first kickoff passed | `entry-closed` |

## Commissioner desk (`/admin`, `/admin/players`, `/admin/reminders`; the Trophy Room at `/trophy-room` is shot here too) — `commissioner.visual.spec.ts`, fixtures `commissioner-fixtures.mjs`

| View | States |
| --- | --- |
| Today (map, game pipeline, key counts, and the repair/health drawers, closed) | `healthy` (game day), `attention` (failed score sync, open incident), `quiet` (off-week) |
| Performance (Pick'em performance with a League / player dropdown, provider cost, polling, capacity) | `healthy` |
| Provider cost chart (Performance: credits per game as 15- and 30-day moving averages) | `healthy`, phone and desktop |
| Polling chart (Performance → New game finals by polling rung: percentages, first nine windows, emergency-window count) | `healthy`, phone and desktop |
| Season | `healthy` |
| Bowl Pool | `healthy`, `attention` (missing teams/lines, schedule change) |
| Workshop (every custom piece, live: submit button, pick highlight, chips, pennants, split-flap tiles, loading football, result stamps, Bowl crest, season-closed banners) | `healthy`; animations are captured at rest |
| Five tabs, with the repair and health drawers on Today (behavior test) | `healthy` |
| Workshop pieces respond to hands: football pause, scrub and step; reset to live; copy settings; typed words; all 32 chip teams (behavior test) | `healthy` |
| Players | one roster: commissioner, active, inactive, never signed in, and one player who forfeited the playoffs (tag and Reinstate) |
| Reminders | scheduled, sent, cancelled-with-reason |
| Trophy room (the three trophies on the turning table with one banner per champion of the front trophy under it, carrying every year they won; all-time record with Wins and Hit rate, an under-50-picks group, and a champion with no pick history) | `healthy`, phone, tablet and desktop, day and night |
| Name menu: a Trophy Room link between the name and Notifications for whoever the Trophy Room is open to (today the Commissioner); absent for a player (behavior test, `slate-flow.visual.spec.ts`) | the Slate |
| Trophy Room while it is the Commissioner's alone: a player who goes to its address is told it is not open yet (behavior test) | `/trophy-room` |
| Trophy room table: each player's streaks as now / best, under a Streaks heading (1+ win, 2-0), dashes for a player with none (behavior test) | `healthy` |
| Performance dropdown: the league first, then choosing a player swaps every figure, the most picked team and the Season by season table (behavior test) | `healthy` |
| Trophy room sorting: Wins and Hit rate sort independently, and a second tap reverses (behavior test) | `healthy` |

## Account pages — `account.visual.spec.ts`

| View | States |
| --- | --- |
| Loading screen before sign-in is known (site heading with the tabs already in place and usable, centered; football) | phone and desktop |
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

1. Locally, first record baselines from `main` (`npm run test:visual -- -u`, ignored by git),
   apply the change, rerun without `-u`, and look at the diff images in `test-results/`.
   Email artwork (its Windows PNGs stay committed): `EMAIL_BASELINE_UPDATE=1 npm test -- --test-name-pattern="email artwork baseline"`.
2. Record Linux: `gh workflow run visual-baselines.yml --ref <branch>`, wait for
   it, `gh run download <id> -n linux-baselines`, and commit the `*-linux.png`
   files and `test/email-artwork-baselines/linux/`.
3. Never re-record to make an unexpected diff go away.

## Pull down to refresh (the app on a home screen) — `pull-to-refresh.visual.spec.ts`

Only runs when the page is opened from the home screen (the test marks the page as installed). Two tests: pulling past the threshold shows the first-down chain zoomed in on its last three yards across the whole page width (deep turf with hash marks, the chain running in from the left edge, the bottom third of the lead pole planted at a spotted football whose tip pokes out a couple of inches past its foot, the chain taut) and "Release to refresh" (screenshot of the full-width indicator) and letting go reloads the page (the drawing's geometry is unit-tested in `test/pull-chain.test.mjs`); a short pull springs back and nothing reloads.

## Trophy Room turntable (`/trophy-room`) — `trophy-turntable.visual.spec.ts`

Behavior tests: the arrows bring the next or previous trophy to the front and its champions hang from the rafters as banners (the screen-reader status and the banners' pool follow); the banners lift away while the table turns and drop in (the `trophy-banner-unfurl` animation) when it settles; dragging turns the table, a short slow drag springs back, and a long drag settles on the next trophy. One screenshot: the table and banners at rest with the Bowl Pool at the front.
