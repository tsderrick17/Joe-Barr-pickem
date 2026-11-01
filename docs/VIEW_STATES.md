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
| Season Snapshot, Season half, 6 Wk range (fourteen weeks, so the chart scrolls and the axis fits the latest six, starting above zero): the position rail along the top of the plot, above every line, in the pad's own colors, with the browser's scroll bar hidden; the browser is launched with scroll bars drawn so one returning would show; behavior tests drag the rail, press its track, and scroll back to watch the axis glide to zero on the same tick spacing (`season-snapshot-flow.visual.spec.ts`) | `commissioner-playoff` (`flipped-sixweek`, the chart only, day and night, phone-390 and desktop-1280) |
| Commissioner: pad flips to Season Snapshot | `commissioner` (+ flipped shots) |
| Bowl Card with graded results | `bowl-results` |
| Bowl Card with a champion crowned | `bowl-champion` |
| Viewer not joined, entry open ("Claim your seat") | `bowl-claim-open` |
| Not joined, entry closed | `bowl-closed-not-joined` |
| Bowl Card the morning the pool opens: the viewer alone in it with a zero score tile and no picks yet | `bowl-just-joined` |
| Bowl Card with a postponed and a cancelled game: the word stands where the line would be (black, not teal), the cancelled game counts as played, and the viewer's kept pick still shows | `bowl-disrupted` |
| Bowl Card with a game that kicked off seven hours ago and has no final yet: "Final score pending" stands where the line would be (black, not teal), and the other games are as usual | `bowl-final-pending` |
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
| A postponed and a cancelled game with the picks kept (the word replaces the venue and the buttons are locked), a game with no announced time ("Time TBD") and a preliminary line (black, not teal) | `disrupted` |
| A game that kicked off the day before and has no final yet ("Final score pending" replaces the venue, the picks stay locked), beside a final game | `final-pending` |
| Not a participant, first kickoff passed | `entry-closed` |

## Commissioner desk (`/admin`, `/admin/players`, `/admin/reminders`; the Trophy Room at `/trophy-room` is shot here too) — `commissioner.visual.spec.ts`, fixtures `commissioner-fixtures.mjs`

| View | States |
| --- | --- |
| Today (map, game pipeline, key counts, and the repair/health drawers, closed; the map's connecting lines are dark between stages that have been reached (complete or in progress); Participant impact says Survivor is over with its winner once a Survivor champion is recorded; "Up next" has kickoff, line lock and score sync only, and "Next message" sits under "Notification readiness") | `healthy` (game day), `attention` (failed score sync, open incident), `quiet` (off-week; Survivor over) |
| Performance (Pick'em performance with a League / player dropdown: no league streak boards, no neutral-site row, and a tie for the most picked team says how many teams tie; teams, splits and seasons side by side at one height, the splits one plain list (Favorites, Underdogs, Home, Away); provider cost, polling, capacity) | `healthy` |
| Provider cost chart (Performance: credits per game as 15- and 30-day moving averages) | `healthy`, phone and desktop |
| Polling chart (Performance → New game finals by polling rung: percentages, first nine windows, emergency-window count) | `healthy`, phone and desktop |
| Season | `healthy` |
| Bowl Pool (readiness; "Bowl Pool lines" with its "Every game that is due has its line" note when none are missing, and in `attention` a scheduled game and a final game with no line, each with a favorite choice, a spread box and Set line; exceptions with the game chooser, and in `attention` a postponed game with its date, time and Reschedule beside a cancelled one) | `healthy`, `attention` (missing teams/lines, schedule change, a game cancelled automatically because ESPN lists it as cancelled, shown with its reason) |
| Workshop board, full screen at `/admin/workshop` (every custom piece on one endless board: submit button, pick highlight, chip, megaphone, games remaining tile, player wins tile, loading football, result stamp, Bowl crest, the two season-closed banners, the pull-to-refresh strip, and the Pick'em, Bowl Pool and Survivor trophy banners; Desk, Menu, zoom and Home at the edges; the first-visit hint) | at rest, and with the football's settings panel open (right side on a computer, bottom sheet on a phone); phone and desktop, day and night; the lower rows (pull-to-refresh strip and the three banners) on desktop, day and night; animations are captured at rest |
| Five tabs, with the repair and health drawers on Today (behavior test) | `healthy` |
| Automation → Recent warnings under the watchdog's incidents: "No warnings this week" when there are none; in `attention` two warnings, each with its wording, the details (games or a game id), the job, how many times it was seen and when it was last seen | `commissioner-watchdog-warnings`: `quiet` by day, `attention` by day and by night, each at phone and desktop (the panel alone; the Today shots keep their drawers folded) |
| Fix something → Game Exceptions → "Enter a verified final · last resort" (only when an NFL game is still not final more than three days after kickoff): the warning wording, the game chooser, both team score boxes, "Where you checked it" and the red Save verified final button | `commissioner-last-resort-final`: filled in, by day and by night, each at phone and desktop (the block alone); a flow test checks the confirmation question, the saved body and the "graded" message |
| Workshop board behaviour (`workshop.visual.spec.ts`): the board moves without end (drag, scroll, arrow keys, zoom, Home) and always covers the screen; a tap plays one copy, a drag does not; settings hidden until tune, then football pause, frame and step, Live values, Your settings and its count, Escape, typed words on every copy, 32 chip teams; remembered on the device and a damaged save ignored; Show names, Night, Desk; the desk's Workshop tab; the two split-flap cards tuned separately; the pull-to-refresh strip (slide by hand, tap for a whole pull); banner words and colour; easing choices; zoom in tile; Play everything; a damaged save ignored value by value | `healthy` |
| Players (add form beside the roster; a figures strip, who has not visited in 7 days, Name / Last seen order, and a compact card per player: name, PIN and the emails, app and notifications markers on one line from 560px wide, then last seen, days this week and last device on one line; the markers wrap under the name on a phone) | one roster: commissioner, active, inactive, never signed in, one player with the app and notifications on, and one who forfeited the playoffs (tag and Reinstate); phone and desktop, day and night |
| Reminders | scheduled, sent, cancelled-with-reason |
| Reminders, email image studio open on the Bowl Pool opening announcement (the subject and the phone message are fixed words, not edit boxes; Save and "Use default wording" are gone; "Send this to my email and phone" sits beside Refresh preview) | `bowl-message`, phone and desktop, day and night |
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
| Rehearsal preview (`/preview`, Commissioner only) | `preview` (as the Commissioner), `preview-player` (a signed-in player sees "Commissioner only" and a link back to the Standings) |
| Rehearsal walk-through: the six scenarios in all four views, who may open it, and the team-lane and sideways-scroll guards (behavior tests, `rehearsal-walkthrough.visual.spec.ts`; no screenshots) | `/preview` |
| Email plans on Notifications: Essentials, Regular and Full Card set the playoff toggles (behavior test, `email-plans.visual.spec.ts`; no screenshots) | `/profile` |
| "Notifications on this phone" on Notifications (every player): `off`, `on`, `blocked`, `iphone-tab` (an iPhone browser tab, told to add the app to the Home Screen) and `no-support`, day at phone and desktop width, plus `on` at night; behavior tests follow the taps (turn on: permission, key, save; test; turn off) and show the section to a player who is not the Commissioner too (`phone-notifications.visual.spec.ts`) | `/profile` |
| In-app "Turn on notifications" banner (Home Screen app, signed in, notifications not on yet): `offer` day at phone and desktop, night at phone, and `on` after one tap; behavior tests: one tap asks the phone and saves it, a "no" says where to turn them on later, Not now keeps it away after reopening, and no banner in a browser tab, when already on, when blocked, on Notifications, or before sign-in (`notifications-banner.visual.spec.ts`) | any page in the app |
| Feel test (Commissioner only, Notifications): one button per feel, the pretend pull and, on an iPhone, a plain switch to compare; as it reads on an Android phone (day and night) and on an iPhone; behavior tests: each Android button vibrates its own pattern, on an iPhone the finger lands on the hidden switch laid over Tick, Light tick and Lock-in (one tick a tap, the button answers once, none for success and warning, none during the pull), Android gets no hidden switch, the pretend pull notches and locks in, a computer does nothing, and a player never sees it (`haptic-feel-test.visual.spec.ts`) | `/profile` as the Commissioner |
| Haptics where players tap (no screenshots: nothing visible changes); behavior tests: the Notifications page has no switch to turn vibration off on any device, its choices buzz on Android and carry the tick layer on an iPhone (tick boxes are the phone's own switch), a phone that turned the old switch off still buzzes and ticks, and the Slate gives its feels on Android (pick, take back, Submit, success, failed save), one tick per tap on an iPhone (the pick and the save still happen), and a wrong PIN warns | `haptics-rollout.visual.spec.ts` |
| "Add to Home Screen" for every player on a phone: the slim navy and gold banner under the header of every page (`iphone-safari` collapsed and with the steps open; steps open for `iphone-chrome`, `iphone-facebook` (sent to Safari, Copy link), `android-chrome` and `android-samsung`; `android-prompt` with one-tap Install; phone 360 and 390, plus the Safari steps at night) and the card on Notifications (`iphone-safari`, `iphone-chrome`, `iphone-facebook`, `android-prompt`, `android-chrome`, `android-installed` (a Chrome tab on a phone that has the app), `installed`; phone 360 and 390, plus Safari at night); on a Chromebook (desktop 1280) the banner and card with one-click Install and with the steps open. The browser is scripted as each phone and browser. Behavior tests: every phone and browser is recognised; a full Chromium finds the app installable (and proves it notices a page that is not); a computer sees neither; the installed app and a phone known to have it see no banner; Firefox on Android remembers the app was opened before, and Chrome's own answer wins; the banner still shows if Android never answers whether the app is installed; Show me how opens the steps and leaves the ✕ as the only button; Android turns from steps into one-tap Install when the browser offers it, asks once, and hides once installed; Copy link; Not now (14 days) survives a reload (`home-screen.visual.spec.ts`) | every page (banner), `/profile` (card) |
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

Behavior tests: the arrows bring the next or previous trophy to the front and its champions hang from the rafters as banners (the screen-reader status and the banners' pool follow); the banners lift away while the table turns and drop in (the `trophy-banner-unfurl` animation) when it settles, are drawn on a canvas at full device resolution (sharp, with one smooth curve down each edge) and hold still while the table turns; only the arrows turn it (a drag across the table does nothing); while the champions are still loading the rafters stay bare, with no "No champion yet". One screenshot: the table and banners at rest with the Bowl Pool at the front.
