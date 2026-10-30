# View states and their screenshots

Every view the app renders, every state it can be in, and the test that would
fail if that state changed by even one pixel. **A new state or a new view ships
with its fixture scenario and screenshots in the same pull request, and a row in
this file.** Only the Linux screenshots (`-linux`, recorded and checked in CI; see "Refreshing
baselines" below) are committed. Local runs use personal, untracked baselines.

Widths: phone 360, phone 390, tablet 700, desktop 1280 (the Slate also 900). The Commissioner desk is shot at phone 390 and desktop 1280 only, day and night; its tablet-width layout is held by the "tables fit their cards" behavior tests.
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
| Night mode Slate: official (teal) lines and chips are readable on the dark rows; every one is checked to 4.5:1 contrast (behavior test) | `night-upcoming-picked`, `night-live-survivor`, phone 390 and desktop 1280 |
| The Forfeit link at the foot of every playoff Slate (`playoff-upcoming`, `playoff-six-picks`, `playoff-live`), and its three questions, one at a time | `forfeit-step-1/2/3-phone-390` (behavior test in `slate-flow.visual.spec.ts`; the link is absent from regular weeks, forfeited, eliminated and off-season Slates) |

## Standings (`/`) — `standings.visual.spec.ts`, fixtures `standings-fixtures.mjs`

| State | Scenario |
| --- | --- |
| Viewer still in Survivor (two-column ticket) | `regular-in` |
| Viewer eliminated (one-column ticket) | `regular-out` |
| Eliminated rows hidden, Bowl Card open | `regular-hidden-rows` |
| Survivor has a champion (the champion's row reads WON in the Survivor table) | `regular-complete` |
| Survivor has a champion and the viewer is that champion (entry still active): Pick'em-only ticket owing two selections, not three (behavior test and screenshot) | `regular-complete-champion` |
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
| Display choices (hide the Survivor Table): shown at once, not undone by a refresh that lands while the save is out, a second tap ignored while saving, a failed save puts the old choice back (behavior tests, `display-preference.visual.spec.ts`) | `regular-in` |
| The page waits behind the loading shell for the Bowl Card's first load, shown anyway after 2.5 seconds, and at once when the card answers (behavior tests, `display-preference.visual.spec.ts`, frozen clock) | `regular-in` |
| The Survivor Table and Bowl Card are the page colour behind their rows, so pulling them sideways past their edge on a phone shows the page, not a paler panel (behavior test, `table-edges.visual.spec.ts`, day and night at phone width); on a touch screen both tables also leave a clear strip under the last row for the scroll indicator (same test, touch emulation); a long game name ("National Championship") stays inside its Bowl Card column at 360, 390 and 700px (same file) | `bowl-results` |

Night mode: `regular-in`, `playoff-wildcard`, `commissioner`, `bowl-results`, `bowl-claim-open`, `off-season`.

## Pool chat (the box at the foot of every player page) — `chat.visual.spec.ts`

Shot as the chat element alone, at phone 390 and desktop 1280, day and night. Four messages: an ordinary one, the Commissioner's (moderator bar), a removed one, and one you can delete. At night the player names are light blue and the moderator bar and MOD tag gold.

| State | Screenshot |
| --- | --- |
| Open, message field empty | `chat-{day,night}-{phone-390,desktop-1280}` |
| Emoji picker open (the emoji pictures are masked; their places are checked) | `chat-emoji-…` |
| Message field focused with a draft typed | `chat-typing-…` |

## Bowl picks (`/bowl-pool`) — `bowl.visual.spec.ts`

| State | Scenario |
| --- | --- |
| Loading (the Bowl Pool still arriving: spinning football alone) | phone |
| Entry open, not joined | `not-joined` |
| Some picks made (one one-line school, Troy, and two two-line schools, Georgia Southern and Ohio State, so the megaphone lettering is checked both ways) | `picked` |
| Two games kicked off (locked buttons) | `games-started` |
| Everything picked, tiebreaker saved | `complete-saved` |
| A team chosen, not yet submitted | `unsaved-change` |
| Not a participant, first kickoff passed | `entry-closed` |

## Commissioner desk (`/admin`, `/admin/players`, `/admin/reminders`; the Trophy Room at `/trophy-room` is shot here too) — `commissioner.visual.spec.ts`, fixtures `commissioner-fixtures.mjs`

| View | States |
| --- | --- |
| Today (map, game pipeline, key counts, and the repair/health drawers, closed; the map's connecting lines are dark between stages that have been reached (complete or in progress); Participant impact says Survivor is over with its winner once a Survivor champion is recorded; "Up next" has kickoff, line lock and score sync only, and "Next message" sits under "Notification readiness") | `healthy` (game day), `attention` (failed score sync, open incident), `quiet` (off-week; Survivor over) |
| Performance (Pick'em performance with a League / player dropdown: no league streak boards, no neutral-site row, and a tie for the most picked team says how many teams tie; teams, splits and seasons side by side at one height, the splits one plain list (Favorites, Underdogs, Home, Away); provider cost, polling, capacity) | `healthy` |
| Provider cost chart (Performance: credits per game as 15- and 30-day moving averages) | `healthy`, phone and desktop |
| Polling chart (Performance → New game finals by polling rung: percentages, first nine windows, emergency-window count) | `healthy`, phone and desktop |
| Season | `healthy` |
| Bowl Pool | `healthy`, `attention` (missing teams/lines, schedule change) |
| Workshop (every custom piece, live: submit button, pick highlight, chips, megaphones, split-flap tiles, loading football, result stamps, Bowl crest, season-closed banners) | `healthy`; animations are captured at rest |
| Five tabs, with the repair and health drawers on Today (behavior test) | `healthy` |
| Workshop pieces respond to hands: football pause, scrub and step; reset to live; copy settings; typed words; all 32 chip teams (behavior test) | `healthy` |
| Players | one roster: commissioner, active, inactive, never signed in, and one player who forfeited the playoffs (tag and Reinstate) |
| Reminders | scheduled, sent, cancelled-with-reason |
| Trophy room (the three trophies on the turning table with one banner per champion of the front trophy under it, carrying every year they won, in cloth (red for Pick'em, blue for the Bowl Pool, green for Survivor); the All-Time Table (Wins and Hit rate, and a champion with no pick history)) | `healthy`, phone, tablet and desktop, day and night |
| Slate display switch (All games / Pool action): two equal halves, and tapping either half flips to the other option (behavior test, `slate-flow.visual.spec.ts`) | `upcoming-unpicked`, phone |
| Bowl Pool player flow: claim a seat (the selection card appears), choose a team (the receipt says changed), submit (saved), opt out (the claim card returns) (behavior test, `bowl-flow.visual.spec.ts`) | `not-joined`, phone |
| Standings and Slate load failures: a hung or failed first load is retried once by itself (no error shown); two failures show the error with Try again; coming back to the tab reloads at once (behavior tests, `load-retry.visual.spec.ts`) | `commissioner-playoff` and `upcoming-unpicked`, phone |
| Name menu: a Trophy Room link between the name and Notifications for whoever the Trophy Room is open to (today the Commissioner); absent for a player (behavior test, `slate-flow.visual.spec.ts`) | the Slate |
| Trophy Room while closed to a player (it opened 2026-10-23; the state remains if the opening is ever unscheduled): a player who goes to its address is told it is not open yet (behavior test) | `/trophy-room` |
| Trophy room All-Time Table with a two-way switch (two equal halves; tapping either flips to the other view) between two views: Record (Wins, Hit rate and Perfect Weeks, how many 2-0 weeks in all; sortable, ties share a place such as T1), and Other Stats (no places, players A to Z until a column is chosen, Player sortable; Shutout Free Weeks in a Row and Perfect Weeks in a Row as the best run big with "now N" small and no colour, star or bar; games decided by a half point, wins, losses and hit rate; pushes picked, labelled in the lower row of headings; every column sortable with ties sharing a place); a champion with no pick history shows dashes (behavior tests; screenshot of the second view) | `healthy` |
| Performance dropdown: the league first (with its own Season by season table), then choosing a player swaps every figure, the most picked team and the Season by season table; the Picked and Hit rate headers of the teams table switch it between the five most picked and the five best hit rate (behavior test) | `healthy` |
| Trophy room sorting: Wins and Hit rate sort independently, and a second tap reverses (behavior test) | `healthy` |

## Account pages — `account.visual.spec.ts`

| View | States |
| --- | --- |
| Loading screen before sign-in is known (site heading with the tabs already in place and usable, centered; football) | phone and desktop |
| Login | signed out |
| Notifications (`/profile`) | `profile-default`, `profile-custom` (fine-tune open) |
| Week Archive | `archive` (four weeks), `archive-empty` |
| Rehearsal preview (`/preview`) | default |
| Rehearsal walk-through: the six scenarios in all four views (behavior test, `rehearsal-walkthrough.visual.spec.ts`; no screenshots) | `/preview` |
| Email plans on Notifications: Essentials, Regular and Full Card set the playoff toggles (behavior test, `email-plans.visual.spec.ts`; no screenshots) | `/profile` |
| "Notifications on this phone" on Notifications (every player): `off`, `on`, `blocked`, `iphone-tab` (an iPhone browser tab, told to add the app to the Home Screen) and `no-support`, day at phone and desktop width, plus `on` at night; behavior tests follow the taps (turn on: permission, key, save; test; turn off) and show the section to a player who is not the Commissioner too (`phone-notifications.visual.spec.ts`) | `/profile` |
| In-app "Turn on notifications" banner (Home Screen app, signed in, notifications not on yet): `offer` day at phone and desktop, night at phone, and `on` after one tap; behavior tests: one tap asks the phone and saves it, a "no" says where to turn them on later, Not now keeps it away after reopening, and no banner in a browser tab, when already on, when blocked, on Notifications, or before sign-in (`notifications-banner.visual.spec.ts`) | any page in the app |
| "Add to Home Screen" for every player on a phone: the slim navy and gold banner under the header of every page (`iphone-safari` collapsed and with the steps open; steps open for `iphone-chrome`, `iphone-facebook` (sent to Safari, Copy link), `android-chrome` and `android-samsung`; `android-prompt` with one-tap Install; phone 360 and 390, plus the Safari steps at night) and the card on Notifications (`iphone-safari`, `iphone-chrome`, `iphone-facebook`, `android-prompt`, `android-chrome`, `android-installed` (a Chrome tab on a phone that has the app), `installed`; phone 360 and 390, plus Safari at night); on a Chromebook (desktop 1280) the banner and card with one-click Install and with the steps open. The browser is scripted as each phone and browser. Behavior tests: every phone and browser is recognised; a full Chromium finds the app installable (and proves it notices a page that is not); a computer sees neither; the installed app and a phone known to have it see no banner; Firefox on Android remembers the app was opened before, and Chrome's own answer wins; the banner still shows if Android never answers whether the app is installed; Show me how opens and closes; Android turns from steps into one-tap Install when the browser offers it, asks once, and hides once installed; Copy link; Not now (14 days) and I already have it (180 days) survive a reload (`home-screen.visual.spec.ts`) | every page (banner), `/profile` (card) |
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

Only runs when the page is opened from the home screen (the test marks the page as installed and counts haptic buzzes). The pull has two stages and the screenshots take the header at each: slack (a tenth of the way: the pole is drawn out leaning, the chain slack in humps on the turf), stretched (a quarter of the way: the chain pulled to its full length, taut and climbing about 2 degrees: its far end is ten yards back, far off the page, the pole still leaning; it gives one slight boing), dropping (three eighths: the pole's foot leads down, straightening), landed (halfway: the foot upright beside the spotted football with the dust puff, planted and still, no squash, bounce or swing; the distant down counter, larger now with six thick slats instead of twelve thin ones, still on 4). The field has alternate five-yard bands mowed darker, a darker far side, white yard lines, hash marks and a sideline at each edge; the red flag on the chain is a simple marker through the chain that hangs straight down from the middle of a link, counter halfway (three quarters: the counter's slats read 1, 4, 1, 4), and ready (the counter fully on 1, "Release to refresh", exactly one buzz). Behavior: letting go with the counter on 1 covers the page with the loading football and reloads; a short pull springs back without reloading; if the page never hears the finger lift, everything clears itself and nothing reloads.

## Trophy Room turntable (`/trophy-room`) — `trophy-turntable.visual.spec.ts`

Behavior tests: the arrows bring the next or previous trophy to the front and its champions hang from the rafters as banners (the screen-reader status and the banners' pool follow); the banners lift away while the table turns and drop in (the `trophy-banner-unfurl` animation) when it settles, are drawn on a canvas at full device resolution (sharp, with one smooth curve down each edge) and hold still while the table turns; dragging turns the table, a short slow drag springs back, and a long drag settles on the next trophy. One screenshot: the table and banners at rest with the Bowl Pool at the front.
