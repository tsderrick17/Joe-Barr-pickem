# Durable decision log

This log records project rules that future changes must not casually reverse.
Entries preserve the original reasoning; a later change marks an older detail
as superseded and records the current contract rather than rewriting history.

## 2026-10-30 - Uptime probes reach a function less often

The probes were 36% of Vercel CPU on 2026-10-30: the three worker probes ran about 100 times each in 12 hours despite a 10-minute CDN window, because the CDN keeps a copy per region and the monitors check from several places. Each worker probe now keeps a healthy answer for its own grace window: line locks 10 minutes (12-minute grace, unchanged), reminders 15 (20-minute grace), scores 25 (45-minute grace). The slow monitors are checked less often in UptimeRobot (automation 15 minutes, settlement and Bowl Pool 30, backup 60); that setting lives in UptimeRobot, not in code. A failing answer is still never cached, and the core `/api/health` probe still runs live every time.

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

## 2026-08-09 — REF-001 — Layer project guidance

**Status:** Accepted

Keep short mandatory instructions in the repository root `AGENTS.md`. Keep the
detailed product/system contract in `docs/PROJECT_REFERENCE.md`, route human
procedures through `docs/SOP_INDEX.md`, and preserve reasons here. This keeps
the always-loaded instruction set focused while making deeper context durable.

## 2026-08-09 — REF-002 — Preserve history; start new seasons blank

**Status:** Accepted

Annual rollover copies the scoring-period template only. Historical games,
picks, scores, player results, Survivor records, championships, and audit logs
remain attached to their original season and are never copied into the new one.

## 2026-08-09 — REF-003 — Pin every game to its original pool week

**Status:** Accepted

An NFL schedule change may move an unlocked game's time, including across a
calendar boundary, but cannot change its original scoring period or gameweek.
Database constraints backstop application reconciliation. Ambiguous, locked,
settled, re-paired, or cross-period changes go to review.

## 2026-08-09 - REF-004 - Treat provider omission as incomplete input

**Status:** Accepted for omission safety; the fixed 272-game import requirement
was superseded by the 2026-10-02 season-length decision below.

A partial schedule feed cannot delete saved games. The initial full-season
import requires exactly 272 validated regular-season games; in-season refreshes
report missing events and continue applying unrelated safe corrections.

## 2026-08-09 — REF-005 — Use immutable Eastern day-start playoff eligibility

**Status:** Accepted

Playoff eligibility is calculated once at the start of each Eastern game day.
A player who could tie the leader at that moment may compete in every eligible
game that day. Later same-day results do not retroactively remove eligibility.
When a future day finds the player mathematically out, affected pending picks
are voided rather than graded as losses.

## 2026-08-09 — REF-006 — Separate recap timing from default-week handoff

**Status:** Accepted

The major recap becomes eligible Tuesday at 6:30 AM Eastern after accurate
settlement. The default week normally changes Wednesday at 3:00 AM Eastern and
at least 24 hours after the prior week settled. The next week can be selected
manually on the next Eastern day, and all completed weeks remain accessible.

## 2026-08-09 — REF-007 — Keep schedule and scoring automation fail-closed

**Status:** Accepted

Imports validate before writes; scoring consumes verified finals; period
completion requires every applicable record to settle. Missing lines, pending
grades, disruption reviews, malformed schedules, and unsafe moves block only
the affected transition instead of guessing or rewriting history.

## 2026-08-09 — REF-008 — Make manual controls guarded recovery paths

**Status:** Accepted

Commissioner controls call the same underlying functions as scheduled jobs and
retain authentication, execution leases, quota reserve, gameweek pins, audit,
and atomicity. An emergency button may bypass a cooldown clock but not an
integrity rule.

## 2026-08-09 — REF-009 — Alert only on actionable incidents

**Status:** Accepted

The watchdog opens a deduplicated incident for missing locked lines, stale due
scoring, stuck scheduled messages, an overdue incomplete season schedule, or a
missing production automation prerequisite. Intentional cooldowns and isolated
recipient failures do not produce commissioner incidents.

## 2026-08-09 - REF-010 - Protect provider and compute allowance

**Status:** Accepted for quota protection; the earlier exponential score
cooldown was superseded by the fixed retry ladder and ten-minute worker schedule.

Score checks use per-game exponential cooldown through six hours. Schedule
refresh failures use a shared circuit breaker, scheduled/manual paths share
leases, and low allowance preserves credits for line integrity. Repeat clicks
must not create overlapping or unbounded provider work.

## 2026-08-09 — REF-011 — Use timestamped migrations after cutover

**Status:** Accepted

The root-level numbered SQL files are immutable historical evidence. Every new
database change is a timestamped file under `supabase/migrations/`, rehearsed
against isolated-test, and deployed through the guarded migration workflow.

## 2026-08-09 — REF-012 — Rehearse full seasons outside production

**Status:** Accepted

Lifecycle certification runs only against the confirmed isolated project. It
covers the full 285-game season, dynamic scheduling, disruptions, line and
score failures, privacy, playoff eligibility, Survivor, archives, championship
recording, and a blank annual rollover. Production never receives fixtures.

## 2026-08-17 — REF-013 — Player-controlled email plans with a routine inbox limit

**Status:** Superseded in part by REF-026

Keep the existing self-service email choices, expressed as Essentials, Regular,
and Full Card plans with optional detailed controls. Existing player choices are
preserved until that player changes them. Deliver no more than one routine pool
email per player per Eastern calendar day; deadline reminders and material
early-lock or schedule-change notices remain eligible because they can require
timely action. Record intentionally held routine messages as receipts so the
Commissioner can distinguish them from delivery failures.

The plan presets and self-service choices remain accepted. REF-026 supersedes
only the cross-category one-message-per-day limit.

## 2026-08-18 — REF-015 — Reproduce and independently monitor critical automation

**Status:** Accepted

Keep line locking, score refresh, and pre-lock spread refresh in one idempotent
timestamped migration. Launch preflight validates exact schedules, endpoints,
authorization, external providers, sender readiness, and Commissioner alert
delivery without consuming odds credits or sending email. A separate public,
opaque heartbeat lets an external monitor prove the internal watchdog itself
is still completing.

## 2026-08-18 — REF-016 — Make notification timing explicit and suppress empty reveals

**Status:** Accepted

Replace the single selection-reminder preference with three preserved player
choices: Sunday early, Sunday afternoon, and the combined Sunday/Monday
primetime set. Add the 6:00 PM Sunday occurrence, but send every reminder only
when a legal selection can still be made. Public reveal occurrences with no
represented selections end as explicit suppressions rather than deliveries,
failures, or indefinite retries. Automatic subjects always identify the
relevant week or playoff date, and weekly recap wording drops Survivor after
that pool is no longer relevant. Remove ad-hoc Commissioner scheduling so the
automatic timetable and player self-service choices remain the only delivery
controls.

## 2026-08-19 — REF-018 — Bound operational storage without deleting pool history

**Status:** Accepted

Keep every competitive and player-facing historical record, including picks,
official lines, final results, audit entries, championships, and email
receipts. Weekly storage cleanup may delete only routine `sync_runs` and
resolved automation or schedule-review records after 180 days. Store unchanged
preliminary spread snapshots no more than once per Eastern day while preserving
all changed snapshots. A service-role-only per-table size report makes the
remaining database use visible to the Commissioner without opening metadata to
players.

### REF-017 - Harden advisor findings without opening data access (2026-08-18)

**Decision:** Pin the `search_path` of every public-schema function that does
not already declare one, and make the legacy `rls_auto_enable()` helper
service-role-only if it exists.

**Why:** The security advisor correctly identified mutable lookup paths and a
publicly executable `SECURITY DEFINER` helper. This remediation is idempotent,
preserves explicit `cron`/`vault` paths, and never adds a client-facing table
policy merely to dismiss RLS informational findings.

## 2026-08-20 — REF-019 — Certify annual turnover before cleanup

**Status:** Accepted

On and after the August 1 Eastern season boundary, create the new blank season
first, then clean only after the previous season is complete, every game and
selection is settled, schedule reviews are resolved, and required champions
are recorded. Preserve official games, lines, picks, scores, championships,
delivery receipts, and the final save snapshot for every player/period/mode.
The only selection history eligible for deletion is an earlier pre-kickoff save
that was superseded by a later save. Also collapse preliminary line history to
the final snapshot per old-season game, expire transient worker/security state,
run the existing 180-day operational retention, and create next-season
Survivor entries. Record one permanent retry-safe receipt with the exact kept
and removed counts. A failed certification blocks cleanup, not scoring or
schedule preparation, and opens one actionable Commissioner alert.

## 2026-08-20 — REF-020 — Monitor execution and verified backups externally

**Status:** Accepted

Keep the existing public-site and watchdog monitors, then add two independent
proofs: a fixed-size critical-worker heartbeat for line locks, scores, and
reminders, and a free HTTP endpoint that verifies the latest encrypted-backup
workflow completed successfully. The backup workflow uploads an artifact only
after export, encryption, and decrypt/restore verification. Public health stays
deliberately opaque, while the Commissioner and GitHub views retain actionable
detail. Monitoring records update in place and therefore do not create a new
source of database growth or require UptimeRobot's paid push-heartbeat tier.

## 2026-08-20 — REF-021 — Rehearse a live week weekly and detect drift daily

**Status:** Accepted

Use the existing Wednesday isolated workflow to rehearse a realistic ATS and
Survivor save/revision, slate finalization, grading, history check, and atomic
week handoff inside an always-rolled-back transaction. Separately, reuse the
existing leased five-minute watchdog to run Launch Preflight's external
configuration checks once per Eastern day, retry failed checks no more than
hourly, and surface one deduplicated incident. The daily check must not send a
pool message, spend an Odds API credit, create another cron schedule, or run
against test fixtures in production.

## 2026-08-25 — REF-022 — Verify real sessions and deployed configuration

**Status:** Accepted

Run the existing browser player flow on every pull request against only the
confirmed isolated project, including saved-session account controls and a
temporary authenticated-profile failure. After Vercel marks a production
deployment successful, independently retry the canonical page and all four
opaque health contracts. Report multiple simultaneous contract failures as a
likely shared deployment or server-authorization incident before touching
individual schedules. Launch Preflight must name the selected Supabase server
credential variable without exposing its value and treat the compatibility
fallback as configuration drift. Drop only the exact confirmed
`runtime.sendMessage` browser-extension error from client Sentry events; broad
error classes and player identity remain excluded.

## 2026-08-25 — REF-023 — Preserve the Data API schema boundary

**Status:** Accepted

Keep `USAGE` on the exposed `public` schema for `anon`, `authenticated`, and
`service_role`. Preserve full table and sequence access for the trusted,
server-only `service_role`, while continuing to control client access with
explicit object-level grants and row-level security. Audit these prerequisites
in the isolated database on every pull request so an advisor cleanup or manual
grant change cannot silently disable player sessions or server automation
again.

## 2026-08-26 — REF-024 — Keep isolated credentials away from Dependabot

**Status:** Accepted

Dependabot pull-request events intentionally cannot read the `isolated-test`
environment secrets. Give those pull requests an explicit successful no-secret
result instead of failing the environment confirmation with blank values.
Application quality continues to validate dependency updates, while
human-authored pull requests, scheduled rehearsals, and manual certifications
retain the complete isolated database and browser gate. Do not duplicate the
database URL or service-role credential into Dependabot secrets merely to make
the privileged test execute. Classify the change by the pull request author,
not `github.actor`, because an owner can refresh a bot branch without changing
who authored it. Serialize only the privileged database-lifecycle jobs through
one repository-wide concurrency group because every such branch targets the same
disposable database; parallel rehearsals can otherwise collide while seeding
fixtures. Keep no-secret Dependabot safety jobs outside that queue so concurrent
bot updates cannot supersede and cancel one another while waiting.

## 2026-08-26 — REF-025 — Schedule upgrade rehearsal on a non-gameday

**Status:** Accepted

Evaluate the monthly isolated upgrade rehearsal during the first ten Eastern
calendar days and run it on the first available date with no NFL game. Use the
canonical no-credit schedule feed across preseason, regular season, and
playoffs; fail closed when an active football month lacks schedule coverage.
Record a successful monthly completion artifact so later daily checks skip. A
scheduled attempt gets exactly one selected non-gameday each month; preserve
manual dispatch as the deliberate retry path after a failure. This does not change production availability—the rehearsal has always
been isolated—but it keeps optional CI work and alerts away from peak game use.

## 2026-08-26 — REF-026 — Treat playoff reveals and daily recaps as separate promises

**Status:** Accepted

Remove the global one-routine-email-per-Eastern-day limit because distinct live
events—especially sequential playoff kickoffs followed by a final recap—are
separate messages the player explicitly selected. Keep one immutable snapshot
per scheduled occurrence and one unique reminder/player delivery receipt so
retries cannot duplicate that occurrence. Regular includes the daily playoff
recap; Full Card additionally includes every playoff kickoff reveal.

At kickoff, reveal only that exact game group and combine games only when their
kickoff timestamps match. The receipt lists every player eligible for those
matchups, marks a missing required selection as a no-pick loss, and never includes
an earlier or later game. Subjects name the round, matchup, and Eastern date.
Daily recaps send only after final grading, explicitly list new eliminations,
and crown the Pick'em champion or co-champions on the final day. Empty public
windows remain terminal suppressions rather than retries.

## 2026-08-26 — REF-027 — Harden lifecycle edges without changing pool play

**Status:** Accepted

Enforce the current/next-week pick window inside the database as well as the
application, including replacement and clear operations, and reject selections
for any game no longer scheduled. Freeze playoff eligibility only on a real
playoff game day after every earlier game day has reconciled. Bound reminder
claims to three items, extend their worker lease, and reclaim a crashed claim
only when no delivery receipt exists.

Use a preliminary line as an automatic provider fallback only when it is no
more than 24 hours old; older or invalid history remains preliminary and opens
Commissioner review. For pick'em (`PK`), keep the home team in the pool's
favorite-side position. Slow repeated PIN guesses by source fingerprint after
five and ten failures without ever locking an individual player's valid PIN.
Treat verified postponed, cancelled, and no-contest selections as audited
voids—not losses—and allow those settled disruptions to stop holding rollover.

## 2026-09-07 - REF-028 - Keep the NCAA Bowl Pool separate, voluntary, and push-free

**Status:** Accepted for competition rules; the named schedule/result provider
was superseded by the ESPN-backed implementation described below.

Create a separate annual Bowl Pool rather than bending the NFL season model.
Players opt in beginning December 7 at 3:00 AM Eastern and may withdraw before
the first kickoff; a withdrawn pre-event draft is retained through that choice
window and removed at the first kickoff. Every FBS bowl and CFP game is an
individually lockable ATS selection, public only at that game's kickoff.

Keep genuine PK games as PK. Convert every non-zero whole-number source spread
to the next half point before it is locked, removing ATS pushes without hiding
the original provider value. Rank by wins, then the closest absolute combined
points prediction for the CFP national championship; remaining ties crown
co-champions. Use CollegeFootballData as the no-cost schedule/result source
and the existing Odds API integration for current NCAAF lines.

## 2026-09-08 - REF-029 - Make production worker failures actionable to the Commissioner

**Status:** Accepted

The public worker-health endpoint remains an intentionally opaque availability
contract, but it and the Commissioner Automation Status view must use one shared
evaluation of due line locks, scores, reminders, and worker heartbeats. A failed
production smoke gate therefore corresponds to a visible Commissioner action
item with the affected responsibility, while public probes reveal no job names
or timestamps.

## 2026-09-08 — REF-030 — Recover proven overdue critical work through the watchdog

**Status:** Accepted

When the shared critical-worker assessment proves that a line lock, score
check, or reminder is both due and unhealthy, the existing leased watchdog may
run that worker's standard recovery path once. This avoids a second privileged
implementation and retains every worker's lease, provider allowance, backoff,
idempotency, and delivery protections. The watchdog re-evaluates health after
the attempt and preserves an incident when recovery fails or remains in
progress; it never treats an attempted repair as a successful one.

## 2026-09-08 — REF-031 — Keep legacy recap duplicates from blocking the reminder worker

**Status:** Accepted

Weekly recap scheduling needs only one existing recap record to prove that the
period is already queued. It therefore reads at most one matching record and
leaves any legacy duplicates untouched. This avoids a harmless historical
duplicate turning into a worker-wide failure while preserving all delivery and
audit records.

## 2026-09-08 — REF-032 — Insert only missing automatic email occurrences

**Status:** Accepted

Automatic email scheduling first reconciles the existing scheduled occurrences,
then inserts only keys that are absent. The table's partial unique key remains
the final duplicate guard, but is not used as a PostgREST upsert conflict
target. This retains immutable delivery records and prevents schedule setup
from blocking the reminder worker.

## REF-033 - Agile NCAA bowl schedule staging

- **Decision:** Stage bowl games with a stable commissioner-supplied key and
  canonical sponsor-free display name; allow team and spread fields to remain
  blank until confirmed. Keep the pre-launch standings preview commissioner-only.
- **Reason:** Bowl participants and lines change annually, while the known bowl
  order and kickoff schedule can be prepared safely without exposing unfinished
  data or changing NFL records. Idempotent keyed imports avoid duplicate games.
- **Supersedes:** Manual, one-off bowl rows and a fixed five-row preview.

## REF-034 — Weekly subscribers receive playoff round recaps

**Status:** Accepted

Keep the existing post-grading playoff recap snapshot and its elimination and
champion detection, but deliver it to players who selected weekly recaps as
well as players using the older dedicated playoff-recap choice. Subject lines
identify both the completed playoff round and the represented game date.

**Reason:** A weekly recap subscriber should not silently miss the round summary
just because the playoff-specific toggle predates the plan system. Preserving
the legacy toggle avoids changing custom player choices while making the weekly
plan promise consistent through the playoffs.

## 2026-09-11 — REF-035 — Separate watchdog liveness from diagnostics

**Status:** Accepted

Treat the public automation heartbeat as proof that an authenticated, leased
watchdog invocation reached Postgres and durably recorded its run receipt. Write
that pulse before the watchdog performs heavier diagnostics, provider checks,
alert delivery, Bowl readiness, or housekeeping. Failures in those later steps
remain persisted as failed watchdog runs and Commissioner incidents, while a
failure to acquire the lease or store the initial receipt remains a real
liveness outage.

**Reason:** A transient diagnostic dependency should not make the independent
monitor report the scheduler as dead. This preserves prompt detection of real
cron, authorization, lease, or database failures without recurring false
heartbeat alarms.

## 2026-09-12 — REF-036 — Bound heartbeat noise without masking scheduler failure

**Status:** Accepted

The public watchdog heartbeat allows a durable receipt to be up to 35 minutes
old while the watchdog remains scheduled every five minutes. This absorbs
bounded pg_cron and serverless delivery jitter that can otherwise turn several
short-lived missed invocations into repetitive external downtime messages.

**Reason:** The liveness route still fails closed when no receipt arrives for
seven monitor intervals, preserving detection of a genuinely stopped cron,
authorization, lease, or database path while making a transient dispatch delay
non-actionable rather than noisy.

## 2026-09-12 — REF-037 — Decouple unchanged Survivor state from Pick'em saves

**Status:** Accepted

A Slate submission includes Survivor data only when the player changed the
Survivor selection. An ATS-only update therefore uses the ATS-only atomic save
path and leaves an existing Survivor pick untouched.

**Reason:** Once a Survivor game begins, its selection must stay sealed. That
constraint applies only to Survivor changes; it must not prevent a player from
adding or revising a still-open Pick'em selection later in the same week.

## 2026-09-22 - Email artwork and preview share one renderer

**Status:** Accepted for shared rendering; the image-spacing editor choice was
later removed. The density field remains an internal compatibility detail, not
a commissioner control.

Replace guessed-height recap canvases and separate roster sections with an
intrinsically sized card, trimmed from its transparent working canvas.
Standings, recap wins and selections appear together by player identity.
Keep all rows at readable width instead of shrinking large rosters into two
columns. Survivor omits future empty weeks and shows up to six completed weeks.
The Commissioner Email image studio uses the delivery PNG renderer and HTML,
supports private phone/desktop inspection and downloads, and saves spacing
alongside standard wording. Preview calls are read-only; unavailable results
are explicitly fictional samples. Saved delivery snapshots remain immutable.
Image spacing is included in outgoing URLs so later preference edits do not
restyle sent messages. Pixel-based renderer checks cover short and long cards.

## 2026-09-22 - Interactive provider charts and monthly credit accounting

Grading charts now share the dashboard refresh and period selection. Use a
daily/cumulative UTC calendar-month credit chart and paginate receipts to avoid
the 1,000-row truncation. Explicit zero-cost responses remain zero; missing cost
headers use the documented endpoint estimate rather than JavaScript null-to-zero
coercion. Quota snapshots and recorded costs are different measures.
Legacy slate attribution is bounded by finalization and marked estimated;
overlapping windows are withheld rather than assigned to the latest kickoff.
Shared responsive charts provide crosshairs, touch and keyboard exploration,
separate efficiency axes, and a data table. Ladder widths retain actual gap
proportions, with fresh-final counts controlling bar height.

## 2026-09-28 - Commissioner-only Season Snapshot prototype

**Status:** Superseded by the Pick'em Pad flip, Week 6 release gate, and
all-player week plotting decisions below.

The Pick'em Pad contains a default-minimized Season Snapshot, visible only to
commissioners until release. The graph uses historical period results, and its
commissioner-only endpoint loads only while expanded. The original settled-week
chart treatment was superseded by the alignment, active-card, and visual rules
below.

## 2026-09-28 - Season Snapshot week alignment and release timing

**Status:** Accepted for aligned axes and styling; the per-player active-week
plotting rule was superseded by the all-player rule below.

Keep the snapshot available to commissioners for review, including before Week
6; players do not see it until it is explicitly released. Plot a zero-win
regular-season baseline and align every player on the same week x coordinate.
Once all of one player's weekly picks are graded, plot their cumulative result
without waiting for the rest of the period. Use vivid stable player colors and
no point markers or bottom data table. Fit the plotted weeks across the full
available graph width so the current week always lands at the far edge. When
results overlap exactly, use narrow layered line colors in live standings
order instead of offsetting players horizontally. Show a separate playoff plot
that continues cumulative season totals, with a dynamic vertical range around
those totals. Refresh it from the existing standings cadence, without an
independent polling loop.

## 2026-09-28 - Touching Season Snapshot ribbons

Replace overlapping strokes with slim touching ribbons. On a shared trajectory,
the higher current standing occupies the upper band. Center each bundle on its
actual score and keep common week endpoints continuous as players split or join.
Inset light and dark edges provide a restrained bevel without outside shadows,
dash patterns, gaps, or markers. This supersedes the nested stroke treatment;
the regular-season baseline still starts at zero and all week columns align.

## 2026-09-28 - One credential path and fewer superseded release runs

**Status:** Accepted

Use a clean release branch and verify the existing GitHub CLI login after
network access is available. The release helper rejects credentials embedded in
the remote URL, uses a temporary Git authorization header, and selects OpenSSL
for Git on Windows. A newer commit to the same pull request cancels its older
application-quality run. The isolated database gate and production smoke gate
remain unchanged.

**Reason:** Restricted network access had made a valid login look expired, and
the Windows Git TLS/credential path caused release hangs and unsafe workarounds.
One final push avoids repeated preview and CI runs. We retain main-branch
application quality after merge because branch protection currently requires
only the database lifecycle check and does not enforce those rules for admins.

## 2026-09-29 - Grades and official lines are saved in one database call

**Status:** Accepted

NFL pending-grade recovery, Bowl Pool grading, and official line locking each
run as a single database function (`recover_pending_ats_grades`,
`grade_bowl_pool_final_picks`, `lock_official_lines_atomically`). Bowl grades
and their result receipts are written together, and the Bowl function also
repairs any graded pick whose receipt an earlier two-step write left missing.
An official line, its preliminary-history snapshot, and its audit entry are
saved together, and only lines actually inserted are audited. The Bowl sync now
uses the shared Eastern August 1 season year instead of a UTC calculation.
Grading rules are unchanged: a cover wins, an ATS push is a loss, a Bowl PK is
straight up, and a tie is a loss.

**Reason:** Separate application writes could leave a graded pick without its
receipt (never retried, because only pending picks were reloaded), a locked line
without its audit record, or a week half-graded after an interruption. One
transaction leaves either the old state or the complete new state, so retries
are safe. This supersedes the per-pick and per-step writes previously issued
from `sync-bowl-pool.ts`, `sync-final-scores.ts`, and `lock-due-lines.ts`.

## 2026-09-29 - Bookkeeping writes are checked

**Status:** Accepted

A watchdog alert is sent only after its attempt time is saved, and incident
open, refresh, and close writes are counted in the run details (bookkeepingFailures)
and skipped for that incident, so one bad row cannot stop the others from being
opened or sent.
Run outcomes go through one helper that retries once and reports in the server
log. The ESPN Bowl sync never replaces a locked official line, and its line,
reminder-cancellation, and season-status writes are checked.

**Reason:** An unrecorded alert attempt would repeat the Commissioner email on
every five-minute run, and an unrecorded run outcome leaves a run stuck at
started. These make failures visible rather than silent.

## 2026-09-29 - Period activation is atomic; Bowl refresh keeps curated names

**Status:** Accepted

Opening a scoring period when none is active now uses
`activate_scoring_period_atomically`, under the same per-season lock as the
weekly handoff. It refuses to skip an unfinished earlier period, to open a
second active period, or to open one with no imported schedule, and it reports
the reason instead of failing the score worker. The earliest due period opens
first. The weekly handoff also checks pending Survivor picks in the application
and reports "blocked" with a reason, matching the ATS check, instead of failing
every score run on the database exception. The ESPN Bowl refresh may link a game
(`provider_game_id`), correct its kickoff, teams, and venue, and add new games,
but never renames or reorders an existing game. The unused polling-plan
simulator and its "suggested plan" were removed; the fixed retry ladder is the
only score-polling policy.

**Reason:** The old activation was a plain update that could skip a period or
open an empty one. A pending Survivor pick made the handoff throw generically on
every run. Overwriting bowl names and order every 15 minutes could undo curated
values, and the simulator recommended plans that could never be applied. This
supersedes the latest-due-period activation and the provider-owned bowl names.

## 2026-09-29 - The Slate receipt is a die-cut ticket

**Status:** Accepted

The receipt is drawn as a real die-cut ticket: a stub (Submit), the Pick'em
section, and Survivor when it applies. Round notches are cut at the top and
bottom of each perforation and the two ends are serrated. Each section paints
its own paper on a masked layer behind its content, so the notches are true
cutouts (the page shows through as it scrolls under the sticky receipt) and
nothing inside is clipped. When Survivor is not shown, the Pick'em section
takes over the serrated right end. The shadow follows the ticket's outline.
The Pick'em section still grows to fit playoff rounds (three chips per row for
five or six picks).

**Reason:** A rectangular bar with painted-on punches could not show the page
behind it, and a fixed shape would not survive Survivor appearing or
disappearing. Per-section masks keep the notches on the perforations whatever
the section widths. This supersedes the single-background receipt strip.

## 2026-09-29 - Season Snapshot: recency stacking, hide/show, fixed colors

**Status:** Accepted

Lines that share a path stack by who held the greater total most recently
(latest week back to the first difference), replacing current-standings order.
Players can be hidden and shown from the key; the axis and stacking recompute
for whoever remains, and hovering highlights one player. Each person keeps one
of eleven validated hues (assigned alphabetically) regardless of visibility.
All explanatory text was removed; only the title remains.

**Reason:** With eleven players the old order made overlapping lines hard to
read and the leader always drew on top even after being passed. Recency shows
who is actually ahead right now, hiding lets a viewer follow only the players
they care about, and stable colors keep a person recognizable when the chart
changes. This supersedes the higher-current-standing-above rule and the
single-player focus mode.

## 2026-09-29 - Database hiccups are reported as hiccups

**Status:** Accepted

When the pick-save or Slate route cannot read the player or week, the player now
sees "Pick'em is having trouble reaching its records right now. Please try
again in a minute." (HTTP 503) instead of being told their profile is inactive
or the week does not exist. The Bowl sync stops with a clear error when a
database read fails, rather than finishing as an empty, healthy run. A failure
to clear old PIN attempts after a correct sign-in is logged; sign-in still
succeeds. react-dom now matches react (19.3.0).

**Reason:** A wrong message about a player's own account erodes trust, and a
silent empty run hides a real outage from the watchdog.

## 2026-09-29 - One Sentry version; Eastern season year in the Bowl dispatcher

**Status:** Accepted

The browser Sentry setup uses the SDK's own replay integration instead of a
separately versioned `@sentry/replay` package, so one SDK version loads. The
unused `js-yaml` direct dependency was removed (ESLint keeps its own copy). The
Bowl sync dispatcher now takes its season year from Eastern time, matching the
application's August 1 rule. The Commissioner access check retries a transient
database error and logs a persistent one; it still denies access on failure.

**Reason:** Mismatched Sentry packages loaded two SDK cores and needed a type
cast to fit; an unused dependency is maintenance with no benefit; and the
dispatcher could create next season's Bowl row about four hours early.

## 2026-09-29 - A skipped Bowl tiebreaker only loses the tiebreaker

**Status:** Accepted

The Bowl Pool champion calculation ignored every entry without a championship
total guess, so a player with the most wins who skipped the optional guess
could not be crowned, and a season with no guesses crowned no one. Entries
without a guess now count; they lose the tiebreaker to any guess, and leaders
who all skipped it are co-champions. The standings sort follows the same rule.
A new isolated test certifies a full Bowl season end to end.

**Reason:** Wins are the competition; the guess is only a tiebreaker. This
supersedes the guess-required champion query.

## 2026-09-29 - Clearing a Bowl pick is audited without a dangling reference

**Status:** Accepted

The Bowl pick audit trigger runs after a delete and recorded the deleted pick's
id as a foreign key, so every delete failed: a player could not remove a
selection, and purging withdrawn drafts at the first kickoff failed and stopped
the Bowl sync. A cleared pick is now recorded with no pick reference and the old
id, game, and team in its details. Found by the new isolated Bowl season test.

## 2026-09-29 - Leaner commissioner desk

**Status:** Accepted

The desk drops repeated navigation (Quick Routes duplicated the header links and
tabs), every per-tab intro block, the tab description line, and an empty Season
section. Season readiness checks moved to the Season tab; the handbook is its own
collapsed section under System. On phones the active tab scrolls into view. No
tool was removed. The account nav retries a failed profile read so the
Commissioner link cannot stay missing after one transient error.

**Reason:** The desk had the right tools but spent a screen of prose before
reaching them.

## 2026-09-29 - The Season Snapshot is the back of the Pick'em Pad

**Status:** Accepted

Instead of a collapsed section under the pad, the Season Snapshot is the pad's
back face. A round button at the top right turns the card over with a 3D flip
(instant under reduced motion). Both faces share the front's size, the chart
fills the back's height with Wins and Week axis labels, the player key sits
below it, and Show all is always visible and greyed out when everyone is shown.
Still commissioner-only until released.

**Reason:** The chart belongs to the pad it summarizes, and a fixed card size
keeps the page from jumping. This supersedes the default-minimized section.

## 2026-09-29 - Season Snapshot opens to players at Week 6; weeks plot together

**Status:** Accepted

Players get the flip button and the snapshot data from Week 6 (or any playoff
round) until the August 1 rollover; commissioners always have it. The data route
moved from /api/admin to /api/season-snapshot and checks the release rule
before reading any picks. The active week is plotted for everyone at the same
time, once every game has kicked off and no Pick'em pick is pending.

**Reason:** A mid-season reveal keeps early weeks from spoiling the race, and
plotting everyone together avoids a line that jumps ahead of players whose
games have not finished. This supersedes per-player plotting of the active week.

## 2026-09-29 - Permanent snapshot colors and a slab-style flip

**Status:** Accepted

The eleven-hue palette was shuffled three times with a secure random source and
frozen. Colors follow join order (players.created_at, including inactive
players) instead of alphabetical order. The flip button is two chasing arrows
that spin once per turn; the pad turns as a thin slab with paper edges, faces
swap visibility at the edge-on midpoint with symmetric easing, and the phone key
is a compact four-column grid.

**Reason:** Random-then-frozen colors are fair and never shift when someone
joins, leaves, or is hidden. The midpoint swap removes the brief mirrored front
face, and the compact key gives the chart more room on phones. Supersedes
alphabetical color assignment.

## 2026-09-29 - Cut idle Vercel CPU from polling and reminder ticks

**Status:** Accepted

The home page background poll slows from one to three minutes, and returning
to the tab (focus or visibility) refreshes at once, at most every 30 seconds.
The exact kickoff reveal timer is unchanged. The Grading tab polls only while
visible. Reminder delivery is gated in Supabase so idle five-minute ticks never
call Vercel. Score sync and the watchdog keep their cadences.

**Reason:** The project was near the Vercel Fluid active-CPU limit. Grades only
change on the ten-minute score sync, so one-minute home polling did mostly
redundant work, and nearly every reminder tick found nothing to send.

## 2026-09-29 - Flat, wide Season Snapshot flip

**Status:** Accepted

The slab depth is removed; the pad turns flat. The back widens to the full
Standings rail, matching the Survivor Table, and uses a cool gray surface
instead of the pad's parchment. The flip arrows use thinner strokes and small
open chevron heads. Supersedes the slab-style flip.

**Reason:** The commissioner preferred a flat, elegant turn, and the wider back
gives the chart room to read.

## 2026-09-29 - Season Snapshot views, eased lanes, and remembered choices

**Status:** Accepted

The back of the pad returns to the pad's parchment. Lane changes between a
shared week point and a bundle now ease over the outer 30% of each week
instead of a sharp jog. An All / 6 Wk toggle (regular season only) shows the
whole season or an exact, week-notched six-week window that opens on the
latest six weeks. During the playoffs the playoff chart replaces the
regular-season chart and hides players out of the race by default.
The range choice and hidden players are remembered per device in browser
storage; if storage is unavailable the defaults apply.

**Reason:** The commissioner preferred the parchment, saw distracting kinks,
wanted a tighter, more readable recent view, and wanted the chart to open the
way it was last left. Device storage avoids a schema change for a view
preference. Supersedes the cool gray back.

## 2026-09-29 - Straight weekly bands in the Season Snapshot

**Status:** Accepted

Each week of a line is one straight band from the player's slot at the start
of the week to their slot at the end; the eased lane changes are removed. The
All / 6 Wk toggle halves are equal width.

**Reason:** Easing lane changes inside a week added visible S-bends on phones.
Straight bands bend only at week boundaries, like an ordinary line chart, and
keep stacking order so shared paths never cross. Supersedes the eased lanes.

## 2026-10-01 - Bowl Pool gold theme and standard heading rule

**Status:** Accepted

The Bowl Pool's teal/green treatment (Bowl Card header band, game cells, rules
panel, selections page, and commissioner Bowl panels) is replaced by a subtle
gold palette, in light and night themes. The Bowl Card's heading line, including
when minimized, now uses the same ledger rule as the other standings headings.
Green remains reserved for "ready" status and red for problems.

**Reason:** The commissioner found the green heavy and the minimized heading
line inconsistent. Supersedes the teal-and-gold Bowl identity.

## 2026-10-01 - Brown accents for Bowl spreads and countdown

**Status:** Accepted

The Bowl Card's spreads and the Games Remaining countdown tiles use brown
accents; countdown digits stay white. Night theme spreads use a light tan.

**Reason:** The commissioner wants to lean into brown accents alongside the gold
Bowl palette. Extends the gold theme.

## 2026-10-01 - Patch Next.js for a critical advisory

**Status:** Accepted

Next.js is pinned to 16.3.8 (was 16.3.3). The Application quality audit gate
(npm audit, critical level) began failing on a new Next.js remote-code-execution
advisory in next/og ImageResponse, affecting versions 16.2.0 through 16.3.5.

**Reason:** Keep the critical-audit gate meaningful and the app patched. The pin
stays exact, as before.

## 2026-10-01 - Cut Vercel CPU from uptime probes and the watchdog

**Status:** Accepted

Healthy answers from the automation, worker, settlement, Bowl Pool, and backup
probes are cached at Vercel's CDN (10, 10, 15, 15, and 60 minutes), each well
inside the probe's own grace window. Failures are never cached, and /api/health
always runs live. The operations watchdog moves from every five to every ten
minutes; its 35-minute heartbeat window still leaves slack.

**Reason:** The project neared the Vercel Hobby 4-hour monthly active-CPU limit.
Eight five-minute uptime monitors were about 2,300 function calls a day, far
more than the scheduled jobs, and the earlier polling cuts did not touch them.

## 2026-10-01 - Phone slate rows without Survivor chips

**Status:** Accepted

On phones, rows without Survivor chips no longer apply the desktop centering
nudge to the spread (the kickoff time already has its own lane there), and the
early-lock note wraps inside the spread column.

**Reason:** The nudge pushed spreads into the favorite's name and the lock note
into the underdog's name for players whose Survivor chips are hidden.

## 2026-10-01 - Smaller email images

**Status:** Accepted

Email artwork is saved as a 256-color palette PNG instead of full-color RGBA,
cutting each image by about two thirds (for example 74 KB to 23 KB) with no
visible change. Both the stored email images and the fallback image route use the
same renderer.

**Reason:** Email images were slow to load on phones. The artwork is flat color
and text, so a palette loses nothing visible, and fewer bytes load faster in every
email client without changing the format clients already accept.

## 2026-10-01 - Faster Season Snapshot

**Status:** Accepted

The snapshot route's database reads moved to a loader that shares the finished
chart in memory (held until the active week's last kickoff, rechecked every two
minutes while grades land, and held an hour once the week settles, instead of a
fixed timer), merges the two player reads into one, and pages
picks past PostgREST's 1,000-row cap. The release gate still runs before any
pick is read, and a cached chart is never given to a player before Week 6. The
browser keeps the last chart on the device and shows it immediately while the
fresh one loads.

**Reason:** The back of the pad waited on five or six sequential network calls on
every open. Everyone sees the same chart and grades change on the ten-minute
score sync, so a short shared cache and a saved copy remove most of the wait
without a schema change. Paging also prevents silently truncated picks late in
the season.

The browser loads the chart only while the back is showing and only when the
standings changed since it last loaded, so there is no polling and flipping back
and forth costs nothing. The chart only changes once a week, when the last pick
settles, so a fixed 30-second refresh was needless work.

## 2026-10-01 - Plot the week when its last pick settles

**Status:** Accepted

The Season Snapshot plots the active week as soon as its last Pick'em pick has
settled, not after the week's final kickoff. A week is settled when no pick is
pending and every active player either holds all their picks for the week or every
game has kicked off. The server holds the chart accordingly: until pending picks
could first be graded (about three hours after their kickoffs), then rechecks every
two minutes, and holds it an hour once the week has settled. Supersedes the rule
that required every game of the week to have kicked off.

**Reason:** Nobody has to pick the Monday night game, so the week is usually
settled earlier, and the chart should appear then. A player with an open pick slot
keeps the week open until the last kickoff, so the chart never plots a week that
could still change.

## 2026-10-02 - Ticket corner notches and a two-line early-lock note

**Status:** Accepted

The receipt ticket now has a round bite in all four outer corners (the two left
corners of the stub and the two right corners of the last section) in addition to
the notches at both ends of every perforation, with the serrated edge between the
corners. The early-lock note on the Slate is two short lines under the centered
spread: the day, then the time (for example LOCKS 10/3, then 6 PM ET), in a
slightly smaller size so it fits the spread column on phones.

**Reason:** The commissioner wanted the ticket to read as die-cut at every corner
and perforation, and the lock note wrapped awkwardly (an orphaned "PM ET") and
crowded the team names.

## 2026-10-02 - Season length read from the schedule feed

**Status:** Accepted

The schedule import no longer assumes 18 weeks and 272 games. It reads the
season's length from the nflverse feed, requires every week to have games and all
32 teams to play the same number of games, and, in preseason, adds any missing
regular-season week before the playoff rounds (ensure_regular_season_weeks). Weeks
are never removed; a shorter feed stops for review. Live reconciliation compares
against the season's own canonical game set instead of 272.

**Reason:** The NFL has discussed an 18-game season. The commissioner chose for the
pool to adapt on its own rather than stop and wait for a code change.

## 2026-10-02 - Unattended operation for years

**Status:** Accepted

A sweep for running a decade without anyone touching it. Fixed now: a weekly
workflow re-enables every scheduled GitHub workflow so GitHub's 60-day idle rule
for public repositories never stops the weekly backup; the backup health check
falls back to an anonymous read of the public run list when its token is missing
or expired; and the Bowl Pool title and commissioner schedule default no longer
hardcode 2026. OPERATIONS.md now lists what resets each year, what is kept and
removed, and what still needs a person.

**Reason:** Without a commit for 60 days GitHub would have disabled the backup
workflow, and an expired token would have reported a false backup outage. The
remaining items (Survivor with no single winner, a longer NFL season, provider
plans, and Node runtime support) need a rule or an account decision and alert the
commissioner when they occur.



## 2026-10-02 - Survivor co-champions

**Status:** Accepted

Survivor now always ends with a champion. The last entry standing wins alone;
everyone eliminated in the same final week shares the title; several entries that
survive the whole regular season share the title. A champion is decided only once
the deciding week has settled (the survivor's own pick has won, or the week is
complete), so a player who outlasts the others on Sunday but loses on Monday
shares the title instead of winning alone. The one-Survivor-champion-per-year
database limit is removed; each co-champion gets a trophy and is named together.

**Reason:** Before this, a same-week finish or several survivors left the season
with no Survivor champion, which blocked the annual turnover and kept the next
season's Survivor from opening. The commissioner chose co-champions. Supersedes the
one-champion Survivor rule and crowning the instant one entry remained.

## 2026-10-02 - Grading page uses every recorded data point

**Status:** Accepted

The polling histogram read only the newest 1,000 score, line-lock, and bowl runs,
which at one line-lock run a minute covered well under a day. It now reads every
score run that recorded a retry rung since the start of the season, in pages, and
the page states the date the record starts. "Last score sync" now reads score runs
only (it could be a line-lock or bowl run before), Worker activity reads the latest
run of each worker, and the efficiency totals are season to date instead of a
rolling 30 days. A database test pins the paged read.

**Reason:** The commissioner expected the histogram to cover the whole season. Rungs
were first recorded on Sep 21, so earlier checks cannot be added without guessing.

## 2026-10-02 - Remove dead code and styles

**Status:** Accepted

Removed about 330 lines of CSS for classes no page uses (an old selection footer,
the earlier receipt layout, newspaper-clipping styles, and retired commissioner
panels), the JavaScript schedule reconciler that the live database reconciliation
replaced, and four exports nothing called. The documented rule that a game omitted
by the provider is reported and never deleted is now anchored to the live
reconciliation function instead of the unused file.

**Reason:** Less code to read and maintain, with no behavior change.

## 2026-10-02 - One Eastern-time module; tests cover the real rules

**Status:** Accepted

About 16 copies of the Eastern date and clock helpers across week rollover, line
locks, reminders, recaps, and Bowl emails now read one module (eastern-time.js).
A test compares it with verbatim copies of the old helpers over two years of
timestamps, every daylight-saving switch, and every midnight; they match exactly.
Two one-off display formats were left as they are.

JavaScript copies of rules that only tests used were removed: Bowl grading and
spread rounding (the database grades, and the Bowl lifecycle database test covers
it), two reminder-readiness rules, an outdated Survivor availability rule, a pickable
status check, an older heartbeat check, and a calendar-month credit summary. Where
the real rule lived inline, it moved into the tested library instead: the Bowl Card
sorts with the shared standings order (unchanged for players: wins, tiebreaker once
the final is in, then fewer losses), the Slate's Survivor "already used" check, and
the live heartbeat check.

**Reason:** Fewer places for time math to drift, and tests that check the code
players actually use.

## 2026-10-02 - Adapt commissioner grading refresh to workload

**Status:** Accepted

The grading dashboard refreshes every minute while games are live, attention
items are open, or a scheduled kickoff is within 15 minutes. It refreshes every
five minutes during quiet periods, pauses while hidden, and refreshes on return.
Periodic refreshes are skipped while another dashboard request is in flight.

**Reason:** Production route measurements showed the grading dashboard was the
largest observed source of server work. Adaptive polling preserves timely game-day
updates while reducing requests during quiet periods.

## 2026-10-02 - Bound repeated reads and incidental writes

**Status:** Accepted

Season-wide picks reads in standings, recap, and snapshot paths paginate beyond
PostgREST's 1,000-row response cap. The Home standings endpoint is read-only with
respect to Survivor enrollment and no-pick elimination; those changes remain on
the existing scoring and selection paths. Chat and settings polling use a narrow
player projection and do not write activity. Activity timestamps are best-effort,
rate-limited per player per warm function to once per 15 minutes, and concurrent
instances are coalesced by a database-side timestamp condition.

**Reason:** Keep historic data complete as the season grows while avoiding
repeated full-season maintenance and activity writes on read-heavy pages.

## 2026-10-02 - Compare provider cost and settlement at the same slate grain

**Status:** Accepted

The Commissioner grading dashboard pairs score-polling credits per settled
game with average kickoff-to-accepted-final minutes for each completed
game-time slate. The left and right axes name their units. A 15-Eastern-day
rolling credits-per-game average is weighted by the number of games, and
excludes incomplete slates and slates with ambiguous or missing polling
attribution. Separate game- and period-level latency charts are omitted from
this card; productive-check rate is removed from this chart, not from
underlying records.

**Reason:** Cost and settlement can be compared on the same timeline without
mixing game, period, and slate observations or treating a one-game slate as
equal to a full Sunday slate.

## 2026-10-02 - Keep Commissioner panels usable when a measurement is absent

**Status:** Accepted

Admin charts and capacity panels format provider and operational counts through
one missing-value-safe formatter. A temporarily absent number displays a dash;
other live metrics and controls remain available.

**Reason:** A production `/admin` error showed that formatting an undefined
measurement could crash a Commissioner panel. The alert did not include a
stack trace, so the exact field was not identified.

## 2026-10-02 - Reconcile the documented operating contract

**Status:** Documentation clarification; no runtime rule changed in this entry.

Keep historical decisions as a record of why a design existed, but identify
superseded details explicitly. The current implementation uses a feed-validated
NFL season length, a ten-minute NFL score-worker schedule with a fixed per-game
retry ladder, ESPN as the default Bowl schedule/result source, an optional
NCAAF Odds API fallback, and pre-rendered email artwork without a commissioner
spacing switch. The 18-week, 285-game isolated drill is a regression fixture,
not a production season-length constant. A scheduled monthly upgrade rehearsal
attempts only the selected non-gameday once; a failure requires a deliberate
manual retry. These statements reflect the current migration, test, and code
contracts and supersede conflicting wording in earlier entries.

**Reason:** A portfolio-quality operating record must distinguish current
behavior from earlier design decisions without silently editing history or
claiming that a documentation correction changed production.

## 2026-10-03 - Slower chat and home polling after a 100% Fluid CPU warning

**Status:** Accepted

Pool chat refreshes every three minutes (was one) while the tab is visible and
still refreshes on return. The home page background poll is five minutes (was
three). Return-to-tab refreshes and the exact kickoff reveal timer are unchanged.

**Reason:** Vercel reported 100% of the included Fluid Active CPU. Chat mounts on
every player-facing page, so its one-minute poll was the largest steady source.

## 2026-10-03 - Further Vercel CPU cuts: quiet grading poll and longer health caching

**Status:** Accepted

The commissioner Grading page polls every 15 minutes (was five) when no game is
near or live; the one-minute live/attention cadence is unchanged. Healthy
automation probes are CDN-cached 20 minutes, settlement and Bowl Pool one hour,
and backup six hours; worker probes stay at ten minutes to respect their
12-minute line-lock window.

**Reason:** Observability showed the Grading dashboard as the largest single
route and the health probes together about a third of background CPU, with the
30-day Fluid Active CPU total at the 4-hour allowance.

## 2026-10-03 - Symmetric Slate ticket; Survivor section torn off after elimination

**Status:** Accepted

The Slate ticket keeps its overall width and is symmetric: the left stub and
the Survivor section are the same width, with Pick'em between them. The
Survivor section is part of a week's ticket while the player is in the pool
and through the week they are knocked out. After that, and in the playoffs, it
is torn off: the stub and Pick'em that remain (same sizes) sit centered in the
same width, and the empty space stays until the next season, when Survivor
returns. After a champion is crowned the section stays for that week and then
leaves for everyone. On phones the six picks of a Wild Card round stack as two
columns of three on the narrower torn ticket. The board API reports this as
`survivor.showOnReceipt`.

**Reason:** An out player's ticket kept a dead Survivor column, and the
single-column version stretched wider than the picks needed.

## 2026-10-03 - The Standings ticket tears off Survivor too

**Status:** Accepted

The full ticket on Standings follows the same rule as the Slate receipt: its
Survivor section stays while a player is in and through their elimination week,
then is gone from the week after; it is also gone once the pool has a champion
and in the playoffs. Without it the ticket is a single column with the notes
beneath the picks. (Unlike the Slate receipt, the Standings ticket does not
keep the crowning week.)

**Reason:** An out player kept seeing "ENTRY CLOSED · OUT" on their ticket for
the rest of the season.

## 2026-10-03 - Trim Vercel Functions Storage

**Status:** Accepted

Functions Storage counts the function bundles of every deployment, and each
pushed branch was adding a preview deployment (about 90 deployments a day, 10.4
GB over 30 days). Vercel now skips preview builds except for `main` and
branches named `preview/...` (`scripts/vercel-ignore-build.mjs`); name a branch
`preview/<name>` when a phone preview is wanted. Separately, the two dashboard
routes no longer bundle the reminder worker and the image renderer (sharp, about
14 MB each) because the watchdog status read moved to `src/lib/watchdog-status.ts`.
The routes that really render email images keep it.

**Reason:** Functions Storage was at the edge of the Hobby allowance and the
project will not move to Pro.

## 2026-10-03 - Standings screenshot baseline and stylesheet cleanup

**Status:** Accepted

The Standings page (ticket, Pick'em Pad, Survivor Table, Bowl Card, and the
commissioner's flip to the Season Snapshot) has the same exact-match screenshot
baseline as the Slate (`npm run test:visual`, 44 images across phone, tablet and
desktop, with night mode on the busiest states). Against it, 49 style
declarations that provably changed nothing were removed, the ticket, Pick'em Pad
and Survivor Table rules were each gathered into one section, the flip rules were
rewritten as one block, and repeated rules were merged. Appearance is unchanged;
the Bowl Card's styles were deliberately left alone while its design is reworked.

**Reason:** The Slate cleanup showed the approach is safe when every state is
screenshot-tested, and the ticket and pad had their styles scattered across many
parts of a 4,000-line file.

## 2026-10-03 - Batch of Slate, ticket, and ledger refinements

**Status:** Accepted

The round cut-outs on the receipt are outlined with a hairline ring like the
straight edges. The Survivor chip on the receipt is larger (3.7 rem on desktop)
and centered in its section. On phones, pregame Slate rows without Survivor chips
set the favorite's name against the line from the left so the two names sit
symmetrically about it. The Pick'em Pad no longer shows an OUT mark under an
eliminated player's score (the ELIMINATED stamp over the picks remains). On a
phone, playoff rounds with more than two picks keep two columns on the Standings ticket, with each pick stacked (team, then kickoff and spread) so nothing overlaps, and the playoff ledger wraps each player's picks onto two lines
(2 x 2 for four picks, 3 x 2 for five or six) instead of scrolling sideways; the
round name sits under the ledger title.

**Reason:** The Wild Card ticket's two-column picks overlapped the spreads on a
phone, and a six-pick ledger needed horizontal scrolling to be read.

### Larger tap target for Slate picks

Each open team button on the Slate now has an invisible margin (about 0.7rem above and below, 0.35rem at the sides) that counts as a tap on that team, so a pick no longer needs an exact click. The margin sits behind other controls, so Survivor chips and links keep their own taps, and nothing changes visually.

### Slate spread alignment and ticket outlines

Pregame phone rows now mirror the kickoff lane with an empty right column, so the spread sits at the true center of the row, in line with the spread on finished rows. On finished rows the spread rides the team-name line instead of floating at the middle of the taller row. The ticket's notch rings are one pixel like the straight edges, and the perforation starts just below each ring over a strip of paper that hides the hairline where two sections meet.

### A real 3D poker chip, and a test chip on the Operations desk

The Survivor chip is now built as a true cylinder at a real chip's proportions (thickness about 8.5% of the diameter, like a 39 mm by 3.3 mm casino chip): two identical faces half a thickness either side of center, and 32 flat edge segments around the rim. Each quarter has one 16-degree segment carrying the face's colored insert over the edge, and the edge darkens as it faces away from the light, so it reads as round when the chip flips or spins. Head on it looks the same as before. A Raiders test chip sits to the right of Email center on the Operations desk heading: click to flip it, drag to turn it by hand. The "View chart data" tables on the grading dashboard are now plain ledgers instead of picking up the dashboard's pill-shaped row styling.

### A pick keeps its column

The Pick'em Pad and the ticket now place each player's picks by earliest kickoff, with the game id breaking a tie (src/lib/pick-column-order.js). Before, the Pad used submission order, so editing a pick, or two players entering the same picks in a different order, moved a pick between columns. The order uses only public facts about the game, so it does not change when a pick is revealed or settled. The ticket's instruction lines now wrap inside the Survivor column instead of running to the ticket edge.

### Final-lines mail is due when the day's last line locks

The game-day "final lines" and "Sunday final lines" emails were scheduled for the day's first line lock, then held by the sender until every game that day had its official line. On a Sunday with an international game, the first lock is Saturday at 6 PM Eastern, so both emails sat held overnight: the Watchdog reported them as two overdue messages, and the reminder worker was woken every five minutes all night for nothing. They are now scheduled for the day's last line lock, the first moment they can be ready, so they send at the same time as before without looking stuck. The email-schedule reconciler (every 15 minutes) moves any already-scheduled copies to the new time. The stuck-message alert now names the waiting messages.

### The Bowl Pool gets its own look

Navy and old gold on cream, with varsity lettering (Graduate) and an old-style italic (Cormorant Garamond). Both pages open with a crest heading: gold rules, three stars, BOWL POOL (BOWL CARD on Standings) and the season, which is computed from the season year (2026-27, then 2027-28, and so on). On Standings the matrix keeps its scoreboard layout; the dates, bowl names, and lines now read like a scoreboard header, and the player rows share the heading's serif and gold. Joining the pool is a "Claim your seat" ticket that replaces the old opt-in checkbox: until a player claims it, only the ticket shows on the picks page and on Standings; claiming it brings the whole card in. "Opt out" sits above the picks card until the first kickoff. Picking a team raises a felt pennant in that school's own colors. Every pennant is the same size and lettered with the school's name. The schedule import now saves ESPN's primary and alternate team colors and short school name with each team (migration 20261004010000; teams already saved pick them up on the next import, and a team with no colors gets a navy pennant). Team names replace abbreviations on the picks page and the Standings matrix because many schools share look-alike abbreviations. The pick instructions are a short list. The champion plaque is saved for the League History page.

The Claim your seat ticket states, "You may opt out at any time prior to first kickoff." Standings keeps abbreviations in the Bowl Card matrix so more games fit; school names are used on the picks page, where they matter most.

On the picks page the Bowl receipt is the Slate receipt for a player without Survivor: the same two-section ticket at the same width (79% of the Slate content column on desktop, 75% on a phone). Upcoming Slate games center each team name in its half of the row, so the two names sit the same distance from the line.

Bowl names on the picks page wrap only between words, never hyphenated mid-word, and locations wrap instead of being cut off on a phone. The screenshot sample now includes long names (Salute to Veterans, Frisco Football Classic) to keep this covered.

The Bowl Pool fonts (Graduate and Cormorant Garamond, both SIL OFL) are bundled from the @fontsource packages instead of fetched from Google Fonts, so a build or test run never needs to reach Google. A failed fetch had broken one end-to-end run, and could just as easily have failed a deploy. The rendered fonts are identical.

The test chip on the Operations desk is about twice its old size, turns more readily under a drag (1.9 degrees per pixel, up from 1.2), and a click runs the Survivor toss from whatever orientation it is in: three turns, landing flat and face up.

### Bowl Card scores as flip tiles

Each player's Bowl Pool win total is a two-digit flip tile in the style of the games-remaining counter: navy with gold digits for the signed-in player, cream with navy digits for everyone else. The first time the Bowl Card scrolls into view on a visit, each tile spins on its own (its own pace, each digit turning independently, slowing as it comes in) for about a second, then the tiles land down the line, one about a tenth of a second after the one above it (skipped for anyone who has reduced motion turned on). The score and name cells now share the row's paper color and its top and bottom hairlines, with a thin gold edge where the games begin, so the whole row reads as one.

Survivor chips show each team mark 18% larger than the Pick'em Pad does (still from the same even-size table), so the logo fills the chip face as it did before the sizes were evened out.

The split-flap tiles now run on the browser's animation engine instead of re-rendering the page on every flip, which made them slow and choppy on a phone. Each flip lets the top flap fall (accelerating and darkening as it turns away) and the next card's lower half land with a slight bounce; the last flip before stopping is a little slower, like the mechanism catching. The board paints at a steady 60 frames a second.

The split-flap was still dropping frames on phones. Measured with the processor slowed sixfold (to stand in for a phone), 78 of 175 frames ran late during the spin. Now the flaps fold flat (a vertical squash rather than a 3D turn, which reads the same at this size), every digit keeps a steady rhythm, the moving flaps no longer switch on and off or animate shading, each digit is sealed so a flip never relays out the table, and digits flip about eight times a second. Under the same test 20 of 203 frames run late, and the spin finishes sooner.

### Stylesheet trimmed of overridden declarations

A scan found 88 declarations (in 58 rules) that a later rule with the identical selector sets again, so they could never take effect: mostly leftovers from earlier Bowl Card and receipt restyles that later rules replaced. They are removed, along with the rules for three classes no component uses. All 102 screenshots are pixel-identical. Rules were not moved between sections: gathering the Bowl rules into one block changed 6 to 22 screenshots, because several Bowl rules deliberately follow generic rules they override.

### Standings spacing, sliding tables, and quicker score tiles

Every section on Standings (header, ticket, Pick'em Pad, Survivor Table, Bowl Card) is now separated by one gap, 1.5 rem on a phone and 2 rem on larger screens, the same above the ticket and below the last section (`.standings-stack`). Before, sections carried their own padding, so the gaps were 20, 40, and 56 px. The ticket's spread column is as wide as its widest spread, so spreads end at the dotted rule above them (a fixed 2.25 rem column let a spread overhang it). The space between the season label and the Bowl Card matrix is smaller. The Survivor Table and Bowl Card slide open and shut (`collapse.tsx`, 340 ms, none for reduced motion): content is mounted collapsed and grows, and removed after it shrinks, so a hidden table still costs nothing. The Bowl score tiles wait 350 ms (was a full second) before landing, 45 ms apart.

## Sliding tables: a height animation only (fix for #386)

The first sliding version wrapped the Survivor Table and Bowl Card in a class named `collapse`, which is also a Tailwind utility (`visibility: collapse`); my own stylesheet rule had been masking it, and the grid wrapper let wide tables stretch the page to 904 px on a phone, so both tables looked blank. The wrapper is now `.slide-section` with no styles of its own: content is always laid out and visible, and opening or closing runs a Web Animations height-and-fade on top (340 ms, none for reduced motion). If an animation never runs, the content is still in its correct state. `test/collapse-class-contract.test.mjs` keeps utility class names out of the wrapper. The Standings baseline now records the correct page width.

## Standings spacing reset skips the ticket (fix for #386)

`.standings-stack > section { padding-block: 0 }` also matched the ticket (a `<section class="my-ticket">`) and beat its own padding, so the footer touched the bottom edge. The reset now excludes `.my-ticket` and the loading ticket; the gap between sections is unchanged because it comes from margins.

## Sliding tables roll like window blinds

Opening a table used to skip the slide: the content was measured after it had already painted at full height, so it popped open. The slide now runs in a layout effect from zero height before the first paint, with no fade, on an ease-in-out curve over 420 ms (`collapse.tsx`). Survivor's − OUT / + OUT button rolls the eliminated rows shut and open the same way (`useBlindRows`): hidden rows stay on the page until they have rolled away. Reduced motion skips both.

## Worker activity on phones, test coin, chip edge shading, wider playoff ledger

- Worker activity: its own rules lost to the dashboard's generic table rules (one-line cells and a pill on every second column), so on a phone the dates overlapped and the status became a circle. Its selector now outranks them, and on a phone each run is a card: worker and status on one line, then "Started" and "Finished" lines.
- The Operations test coin flips three turns end over end and lands exactly where it started, instead of snapping to the nearest flat position.
- Chip edge: each rim segment was one flat shade, which showed faint steps between segments up close. Each segment now shades from its neighbor's tone to the next, so the edge reads as one round band. Thickness was left as is: it already matches a real chip (about 8.5% of the diameter).
- Playoff ledger: from tablet width up, every pick of the round sits on one line per player. Each column is only as wide as its longest entry (abbreviations and spreads vary) plus one even gap (1.25 rem on a desktop, narrowing on a tablet so six still fit), and the pad hugs the ledger, centered, instead of stretching across the page.

## Survivor picks in the pick reveal emails

The Sunday and featured-window reveal images now show the Survivor picks made on that window's started games, as a short "Survivor · Straight-up" section under the Pick'em table in the same image: name and team chip, three to a line, green for W and red for L once graded. It is part of the same image rather than a second one, so the email makes no extra image request, and the snapshot adds one small read (that week's Survivor picks on just those games, then the names and teams). Only games that have kicked off are read, so a pick on a later game stays private. Receipts saved before this change have no Survivor field and render exactly as before. Playoff reveals are unchanged, since Survivor ends with the regular season.

## Bowl Card: one line style for the whole table

Adjacent cells each drew their own border, so day breaks were doubled (2 px gold plus 2 px on the next cell, or gold against a navy edge at the tiebreaker), the header's lines were heavier than the rows', and the row rules were a different color. Every line in the Bowl Card table is now one single 1 px old-gold rule: day breaks are a left edge only, the frozen name column carries the edge where the games begin, the tiebreaker has one left rule, and each row has one bottom rule. The older overlapping border rules were removed rather than overridden. Spreads drop the minus sign, since the favorite is always listed on top.

## Live Slate rows take their final layout at kickoff

At kickoff a row used to keep the upcoming layout (centered names, a divider after a wider LIVE badge) and then jump to the final layout when the game ended. A live row now uses the final layout from kickoff: team names and picker lists sit where they will stay, the date column keeps its width, and the LIVE badge is sized to fit inside it.
On a finished or live row the spread's middle is level with the middle of the team names at every width, with or without Survivor chips (it sat about 10 to 14 px high beside the chips).

## Truer split-flap and coin-toss motion; Bowl Card "Special"; no dotted zeros

- Split-flap tiles: the flat squash did not read as a mechanism. Each flip is now two hinged halves turning in real perspective: the top half swings down toward you (accelerating), the next card's lower half follows, hits its stop with a small rebound, and the shading moves with them (the falling flap darkens, it shadows the half it is about to cover, the uncovered half brightens out of that shadow). Only transforms and opacity animate, on the browser's animation engine, so it stays light. Digits still step in order and stop only on their target, the last few flips slowing as the drum catches; a tile now takes a little longer to settle.
- Graduate draws its zero with a dot in the middle, so tiles and the games-remaining counter show its capital O, the same shape without the dot.
- Coin toss: the old toss slowed its spin to a stop like a spinning top. The chip now spins at a steady rate while it rises toward you and falls (height and swell follow a real arc), with a slight wobble, then lands flat and rocks to rest; the ground shadow widens and fades with height. 900 ms (was 680). The Operations test coin uses exactly the same curve, which a test keeps identical.
- The Bowl Card's season line reads "2026-27 Special".
- "Games" and "remaining" stack on two lines above the centered games-remaining counter.

## Bowl Pool picks page: tighter top, boxed team targets

The receipt now sits right under the menu (the page had a large blank band above it), and Opt out is a small link at the foot of the board instead of its own line between the receipt and the board. Each team is a large boxed button (at least 3.1 rem tall, with margin on every side) so a tap can never land on the wrong team; the chosen team's pennant fills its box, and names wrap only between words. On a phone the line has its own lane between the two boxes, wide enough for a spread like -10.5.
Pennants keep their normal size inside the boxes rather than stretching to the box width. The instructions read: "Pick every game." / "A game with no pick counts as a loss." / "Selections lock and are revealed to others at kickoff." / "Tiebreaker is total points in Championship game." (Submit is no longer mentioned; the receipt carries it.)
Opt out returns to the top of the board, as a small link right under the instructions, and the first instruction reads "Participation is optional." on its own line, followed by "Pick every bowl, including playoffs, against the spread."

## Screenshot safety net

Before restructuring the stylesheet and data code, every view and state got an exact-match screenshot (and every email image a pixel baseline) so a change that looks different fails a test instead of reaching a player. New coverage: Bowl Card (graded, champion, claim, closed, minimized), Bowl picks (games started, complete, unsaved, entry closed), the Commissioner desk (six panels in healthy, attention and quiet states, Players, Reminders), Login, Notifications, Week Archive, the rehearsal preview, and 24 email image variants. CI now runs the suite on Linux in the pinned Playwright container (`visual` job); Linux baselines are recorded by the manual `Record Linux visual baselines` workflow and committed. `docs/VIEW_STATES.md` lists every state, its scenario and how to refresh baselines.
In CI the screenshot suite serves a production build (`next build` then `next start`) instead of the dev server: the first attempt, on the dev server, compiled each page on demand and ran 23 minutes with timeouts. A production build renders pixel-identically to the dev server (all 274 Windows baselines match), so one set of specs works both ways and the suite runs in about four minutes. The Bowl Card settle step now scrolls the card into view on purpose instead of relying on a quick scroll passing it.
Every screenshot spec now forces lazy images to load (and waits for them) before capturing; on Linux the old quick scroll did not always bring chip logos into range, so the wait timed out.
## Final scores line up in a column

On finished rows the score and its W/L mark followed the team name, so a longer name pushed its score further right and the scores never lined up (and a wide W nudged the digits left of a row with an L). They now sit in fixed slots at the end of each team's lane (score right-aligned, then a fixed-width mark), so every score on a side shares one edge on phones and desktop alike.
The receipt's warning tab ("You already have 2 selections…") is drawn like the sections above it: its paper is a masked layer with the same corner cutouts and hairline ring, and the dashed rule stays the divider. A screenshot test raises the warning on the Slate to cover it.
The warning tab no longer draws its own dashed top edge: that doubled the receipt's bottom rule and ran past the notches. The paper layer's single rule is the only edge where it meets the Pick'em section.
## Bowl picks page: stacked legend, A/P times, pinned receipt

The legend over the schedule stacks "Date / Time" and "Bowl / Location" on two lines like the rows below (no slashes). Kickoff times use A or P instead of AM or PM ("7:30P"), so the narrow date column stays on one line and no longer crowds the bowl names. The receipt scrolled away because it was sticky inside a wrapper exactly its own height, and a sticky element only travels within its parent; the wrapper itself now sticks, below the site menu, and a test scrolls to the bottom to prove it stays visible.
The Fav, Line and Dog labels are vertically centered in the legend bar next to the two-line labels.
## Coin toss lands cleanly; games remaining is a split-flap tile

- The toss used to land, then rise about a pixel and rock before resting (extra settle stops after the arc, and an end height one pixel off the chip's resting height, which differs between the picked and unpicked states). It is now one continuous arc that ends exactly at rest, lifts measured from the chip's own resting height (`--chip-rest`), so nothing moves after it stops. The Operations test coin uses the same curve, and a test keeps them identical and checks that after the peak the chip only comes down.
- The Bowl Card's games-remaining number is the same split-flap tile as the player totals (drawn larger), so it spins and lands the same way, first. Player rows now land 90 ms apart instead of 45 (starting 90 ms after the counter). The old dotted-zero counter and its CSS are gone.
- The empty corner above Tiebreaker on the date row is the page color, like the corner above Games remaining.

## Smooth sections, varied coin tosses, no stutter after the pad turns

- **One width contract.** The Survivor Table and Bowl Card (collapsed) are exactly the Pick'em Pad's width (`--pad-width`, 30 rem) and centered on it; expanded they grow to the page rail (the Bowl Card further, on a wide screen). The width glides over the same 420 ms and curve as the blind that rolls the table, so the heading stretches and shrinks outward from the center while the table rolls, instead of snapping. Measured: during a collapse both sit centered on the pad's midpoint every frame and end at the pad's exact edges. On a phone, where the rail is narrower than the pad, nothing changes.
- **Coin tosses vary.** Each Survivor chip toss picks its own spin-axis lean (5 to 13 degrees, either way) and speed (0.78 to 1.06 seconds), chosen once when the toss starts; the lean is zero at both ends so the chip still lands upright. The Operations test coin keeps one fixed flip so it can be compared.
- **Pad turn.** The Pick'em Pad now keeps its own graphics layer permanently. When it only had one during the turn, the browser dropped it at the end and redrew the text slightly differently, which showed as a small stutter in the W/L marks after everything had stopped; now the text looks the same before, during and after the turn. The pad's text is drawn marginally differently as a result (screenshots re-recorded).
The screenshot server serves images unoptimized (`NEXT_IMAGE_UNOPTIMIZED=1`, set only by `playwright.visual.config.ts`): the on-demand image resizer built each team logo on first request and sometimes stalled pages on Linux CI for a minute each, so the first CI runs hung until the job limit. Production is unaffected.

## Stylesheet split into feature files

`globals.css` is now just the Tailwind import, the feature imports and the theme block; the rules live in `src/styles/` (tokens, base, slate, receipt, survivor chip, Pick'em pad, Slate rows, ticket, Bowl card, chat, Survivor table, ledger, commissioner, Bowl Pool), imported in a fixed order that is also the cascade order. The split moved no rule: the pieces joined back identical to the old file, and all 278 screenshots passed without re-recording. `scripts/css-report.mjs` counts rules, selectors defined twice, `!important`, hard-coded hex colors and night-mode rules; `test/stylesheet-budget.test.mjs` fails if any of them goes above `test/stylesheet-budget.json` (lower the numbers when a change reduces them, never raise them). `scripts/merge-duplicate-rules.mjs` merges a repeated selector into its later rule only where nothing in between touches the same property family (first run: 60 declarations moved, 2 dropped, 12 empty rules removed). Tests read the stylesheet through `test/helpers/stylesheet.mjs`, so file moves never break them.

## Response shaping pulled out of the routes

The Slate and Home routes and the reveal-email builders mixed database reads with the rules for what a viewer may see. The shaping is now in three modules with no database access (`slate-shape.ts`, `home-shape.ts`, `reveal-rows.ts`), moved without logic changes, and each has tests on fictional rows: pickers named only after kickoff (including the exact kickoff second), a player's own pick visible to them while others' stay hidden with no team, spread or result leaking, picks kept in kickoff-column order, official lines over preliminary ones, and reveal images including only revealed games from this period. One existing quirk is pinned rather than changed: a line row whose spread is null reads as a pick'em in the reveal label (it cannot occur, since official lines always carry a spread). Not done in this step, on purpose: splitting the Slate page's state into hooks, whose rows depend on being redrawn only when their own game changes; that is worth doing only with the performance check beside it.

## Slate page rules pulled out of the page

The Slate page's decisions now live in `src/lib/slate-view.ts` with no React in them: what a click on a team does (add, swap, remove, refuse at the limit, sealed once the game has kicked off, to the second), the Survivor used-team rule (a used team is refused except the one chosen or the saved one during an unsaved replacement), whether a receipt removal is allowed, the Eastern-day grouping, the Pool Action filter (upcoming games, plus started ones with public picks), the receipt's list of selections (game order, signed lines, home/away casing, removability, saved flag) and the unsaved-changes check. The page keeps its state and effects and applies these results with the same updates as before, so its rows still redraw only when their own game changes. Measured under a 6x CPU slowdown over 16 pick clicks on a phone-width Slate: script time 0.13 to 0.14 s before, 0.14 to 0.15 s after (within run-to-run noise). The page's loading and saving effects were deliberately left in place.
## Screenshot specs wait for decoded images

One Linux screenshot (Standings, regular-in, tablet width) failed once on main after a merge, in a 528-pixel band of the Survivor logos, and passed on the very same code in the pull request run and on every rerun. A loaded image counts as complete before it is necessarily decoded, so a capture could catch a logo mid-draw. Every spec now also waits for each image to decode before it captures.
Dependabot now skips ESLint major versions: ESLint 10 breaks the React lint plugin bundled in `eslint-config-next` (`getFilename is not a function`), which fails the lint step on every run, so its pull request is closed rather than left failing. Revisit when Next's lint config supports ESLint 10.

## Survivor logos masked in the Standings screenshots

The Standings screenshot failed again on Linux CI in a different case (night, phone), and on two more pull requests: the same band of about 550 pixels in the Survivor logo row, every time, in a few percent of runs. Zoomed in, the logos are the same but drawn with a very slightly different downscale (they are large originals scaled to about 28 px). Waiting for images to decode did not remove it. The Standings pictures now mask the Survivor logos: each logo's box (so its position and size) is still compared, only the artwork inside it is not. The masked screenshots were re-recorded for both platforms.

## Sentry 11

The Sentry 10 to 11 upgrade needed two changes. `withSentryConfig` moved to `@sentry/nextjs/config`, so `next.config.ts` imports it from there (the old import failed the build with "withSentryConfig is not a function"). And `sendDefaultPii` was removed: its replacement is the `dataCollection` group of options, whose defaults collect cookies, request headers, user details and local variables. The old line no longer type-checks, and simply deleting it would have quietly started sending that data, so all three setups (browser, server, edge) now use one shared `PRIVATE_DATA_COLLECTION` that turns every category off, with a test that fails if any setup stops using it.

## Survivor table opens and closes without a hitch

The Survivor toggle waited for the server before changing anything, so the roll started a network round trip late, and the page redrew three times around it: a "saving" flag on, the choice applied (the roll starts here), and the flag off, which landed in the middle of the animation. The Bowl Card went through the same steps but its own content does less work per redraw. All display choices (Survivor table, Bowl Card, hide eliminated rows) now go through one helper: the choice is remembered and shown at once, the save runs in the background, a failed save puts the old choice back with an error message, and a second tap during a save is ignored by a ref, not a state flag, so nothing redraws mid-roll. Each Survivor row is also its own memoized component, so a redraw of the table does not rebuild every logo. Measured under a 4x CPU slowdown, script time per toggle dropped from about 0.113 s to about 0.067 s, and the two extra redraws are gone. A test pins the order (remember, show, then save) and the revert.
Found by measuring the position of the Bowl Card under the Survivor table frame by frame: when the Survivor table finished rolling shut, everything below it dropped 11 px at the very last frame. The gap under the heading was the heading's own bottom margin. While the (zero-height) rolling wrapper was still in place that margin stayed in the section's height; when the wrapper was removed at the end it collapsed through, and the section shrank by the gap in one step. The gap now lives inside the rolling wrapper as the content's top margin (the wrapper contains it), so it travels with the table: the same layout when open and closed as before, and the last step of a close is now under 1 px.

## The Bowl Card no longer pops in, and "− OUT" ends without a jump

The Standings page showed itself as soon as its own data arrived, and the Bowl Card filled in a moment later, so it appeared out of nowhere. The page now keeps the loading shell up (with the real page laid out but hidden beneath it) until the Bowl Card reports its first load finished, whether it worked or not, or 2.5 seconds have passed.

The "− OUT" roll jumped 3 px at its last frame. Measured frame by frame: browsers draw a border under one pixel as a whole pixel, so each hidden row kept its 1 px bottom border until it left the page, and the last visible row also loses its border when it becomes the last row. The roll now takes the borders back with a negative bottom margin, which animates smoothly, and releases the held animations in the same render that removes the rows. The last step went from 3 px to 0.

## 2026-10-05 — Validate save payloads at the boundary and limit launch-holder fallback

Pick'em and Bowl Pool save requests are parsed as unknown input before slate
lookups or writes. Invalid array entries, IDs, duplicate games, oversized
selection sets, and invalid Bowl total guesses receive a deliberate client
error. The Pick'em parser preserves the distinction between no Survivor field
and an explicit clear; database functions still enforce the competitive rules
and atomicity. The known inaugural Survivor holder display fallback applies
only to the uncrowned 2026 launch season. A later season without a recorded
champion displays no holder instead of silently reusing a name match. This
fallback changes display only, never a championship record.

## Sections now open to their exact height

When the Survivor table finished opening on desktop, the Bowl Card below moved down about 0.4 px and came back. The blind measured its target with `scrollHeight`, which rounds to a whole pixel, so it stopped up to half a pixel off and corrected itself when it let go. It now measures the content's height to a fraction of a pixel, and an opening blind also follows the content if its height changes while opening (the table wraps differently as it glides wider). Measured at 1280 px: the last steps are now 1305.11, 1305.75, 1305.78, 1305.78 with no overshoot.

## 2026-10-05 — Share viewer-safe Slate and Standings response contracts

The two player pages and their routes now compile against the same response
types. Database rows remain distinct from viewer-safe JSON, so this does not
weaken kickoff privacy. The application explicitly recognizes the three
Survivor entry states allowed by the current database CHECK constraint and
fails visibly if a future schema adds a state without a display rule. A local
`typecheck` command supplies fast contract feedback; the production build
continues to enforce TypeScript in CI.

## 2026-10-05 — Mark the privileged Supabase client server-only

The application Supabase client uses a service-role credential and must never
be reachable from a Client Component. Mark its single privileged entry module
with Next.js `server-only`, which makes the framework fail the build if a
client import is added directly or through another module. Keep browser reads
on the publishable-key client and viewer-safe API routes instead.

## 2026-10-06 — Share active-player access across the primary pool routes

Standings, Slate, Survivor, and Bowl Pool now use the same request-scoped token and active
profile verification as Pick'em saves and Season Snapshot. A temporary Auth or
profile read failure returns 503 instead of appearing to be an invalid session
or inactive player. Verified inactive players receive 403. The Standings profile
query also retrieves its display preferences, replacing its separate viewer
read; the pool's season and player-list reads remain independent. Successful
response shapes and database scoring/mutation rules are unchanged.

## 2026-10-06 — Separate the player PIN from the Auth credential

Keep the familiar four-digit pool PIN, but never use it or a predictable
transformation of it as the Supabase Auth password. Derive a versioned,
high-entropy credential on the server with HMAC-SHA-256 and a dedicated,
server-only `PLAYER_AUTH_PEPPER`. It is intentionally independent of the
Supabase service key so routine key rotation cannot lock out players. Launch
preflight treats a missing or weak pepper as a blocking configuration error.
New accounts receive the protected credential immediately.

The transition shipped with a temporary legacy fallback and a Commissioner-only,
explicitly confirmed bulk rotation. Production verification completed on
2026-10-06: all 11 player accounts were rotated, preserving their PINs and
recording only aggregate counts in the audit log. The fallback is now removed;
future pepper rotations must use the audited bulk operation before the new
credential is required.

Enforce a site-wide Content Security Policy alongside the existing response
headers. Production dependencies block at high severity; the complete tooling
tree blocks at critical severity. Any lower development-only advisory exception
must be specific, dated, owned, and documented rather than hidden by a broad
override or a permanently weakened gate.

## Off-season engine: one definition of "the season is over"

The season runs from August 1 (Eastern) until the Super Bowl is final and graded. `public.season_phase()` answers this in the database: the current season-year row is complete and its Super Bowl period is complete (the existing state trigger already marks a season complete when every period is). At 12:00 AM Eastern on August 1 the season year turns over, the new year has no completed Super Bowl, and the phase flips back to in season with no button to press. `public.bowl_window_open()` is the Bowl Pool's own window: December 1 until its champion is crowned, never in the NFL off-season. `src/lib/season-phase.ts` holds the same rules for the application, and one table of scenarios (`test/helpers/season-phase-scenarios.mjs`) runs through both, from the Super Bowl through July 31 and the August 1 rollover.

Outside their windows the line-lock, reminder and Bowl dispatchers return false inside Supabase, and the score worker, the pre-lock spread refresh and the email-schedule reconciliation (which call Vercel straight from pg_cron) carry the same `where public.season_phase() = 'in_season'` gate, so an idle off-season tick never wakes a function. The cron routes also answer `{ skipped: true, reason }` before taking a lease, as a second layer. Job names, schedules and URLs are unchanged, so Launch Preflight still passes. The preseason bootstrap (which performs the August 1 rollover) and the watchdog stay ungated. If the phase cannot be read, the routes treat it as in season: a skipped worker during live games costs far more than one wasted summer run. Reminders still queued when the Super Bowl is graded wait until August 1.

## Off-season player experience

After the Super Bowl is graded, `/api/home` and the Slate's bootstrap response carry `seasonPhase`, computed from the season and period rows each route already reads (no extra query). In the off-season the player pages show a "See you next season!" banner (navy and gold, like the Bowl Card crest) in place of the ticket and the Slate receipt, and so do the pages of a player who has been eliminated from the playoff race (they return with everyone on August 1). The Standings tables render whole whatever the player had hidden (the stored choices are suspended, not erased), and the table "−/+", "− OUT" and Bowl Card hide buttons are not drawn. The Slate becomes a read-only record: no receipt or Submit, no how-to-pick copy, no Survivor chips. Stale tabs are covered on the server: `/api/picks`, `/api/survivor`, `/api/bowl-pool` and the display fields of `/api/profile` answer 409 `season_closed` before reading or writing anything. Notification settings, the Pool Action filter, Pool Chat, the Season Snapshot and its controls stay available. A missing `seasonPhase` means in season, so an older cached response never locks the pages.

The banner for a player eliminated from the playoff race reads "You have been eliminated, thanks for playing." and replaces the Slate's old red "mathematically eliminated" box. The ELIMINATED stamp in the Pick'em Pad was shrunk and straightened so it stays inside its own row (it used to spill into the row above), and the Super Bowl round keeps each pick with its W or L on one line on narrow phones. The playoff Standings screenshots were re-recorded for the smaller stamp.

The Pick'em Pad is now titled "Pick'em Pad" in every round (it read "Playoff Ledger" in the playoffs), and the playoff round name sits on the pad itself, centered under the title like "Week 5" in the regular season, instead of in the top right of the masthead. On phones the round row spans the whole pad. Playoff Standings screenshots were re-recorded.

## Season Snapshot: Season / Playoffs switch

Once the playoffs begin, the Season Snapshot used to show only the playoff chart and hid the 6 Wk / All range. It now has a two-part Season | Playoffs switch right after the graph title (equal-width halves, the same look as the range toggle). It opens on Playoffs, remembers the last choice on the device (read when the pad is first turned over, like the range), and shows the 6 Wk / All range only on Season. Before the playoffs there is no switch. On phones the range drops to its own line under the switch so nothing overflows the pad. It stays available in the off-season: it is archive browsing.

On phones 380 px wide and narrower, the playoff ticket lists a round's picks in one column (two columns made team names wrap mid-name, "Tennessee / Titans") and the Pick'em Pad shows five or six picks in two columns and three short lines (three columns ran the last pick off the edge). Wider phones are unchanged.

## Generated database types

`src/lib/database.types.ts` is generated from the isolated database after the migrations apply (`npm run db:types`; the manual run of the isolated workflow with `write_database_types` produces it as a download). Both Supabase clients use it. The isolated workflow checks that it still matches the schema (`npm run db:types:check`) on the weekly run, on a manual run, and on any pull request that touches migrations or the types file; an unrelated pull request is not failed because the shared isolated database briefly holds another branch's migration. The application build and the fast tests only type-check the committed file and need no database.

Turning the types on found real problems, each fixed rather than cast away:
- The Bowl daily recap read `players(first_name, last_name)`, but `players` has no `last_name`, so its standings query would have failed in December. It reads `first_name` only, like every other name in the pool.
- Seven hand-written game-status lists disagreed about `no_contest` (three omitted it). `src/lib/db-statuses.ts` is now the single list, checked against the migration's CHECK constraint, and the Slate row no longer labels a no-contest game LIVE after kickoff (it says NO CONTEST).
- Nullable team ids on Bowl games (teams are unknown until a matchup is set) are handled explicitly in the Bowl route and the commissioner exceptions list.
- Four mutation routes use a `gameId` or `status` captured after validation rather than a possibly-undefined property.
- A few arguments the database accepts as NULL (the Bowl tiebreaker guess, the next period when the last one completes) keep a one-line cast with the reason beside it, because the generated types cannot express a nullable argument.

Still open, found by the same check and deliberately not changed here (it is a data-model decision, not type adoption): the ESPN Bowl sync stores a provisional line with `locked_at = NULL` before kickoff and later looks for lines `where locked_at is null`, but `bowl_pool_game_lines.locked_at` is `NOT NULL default now()` and no migration relaxes it. As written, saving a pre-kickoff provisional Bowl line would be rejected by the database. Fixing it means a migration that makes the column nullable and a review of the grading and matchup-identity triggers that treat the existence of a line as "locked".

## Every body-reading mutation route validates its input first

Request bodies are read with `readJsonObject` (`src/lib/request-validation.ts`), which returns an object or null, so malformed JSON, `null`, an array, a number or a string can no longer reach a route's property reads (several routes threw a TypeError, a 500, on a `null` body). Each route's fields go through a small parser in `src/lib/request-bodies.ts` (ids, enums, bounded text, integers) and the route answers 400 with its existing wording before it reads or writes any pool data. Covered: Bowl exceptions, game disruptions, new players, standard email wording, test email, Bowl schedule import, Survivor, pool chat (send and delete), profile, and the email preview. Picks and Bowl saves already had `parsePickSubmission` and `parseBowlSubmission`; sign-in and the credentials hardening already checked their one field.

One behavior change worth knowing: the Survivor save used to treat a body with only one of `gameId` and `teamId`, or an id of the wrong type, as a request to clear the player's unlocked pick. A half-formed request now gets a 400 and the pick is untouched; clearing still works with no ids (or both null). The page itself never calls that route (it saves Survivor with the pick submission), so no screen changes.

The inaugural Survivor champion is no longer found by matching a first name. The Standings show the 2025 Survivor champion from the recorded championship history (`pool_championships`, season_year 2025, pool survivor, still active), only in the uncrowned launch season (2026); every later season shows no champion until its own is crowned. A player simply called John with no recorded championship is not the holder.

## One authentication result for every protected route

Player routes already used `authenticateActivePlayer`. The Commissioner gate (30 admin routes) and the profile and chat routes had their own copies of token verification with weaker semantics: a sign-in outage threw (a 500) and a database error during the player lookup was reported as "Commissioner access is required", so a brief outage looked like lost permissions. They now sit on the same result: 401 for a missing or invalid session, 403 for an inactive player or an ordinary player on a Commissioner route, 503 for a sign-in or database outage, 500 for missing configuration, each with a stable `code` and a plain message (`accessDenied` in `src/lib/access-response.ts`).

The old helpers returned a player or null; their replacements (`commissionerAccess`, `profilePlayerAccess`) return the result object, and the old names were removed so a leftover `if (!(await ...))` could not compile into a check that never fails. A test also scans the source for it. Visible change: a Commissioner call with no or an expired session now answers 401 (the browser session helper refreshes and retries that once) instead of 403. Executable tests cover each failure category on representative Commissioner, profile and chat routes, and the browser session helper (refresh near expiry, hydration window, shared session read, 401 refresh-and-retry, no retry of an uncertain save, and a player switch clearing the previous player's cached reads).

## The Pick'em Pad's "− OUT" rolls too

The Survivor table's "− OUT" rolled its rows away like a blind, but the Pad's snapped. A table row cannot shrink on its own, so the Pad rolls the box around the table instead: from its old height to its new one, with the hidden rows kept on the page until the box has rolled shut (and put back at once when shown). The target accounts for the row above the hidden ones losing its bottom border, so the page below lands on its final position without a last-frame jump. Measured at 390 px: hide 1111 to 1092 and show 1092 to 1111, both smooth, no overshoot.

## Bowl lines lock the morning of game day, like the NFL

A Bowl line is preliminary until the game-day morning lock, then fixed. `line_lock_at` is now 8 AM Eastern on the game's day (the NFL rule, `getLineLock`), set by the provider sync and by the schedule CSV import; it used to be the kickoff time itself. Until the lock, the sync keeps the latest provider spread on the line row with `locked_at` empty (the Bowl pages already show that in black and the locked line in teal); at the lock `locked_at` is filled and the line never changes again.

This needed a migration (`20261007020000_bowl_provisional_lines.sql`): `bowl_pool_game_lines.locked_at` was `NOT NULL DEFAULT now()`, so the preliminary line the sync wrote would have been rejected by the database, which the generated types exposed (see "Generated database types"). The column may now be empty and has no default, and the matchup guard (`protect_bowl_game_identity`) freezes a game's teams and kickoff only for picks or a locked line, so a provider moving a kickoff while the spread is still preliminary no longer breaks the sync. Health, integrity and the official-lines email count only locked lines. Grading is unchanged: it uses whichever line exists when the game is final, which is the locked one in normal running. The lifecycle test fixtures lock their lines explicitly now that the default is gone.

Also: type generation retries when the container registry rate limits the CI runner ("toomanyrequests"), which failed the first attempt of this change.

## Measured route costs and regression budgets

`npm run measure:routes` runs the real `/api/home` and `/api/board` handlers against season-sized fictional fixtures and an in-memory database (`test/helpers/fake-pool-database.mjs`, which fails loudly on any query feature it does not support) and counts database requests, rows, database bytes and response bytes for four scenarios (early season, late season, a playoff round, late season with three prior seasons on file). `test/route-cost-budgets.json` holds a ceiling for each, the measured value plus 15%, and `test/route-cost.test.mjs` fails a change that exceeds one or makes history reads grow. Only deterministic counts and sizes are gated; latency is reported (docs/RESPONSE_COST_BASELINE.md) and never fails a build. The first finding is the Standings read of the whole season's picks (about 64 KB at week 16 to build an 8 KB response), the leading optimization target; an optimization should lower the ceilings in the same change.

## The Slate page's state is one reducer

The Slate page held 28 separate `useState` values, set from five different async paths. `src/lib/slate-state.ts` replaces them with one reducer and five clearly separated parts: what the server last said (games, weeks, Survivor facts, playoff status, season phase), the draft being edited, what was last saved, which load is current, and the save in flight with its warning. Every transition is a named, pure action covered by `test/slate-state.test.mjs`. Rules that were scattered across effects now live in the reducer: only the latest load may apply (a slower, older week can never replace a newer one, and a stale failure cannot end a newer load), a kickoff refresh replaces the games but never the draft, and a save records the picks that were sent rather than whatever the draft became while it was in flight.

One behavior was added, from the improvement plan: when a save ends without an answer (timeout or dropped connection), the page now reads what the server holds before offering another submission. If it matches what was sent the save worked and nothing is left unsaved; if not, the draft is untouched and the player can retry. Markup and classes are unchanged: all 62 Slate screenshots are identical, and `test/visual/slate-flow.visual.spec.ts` drives the real page through choose-and-submit, a failed save and a lost-answer save. The Standings page was reviewed and left as it is: its remaining state is a single data object plus the display-preference override, which already has its own tested helper.

## Workers stop cooperatively at their deadline; score decisions are pure

Each automation run now has a deadline context (`src/lib/execution-context.ts`, per run through AsyncLocalStorage so no worker signature changed). When the deadline passes the lease runner still releases the caller and keeps the database lease until it expires, and now also cancels the run, which stops at its next checkpoint instead of starting more work. Checkpoints sit between stages and before each commit, never inside a database call or after a commit, and the outside requests carry a signal that fires on cancellation. A run stopped by its own deadline is not counted as a provider failure (it adds no retry delay). The abandoned run's rejection is handled so it cannot surface as an unhandled rejection.

The score worker's decisions (due games, eligible games, cadence, the paid-allowance hold) moved into `src/lib/score-work-plan.ts` as pure functions with their own tests; the worker's behavior and timing are unchanged. The stage order and what is safe to repeat are written down in `docs/WORKER_STAGES.md`. The line-lock worker got the same checkpoints; the reminder and Bowl workers follow in the next change.

## Reminder and Bowl workers: the same deadline handling and pure decisions

The reminder worker checks for a stopped run once per claimed reminder, before anything for that reminder, and never inside delivery. A run stopped there hands this reminder and every later one back to the queue at once (they had not started), rather than leaving them `sending` for the 20-minute stale-claim recovery. What each outcome becomes (not ready, delivered, failed, retry, release) moved into `src/lib/reminder-outcome.ts` as pure functions with tests; the statuses and the 15-minute retry are unchanged. The Bowl worker has a checkpoint before each stage and all three of its provider requests carry the cancellable signal; its line rules (half-point hooks, the favorite from ESPN's sign, the lock stamp, when a line is due to lock) moved into `src/lib/bowl-line-policy.ts` with tests. Behavior and timing are unchanged. Stages and retry safety for all four workers are in `docs/WORKER_STAGES.md`.

## Clean-up policies: line endings, screenshots, and what a test may pin

- **LF in the repository.** `.gitattributes` sets `text=auto eol=lf`; 37 files that had CRLF or mixed endings were renormalized once. A test used to pass or fail depending on how a file was last saved.
- **Only Linux screenshots are committed.** CI only ever checked the `-linux` PNGs; the `-win32` ones went stale (318 files). Local runs record their own with `-u` (ignored by git): record from `main` first, apply the change, rerun without `-u`, and bisect any mismatch to the exact rule. Email-artwork baselines stay per platform.
- **Tests do not pin CSS text or markup details.** The screenshot suite already fails on any pixel change, more strictly and without breaking on harmless refactors. 17 test files and 41 assertions that matched rule text were deleted. A new visual state gets a screenshot state, not a regex.
- **Screenshots wait for what moves.** The Season Snapshot chart redraws after a toggle; baselines recorded on its first frame later disagreed with settled checks and flaked on three PRs. The spec now waits for running animations and two painted frames.
- **Why `!important` mostly went.** Tailwind v4 utilities are layered and our stylesheet is not, so our rules already win without it. Removing it was bisected against local baselines recorded from `main`; the 11 that remain each changed a pixel when removed.
- **Palette names.** Primitive colors are named by hue family and lightness (`--sand-93`), theme pairs by role (`--themed-bg-2`: light value in `:root`, night value under `html[data-theme="night"]`). A night rule becomes a token only for literal colors and global tokens, and never where its extra specificity was beating a more specific light rule.

## The Standings read no longer loads every pick of the season

`/api/home` computed each player's win total from every pick of the season (all columns, every result). It now makes two narrow reads: this week's picks in full (the pad shows them) and only the player ids of winning picks for the totals, which is all `countPickemWins` ever counted. Measured by `npm run measure:routes`: week 16 database bytes 77,570 to 27,834, divisional round 95,726 to 36,305, response bytes unchanged, one extra request. The route-cost ceilings in `test/route-cost-budgets.json` were tightened to the new numbers. A database-side aggregate would cut it further but needs a migration; this change needs none.

## One table of scoring scenarios, run through the application and the database

`test/helpers/scoring-scenarios.mjs` lists 16 cases (covers, pushes on whole-number lines, pick'em lines, tied games, blowouts, a missing line). `test/scoring-scenarios.test.mjs` runs them through `gradeAtsPick` and `gradeSurvivorPick`; `test/integration/scoring-scenarios.test.mjs` runs the same table through `finalize_games_atomically` in the isolated database and compares every ATS result and Survivor status. A new scoring rule adds a row, so the two layers cannot drift. The one deliberate difference is recorded in the table: the database refuses to finalize a game that has ATS picks but no official line (the whole call fails and nothing is graded), where the application rule alone would call that pick pending.

## What the remaining source-reading tests are, and the guard that stops new CSS-text tests

After the stylesheet and screenshot work, 952 assertions in about 190 tests still read source text. By what they read: Supabase migrations and SQL contracts (about 250, run for real by the isolated database workflow as well, so kept), repository rules (workflows, `vercel.json`, docs links, security headers, Sentry setup; about 110, kept as rule checks because there is nothing to run), route and library code (about 280, candidates for tests that run the code with the fake database), and component source (about 180: some are labels the screenshots cover, some are behavior such as stale-response guards and polling that pauses while hidden, which need browser flow specs). The screenshot-covered ones that remained (chip-toss layout, loading-shell widths, rolling-row CSS details, email layout) were deleted. `test/test-policy.test.mjs` now fails any test that reads the stylesheet's text, and `AGENTS.md` says to add a screenshot state instead.

## A lost Survivor entry reads IN until it is officially out; trophy titles name the season as played

A Survivor entry that loses is not out until another entry makes a correct pick in the same week: if everyone left loses together they share the title (the 2026-10-02 co-champion rule). The Standings therefore show a lost entry as IN until `officiallyOutEntryIds` finds another entry's winning pick in the week it was eliminated; the database status is unchanged and every other surface keeps its wording. Trophy hover titles now name the season as it is played, `'25-26 Bowl Pool Champion`, instead of `'25`, since the NFL season runs into the next year (`championshipTitle`).

## The Survivor trophy sits on the reigning champion

The trophy beside a name in the Survivor table used to show for anyone who had ever won Survivor, so after a new champion was crowned the previous one kept it too. It now shows only for the champion (or co-champions) of the latest season that has one (`reigningChampionIds`); a new champion takes it from the last. Every earlier title stays in the player's hover text. The Pick'em and Bowl trophies are unchanged.

## The Pick'em and Bowl trophies follow the same rule

Like the Survivor trophy, the Pick'em and Bowl Pool trophies beside a name now show only for the champion (or co-champions) of the latest season that has one (`reigningChampionIds`); a new champion takes the trophy from the last. A player's hover text still lists every title they have won.

## Dependabot opens one pull request a week for minor and patch updates

A Monday burst of Dependabot branches (three npm pull requests plus a workflow one, on top of normal work) made GitHub rate-limit Vercel's repository fetch, and Vercel emailed "Preview deployment failed ... GitHub fetch error 403 ... secondary rate limit". The deployment was one that `scripts/vercel-ignore-build.mjs` would have skipped anyway, so nothing was lost, but the email was noise. Dependabot now groups all npm minor and patch updates into one pull request (majors stay separate) and the actions updates into one, at 05:00 and 05:30 Eastern on Mondays, so far fewer branches appear at once.

## A polish pass: the gold rule is static, the receipt stays shorter for players who are out, and the display switch

- **Bowl Card gold rule.** It no longer draws or fades in when a page loads or refreshes. It starts at the right width (the ticket's while the card is collapsed, the Survivor Table's while open) and moves only when the card is opened or closed. The draw animation remains on the Assets page only, where it is tuned.
- **Survivor on the Slate receipt after a champion.** The section still stays for the week the champion is crowned in, but only for players who were still in or were knocked out that week; a player who was already out keeps the shorter Pick'em receipt.
- **Phone nav.** The NCAA Bowls tab keeps its place (hidden until it applies) so the tabs never slide when it appears after the page loads.
- **All games / Pool action.** The 3D toggle became a two-option control with the chosen option filled in the page's ink color, full-size tap targets and no night-mode overrides.
- **Slate instructions (desktop).** PICK'EM and SURVIVOR start at the same left edges as the notes columns beneath them.

## Survivor trophy titles name one year

Pick'em and Bowl Pool trophy titles name the season as it is played across two calendar years (`'25-26 Bowl Pool Champion`). Survivor is decided within a single calendar year, so its titles read `'25 Survivor Champion` (`championshipTitle`).

## The loading football turns on the compositor; the look stays Monday's

A recording of the live football showed it hitching while the page loaded: the spin stepped `background-position`, which Safari repaints on the busy main thread (8 skipped beats in the first turn, a freeze just before the page appeared). The ball is now a clipping window and the 108-frame sheet slides inside it by `transform` (one held keyframe per frame), which the phone runs off the main thread. A phone test page ran both side by side on the same recording: the old method showed 42 doubled steps in 218 refreshes against about 20 for the transform method.

The ball itself is Monday's (the half-wrap stripes sheet from #506). Two attempts to change its look were tried and dropped: stripes wrapping the whole ball (#523) and thin dark panel seams (#524) both made the motion steadier on paper, but the owner preferred Monday's ball. Do not re-chase the "pulse" by redrawing the ball without asking first.

Wobble no longer runs by default (its size was already 0). The Workshop turns it on only when its Wobble size slider is above 0.

## The Survivor instruction goes away for a player who is out

"Click a poker chip to choose a team." (the SURVIVOR line in the Slate's instructions) now shows only for a player who is still in Survivor that week. A player who is out, or whose Survivor section has left the receipt, no longer sees it. This replaces the earlier rule that the line showed for everyone while Survivor was part of the slate.

## The Slate ticket sits first, and its notices cover the board

- **Position.** The Slate's receipt now starts flush under the menu, the same place the Bowl Pool's does (104 px down on a phone, 82 px on desktop), so switching tabs never moves it. The week picker and instructions follow it. It stays pinned as before.
- **Notices cover, never push.** The "picks are full" question and the plain selection warnings hang off the bottom of the ticket over the board instead of adding height to it, so nothing below jumps. The swap question is a second stub across the ticket's width: a small "PICKS ARE FULL" eyebrow, "Replace which one with NYG?", the two picks it could replace as chips in the same style as the picks above, and Cancel as a quiet link.
- **One-line status.** The Pick'em line at the foot of the ticket is one line at every phone width. "CHANGED - HIT SUBMIT" became "CHANGED" (the stub already says READY TO SAVE) and "EDITABLE" became "OPEN"; a test checks the longest states at 360, 390 and 700 px.

## The Season, Bowl Pool, Players and Email screens use the desk's own controls

The tools inside the Commissioner desk (and the Players and Email center pages) now share the Clubhouse look instead of the old plain boxes: forest buttons (`desk-button-solid`) in place of black ones, status boxes with a left bar in the desk's green / amber / red (`desk-status` with `is-ok`, `is-warn`, `is-alert`) in place of the pale tinted boxes, a quiet paper panel (`desk-panel`) for nested blocks, gold hairline rules (`desk-rule-bottom`, `desk-rule-y`) in place of the heavy black ones, and paper inputs (`desk-input`). Wording, order and function are unchanged. The sign-in page keeps its own black button.

## The Slate and Standings paint their data as a transition

When a page's data arrives, the whole Slate (or Standings) used to render in one uninterrupted piece of work, which froze the phone for a moment just before the page appeared (a ~0.17 s freeze in the recordings). The state update that applies the data is now a React transition, so React renders it in slices and yields between them, and the loading football keeps turning while the games appear. Measured on a production build with a 4x slower CPU (a phone-like load of the Slate with the data arriving 600 ms in): the reveal went from one main-thread task of about 92 ms to none over 50 ms; the first-load JavaScript task (about 190-270 ms, before the data) is unchanged. Failures, saves and every pick change stay urgent updates. The remaining startup cost is the shared JavaScript (Next, React, Sentry and its error-replay recorder are about 0.75 MB uncompressed); trimming that is a separate decision because the replay recorder is how errors get diagnosed.

## The post-deploy smoke gate also loads the pages

After each production deploy the smoke gate already checked the health endpoints. It now also loads the home page, the Slate (`/board`) and the Bowl Pool (`/bowl-pool`) and requires each to return HTML with status 200, and fetches the loading football's picture (`/football-spin.webp`), which must be an image. A deploy that serves a broken page or loses the football now fails the gate within minutes, before a player finds it. The checks are read-only GETs; the pages are the signed-out shell, so they prove the app and its assets are being served, not that data is right (the health endpoints cover that).

## Stylesheet: 36 unused colour and spacing variables removed

A scan of every custom property the stylesheet defines against everything that reads one (CSS, components, Tailwind classes) found 36 that nothing reads, 62 declarations in all (old theme slots, asset-card and snapshot colours, unused spacing steps). They are removed; nothing renders differently. The hex-colour budget is lowered to 252.

## Stylesheet: dead rules removed

A scan for rules whose classes appear nowhere in the app any more found 12 (the Commissioner map's old metric tiles, a release tile, a grading-dashboard grid override), and one block in the Bowl card stylesheet that sat inside a comment that never closed until the next comment, so about 38 lines of rules were switched off by accident and had never applied. All of it is removed; no screenshot changes (the Bowl, Standings and Slate suites compare identical). The duplicate-selector budget is lowered to 89.

## The Trophy Room (Commissioner only)

A Commissioner-only page (`/admin/trophy-room`, linked from the desk's header as "Trophies") lists every season's champions (Pick'em, Survivor, Bowl Pool; co-champions kept; a pool with no crown shows "Not crowned") and an all-time table scored like a batting average. It is read-only and built from existing records (`pool_championships`, `bowl_pool_championships`, and graded Pick'em picks).

- **At bats (AB)** are graded Pick'em picks. A push is a loss; voided and pending picks never count, so it follows the pool's own scoring rules.
- **Hits (H)** are covers; **AVG** is H / AB; **SLG** counts a cover on the favorite as a single and on the underdog as a double.
- **Best season** is the highest average over a season of at least 20 picks; **streak** is the longest run of covers in kickoff order across seasons.
- **Survivor exit** is the average regular-season week a player was knocked out of Survivor, with the number of exits (a season still alive, or won, is not an exit and is not averaged in).
- The Bowl Pool is a separate game and is not part of the batting table: its champions appear only in the season plaques.
- A player is ranked once they reach 50 at bats; everyone else follows in an "Under 50 at bats" group. A champion from a season with no pick history on file (the inaugural year) still appears, with no at bats.
- The numbers come from one pure function (`src/lib/all-time-stats.js`) with its own tests; the route only reads and hands rows to it. Players do not see this page yet.

## The Trophy Room's all-time table is just wins and hit rate

The all-time table is now three things per player: **Wins** (picks that covered, across every season on record) and **Hit rate** (wins divided by graded picks, written like a batting average), and each sorts on its own (tap a heading; a second tap reverses). Hit rate ranks players with at least 50 picks first so a young player's one lucky week cannot top the table; Wins ranks everyone. The earlier columns (at bats, slugging, best season, streak, Survivor exit, titles) are gone from the table; titles live in the season plaques. A season with no recorded champion for a pool reads "Not recorded" rather than "Not crowned", because the database cannot tell a pool nobody won from one that was never entered (the Bowl Pool, for example, started after the 2025 season).

## The Trophy Room shows the three trophies

The Commissioner's Trophy Room now opens with the three trophies as pictures: Pick'em (a white marble pillar in a gold exoskeleton, twelve plates), Bowl Pool (a gold pennant cup on a walnut drum, ten plates) and Survivor (a crystal spade holding a fixed "SURVIVOR · Last Man Standing" chip, five plates). They are 3D renders, saved as three small JPEGs in `public/trophies/` and shown with `next/image`, so they add no server work. The plaque names in the pictures (Steve, Al, John, all 2025) are part of the artwork, not read from the database; a new season needs the pictures re-rendered or the names overlaid on the page. The Bowl Pool's 2025 champion (Al) is still not recorded in the database; recording it is a separate, reviewed migration.
## Night mode for Tailwind's greys, greens and reds is a set of theme variables, not class-name rules

Night mode used to find text and borders by matching their Tailwind class names (`[class*="text-slate-"]`, `[class*="border-zinc-"]` and about thirty more selectors), which silently broke whenever a class was renamed and forced `!important` on every border. Night now redefines Tailwind's own colour variables in the night block of the token file: text in the slate, green and red shades used for text becomes one soft colour, and every border shade becomes the theme's rule colour. A shade is used for only one purpose, so the few places that used the same shade as text and as a fill or border moved to named role tokens (`--ink-faint`, `--fill-ok-solid`, `--fill-danger-solid`, `--fill-track`, `--page-cream` and others). The Bowl Card's result cells and official-line spreads carry semantic classes (`bowl-cell-win`, `is-official`, ...) instead of colour class names. Day mode is pixel-identical (checked on every screenshot suite). At night, three things now follow the theme as it was written: the Bowl picks game names use the soft cream the stylesheet already specified, the Email/Notifications dividers are the theme's rule colour instead of white, and the Bowl picks row lines are the rule colour. Stylesheet budgets lowered: duplicates 88, `!important` 9, hex colours 243, night rules 153.

## Pull down to refresh in the installed app

The app added to a phone's home screen runs in its own window with no browser bar, so there was no way to refresh it. Pulling down from the very top of any page now makes a drop of bright water swell from the top edge of the header, stretching on a thin neck. Far enough, the drop lets go and falls to the foot of the header (one light buzz on phones that allow it): that is the signal to release. Letting go then reloads the page, with the drip repeating until it does; letting go early lets the water draw back up. The drop is drawn inside the header and never below it. It runs only in the installed app (a normal browser tab keeps its own pull and refresh button), never when the touch began inside something already scrolled down, and it turns off the phone's own pull on Android so the two never fight. The water colour (a bright aqua) is used for nothing else in the app. It reloads the whole page, the simplest way to be sure every number is current; there is no partial refresh to get stale.
## The Bowl tables are styled by semantic classes, not by position

The Bowl Card (standings table) and the Bowl picks schedule used selectors like `.grid:first-child > span:nth-child(2)` and `> div:nth-of-type(2) > div:first-child`, so moving a wrapper div or reordering a cell silently restyled them. Each row and cell now carries a name for its job (`bowl-standings-head-row`, `-games-row`, `-head-gutter`, `-head-end`, `-date`, `-score-cell`, `-tiebreaker-cell`, `bowl-edge`, `bowl-first-game`, `bowl-legend-row`, `bowl-schedule`, ...) and the rules use those. Only the zebra striping (`:nth-child(odd)`) stays positional, because striping is positional by nature. Every screenshot (day and night, all widths) compares identical before and after. Budgets: duplicates 86, hex 239, night rules 152.

## The Trophy Room reads Bowl Pool champions from the shared ledger too

Last year's Bowl Pool winner (Al, 2025) was already recorded in the shared championship ledger (`pool_championships`, pool `bowl`, by an earlier migration) but not in the Bowl Pool's own tables, because that pool only started in 2026. The Trophy Room read only the Bowl Pool's own table, so it showed "Not recorded" for 2025. It now takes Bowl champions from both places and lists a player once per year however many places record them. No migration was needed; nothing in the database changed.

## The Trophy Room turns: three trophies on a triangular table

The three trophy pictures were different sizes and scales, so they now stand together on one triangular marble table, each on its own velvet cushion at a corner, 120 degrees apart and facing outward, in their real sizes. The table turns: drag or swipe to spin it (it settles with the nearest trophy at the front), or use the subtle arrows at either side (or the arrow keys). Commissioner only for now.

It is a pre-rendered turntable, 60 pictures (one per 6 degrees of a full turn, `public/trophies/turntable/`), not live 3D: it looks as good as the stills, loads without heavy JavaScript, and the pictures are fetched in the background. The trade-off, chosen with the Commissioner, is that each champion's brass plaque (a cartouche with a rope edge, rivets and engraved year and name) is part of the pictures, so a new champion needs a new set. The renderer lives in `tools/trophy-render/` with its own README: add the champion to `champions.json` and run `npm run trophies` (about ten minutes, no graphics card needed). Under the table the page lists every champion in plain text from the records, so the page stays correct between a crowning and the new pictures. The earlier idea of laying live HTML plaques over a picture was dropped, since the plaques cannot follow a turning table convincingly.

Pick'em has room for 12 plaques, Bowl Pool for 10, Survivor for 5. Al's 2025 Bowl win comes from the shared ledger (see the previous entry).

The Pick'em trophy was redesigned: a white marble pillar with a graceful flare at its foot and deeper scalloped flutes, wound by a gentle metal helix (two gold lattice strands, the same rope-twisted rails and zig-zag web as the earlier exoskeleton, about one turn, bowing out in the middle, anchored in engraved rings and tied back to the pillar by small struts), topped by the sculpted gold flame. The collars are cut to the pillar's taper and carry four rubies each, 90 degrees apart. The marble texture was rebuilt (veins that branch and fade, hairline cracks, a soft grain; it tiles with no seam). The Survivor chip was redrawn for legibility (a large, plain navy-on-ivory face with the four suits spade, heart, club, diamond across the top, SURVIVOR, then LAST MAN STANDING), and the gold beads that floated loose around it now sit on its own bezel.

## Zac is on the Survivor trophy, and the table is zoomed to read the plaques

Zac's 2026 Survivor win is engraved on a brass plaque beside John's 2025 plaque (`tools/trophy-render/champions.json`, newest first), and the 60 turntable pictures were re-rendered. The camera is closer and the plaque lettering larger, so every year and name reads at the page's normal size; a small diamond divider that read as an accent over a name's middle letter was removed. The plain-text champion roll under the table comes from the records, so it lists Zac only once his Survivor crown is recorded in the database.

## Players can forfeit the Pick'em playoffs

Requested so a player who is out of it in spirit can end their season instead of letting it run. It appears at the bottom of the Slate as soon as the first playoff round is open for picks, and takes three separate clicks on three different questions (the wording is the player's own: "Forfeit?", "Don't give up, you still have a chance! Still want to forfeit?", "I understand this can't be undone and my Pick'em season would end."). A "Never mind" link backs out at any step.

Forfeiting is final for the player and is handled like an elimination: picks on games that have not started are voided and excluded from totals (not graded as losses), picks on games already under way stay and grade, so the score is final after the last started game grades. It is one database function (atomic, idempotent, audited), the database refuses later saves itself, and the Standings show the final score with a FORFEITED stamp. Only the Commissioner can reverse it (Players page, two-step Reinstate); a reversal does not restore voided picks.

The Forfeit link is not offered to a player who is already eliminated (nothing left to give up) or who has already forfeited. The season-long Survivor game and the Bowl Pool are separate games and are not affected.

## The Trophy Room table is mahogany and tailor-made, the spin is smooth, and the champions hang as stadium banners

The table was rebuilt for this display: a hand-made mahogany table (ribbon-figured grain, satinwood and ebony stringing, a marquetry compass star in the middle, a carved apron, an urn pedestal on three cabriole legs with brass claw-and-ball feet) whose top is cut tight around three landing pads. Each pad is the outline of its trophy's own base (the Pick'em hexagon, the Bowl Pool drum, the Survivor steps) as a raised moulded step with a velvet inset a thin, even margin wide, and the top flows around them in deep, smooth curves. The table is larger in the picture so the trophy at the front is framed on its own with the other two pushed to the sides.

The spin was slow, choppy and flashed black. The cause was swapping one image's source for the next: the browser shows nothing while the new picture decodes. The 120 pictures (one per 3 degrees) are now fetched in the background (the three resting views first, then outward from them), decoded, and drawn onto one canvas, so a frame is always on screen; dragging follows the finger directly, a flick carries on a little, and it settles on the nearest trophy in well under a second.

The "Past champions" cards are gone. In their place, below the table, the champions of the trophy at the front hang from the rafters as stadium banners (the year in varsity lettering, the name beneath, trimmed in gold, colour by pool: navy for Pick'em, crimson for the Bowl Pool, emerald for Survivor). While the table turns the banners lift away; when it settles the new trophy's banners drop in from above one after another and bounce into place. The banners are real text from the records, so they stay correct between a crowning and the next set of pictures, and screen readers read them.

Also: the Bowl Pool cup's handles were two close ribbons that vanished edge-on, so they are now spaced well apart and joined by cross-pins; the Survivor plaques are wider and more evenly spaced.


## 2026-10-21 - Any page a player opens counts as being active

The Commissioner's "last active" time was written only on login, the Slate, saving picks and chat, so a player who had only looked at the Standings, the Trophy Room, the Bowl Pool or Survivor, or who stayed signed in on their phone, kept showing an old time (Zac tested a feature and was shown as last on the day before). Every page reads its data through the shared player authentication, so recording activity there covers them all, after the response and no more than once every 15 minutes per player as before. The Commissioner's own background admin calls do not count, and a failure to record never affects the player.

## The header keeps its height while the player's name loads

The top bar grew when the name ("Tyler ▾") arrived after the session check, pushing the whole page down. The name button is taller than the theme button, and the reserved height was smaller than the name's. The bar now reserves the name's full height from the first paint (3.75rem on a phone including its padding, 2.75rem for the account area on a desktop), so the name can take a second to appear and nothing moves. A screenshot-suite test measures the header before and after the name loads, on a phone and a desktop.

## The group's stats in the Commissioner's Performance panel

The Performance panel now opens with "The group", a read-only, Commissioner-only view of how the whole pool does against the spread (`/api/admin/pool-stats`, computed by `src/lib/group-stats.js`, with unit tests). It shows:

- **Record and hit rate** across every graded Pick'em pick on record (regular season and playoffs; a push is a loss under the pool rule), plus how many games landed exactly on the number and what share of picked games that is.
- **A weekly-records histogram** of 0-2 (a donut), 1-1 and 2-0 weeks across every player's completed regular-season weeks, with the 25/50/25 a coin flip would give drawn over the bars. A regular week has two picks, and a pick not made is a loss (one pick that wins is a 1-1 week; no picks is a donut). A player's weeks begin at their first pick of a season, so nobody is charged for weeks before they joined. A week with a voided or unsettled pick is left out and neither counts nor breaks a streak.
- **Two streak boards, regular season only:** the most consecutive 2-0 weeks, and the most weeks in a row without a donut, each player's longest run and the run they are on now. Runs follow the order of play across seasons with no reset, so a streak still alive when a season ends carries into the next one.
- **What the group picks:** the share of picks on favorites and underdogs, on home and road teams (neutral-site games are their own row), and each side's record and hit rate.

It sits in the Performance panel at the Commissioner's request, although that panel is otherwise technical (provider cost, polling, account capacity). Players do not see it.

Each player's own full set lives in the Trophy Room, under the all-time record ("Player stats", a row of names to choose from): the same record and hit rate, 0-2 / 1-1 / 2-0 histogram, longest and current streaks, favorite/underdog and home/road splits, plus their record season by season. The group's totals and the two streak boards stay in the Performance panel. Both come from the same function (`buildGroupStats`) and the same Commissioner-only read, so a player's numbers always add up to the group's.

## 2026-10-20 - A lighter Trophy Room, smaller banners, tied places and a tidier table

- **Smooth again:** the banners ran about 120 separate animations plus a shadow filter that had to be redrawn every frame, and the table canvas drew two full-size pictures each frame. The cloth is now 12 strips with one wave each (the lettering already moves as one piece), there is no filter, the banners are promoted to their own layer, and the table is drawn at the pictures' own size while it turns (twice the size only at rest, for sharp plaques).
- **Banners:** back to a compact size (two to a row on a phone), the star gets room above the year, and a second year has room under the first.
- **All-Time Table:** players level on what the table is sorted by share a place (standard competition ranking: two players tied for 1st are both 1st, marked "T1", and the next is 3rd). Under Wins that is the same number of wins; under Hit rate it is the same hit rate on the same side of the 50-pick threshold. The columns are rebalanced for a phone (narrower rank and wins, wider streaks) and the long streak headings are a little smaller and tighter there so "Consecutive" fits.

## Championship banners are per person, not per year

The banners under the front trophy used to be one per season. They are now one per person who has won that pool, and each carries every year that person won (oldest first), so a repeat winner adds a year to the banner they already have. A new winner gets a new banner, hung after the others, and banners stay in the order they were first earned, so the one that has hung longest is always at the left and nothing already flying moves. Co-champions of one season each get their own banner. A banner is matched to its person by player id (by name only when a record has no id), and shows the latest name on record. The banners still drop and bounce in when a trophy comes to the front.

## 2026-10-21 - The All-Time Table has two views, and streak weeks count once their games are final

A switch above the table chooses between Wins & hit rate (as before) and Streaks & more. The second view holds the streaks (the best run big, the current run small under it as "now N", with no gold, star or bar), games decided by half a point (the pick won or lost by exactly half a point against the locked spread, in a wins and a losses column) and pushes picked (the pick landed exactly on the number and was graded a loss). Every column sorts on its own number and players level on it share a place (T1, then 3rd), under either view. The streak headings read "Consecutive Donut Free Weeks" and "Consecutive 2-0 Weeks" with a forced break after "Consecutive"; the Performance tab's streak tiles are named the same. A streak week now counts as soon as every game in it is final (postponed, cancelled and no-contest games do not hold it open) instead of waiting for the pool to move on to the next week, which is why the table was a week behind. Wins and hit rate already counted every graded pick.

## The Trophy Room table is symmetric, with three identical landing pads

The three pads were cut to each trophy's own base (a hexagon, a circle and a rectangle), so the table's lobes differed. All three pads are now the same round velvet disc, 12.2 wide in table units (just big enough for the widest base), spaced 120 degrees apart, and the table top flows between them in the same smooth curves. The blend that joins the pads to the middle was not order-independent (joining A then B is not quite B then A), so it is now averaged over every order the three can be joined in, which makes the outline exactly three-fold symmetric. The trade-off: the Bowl and Survivor bases leave a little more velvet showing than when each pad hugged its own base, because three identical pads cannot hug three different shapes. The 120 turntable pictures were re-rendered; `scenes.js` also has a `view=top` option that looks straight down on the table, to check its symmetry.

Two more fixes in the same change, from using it on a phone. The Pick'em trophy's flame was cut off by the top edge of the picture, so the camera is pulled back and aimed a little higher (all 120 pictures re-rendered with room above the tallest tip). And the spin got "stuck in the middle": the pictures between two trophies were fetched last, so a spin started before everything had arrived passed through a gap and sat on the nearest picture; they are now fetched evenly all the way round (every 10th, then every 5th, every 2nd, then the rest), so a spin is uniformly coarse and then smooth. A touch the browser takes over to scroll the page ends in a pointer cancel rather than a release, which used to leave the table between two trophies with the banners hidden; a cancel now settles on the nearest trophy like a release does.

The banners no longer drop like stiff boards. They hang from the rafters rolled up and unroll under their own weight: the cloth falls faster and faster as it opens downward (a clip that reveals from the top, so the swallowtail forms last), stretches a little as it comes taut, then swings and settles in a few slow, heavy sways, each banner a beat after the one before. The cloth has soft vertical folds and a slow sheen that sweeps across it while it unrolls, and once hung it sways very slightly, out of step with its neighbours. Reduced-motion settings get the finished banners with none of it.

## Streaks join the Trophy Room's hit rate table, and the Performance tab has a league / player dropdown

The all-time Wins and Hit rate table in the Trophy Room has a Streaks section: weeks in a row with at least 1 win, and 2-0 weeks in a row, each shown as now / best (regular season only; a streak alive at the end of a season carries into the next). The Season Snapshot panel is not changed.

All the other performance numbers live in one place, the Performance tab, behind a dropdown: The league (record and hit rate, the weekly 0-2 / 1-1 / 2-0 histogram, the two streak boards, most picked teams, favorite/underdog and home/road splits) or any one player (the same set from just their picks, with streak tiles in place of the boards, plus a season-by-season record). The separate Player stats section in the Trophy Room is gone.

New in both views: the most picked team, which is the team taken most often among graded picks, shown as a tile and as a top-five table with each team's share of the picking and how those picks did. Everything here is private to the Commissioner.

## 2026-10-19 - A picked Bowl Pool team shows a megaphone, not a pennant

When a team is picked on the Bowl Pool page, the mark that swings into its box is a cheerleader's megaphone in the school's own colors (body, mouthpiece bulge, band, rim and handle), lettered with its name, instead of a felt pennant: a narrow mouthpiece with a distinct bulge, a cone flaring to a wide bell with a dark inside, a band near the bell and a small handle underneath. A newly picked team's megaphone swings up from the mouthpiece with a little overshoot and gives a cheer (three sound arcs by the bell). It is used for the selection only; the Bowl Pool trophy keeps its pennants. The school colors and their fallback (the pool's navy and gold) are unchanged (`src/lib/bowl-pennant.js`). Reduced motion shows the megaphone still.

## 2026-10-20 - The Bowl Pool cup's lettering is a little easier to read, and carries no memorial line

The engraved band on the cup says only "BOWL POOL CHAMPIONS" (the "Joe Barr Memorial" line on the back is gone). It is still engraved gold, only subtly easier to read: a deeper relief, slightly larger letters, and a faint warm shadow in the cut letters (a see-through overlay, never solid dark lettering, which looked wrong against the gold). All table pictures were re-rendered.

## 2026-10-21 - Pull to refresh: a foot-first pole, a taut chain, and a down counter that turns to 1

The refresh pull has two stages, both following the finger. First the lead pole comes down foot first, its foot leading and the pole straightening as it lowers, while the chain stays straight and taut the whole way: it is fastened at the left edge of the page and turns about that end, rising about 15 degrees at the start (its ring hanging short of and above the ball) and lying flat when the foot lands, so its reach grows with the cosine of its angle. The foot lands upright beside the ball with a puff of dust, which is the measurement (halfway through the pull), then the pole swings once a little past upright and settles. Second, a down counter standing in the distance to the right of the ball slides from 4 to 1: about a dozen thin slats, every other one sliding up first so halfway the panel reads 1, 4, 1, 4. The counter fully on 1 is the refresh signal: one light buzz where the phone has one, the label flips to "Release to refresh", and letting go reloads. The chain snap is gone as a signal. The counter is unbranded. Pulling back lifts the pole and turns the counter back toward 4; letting go before the 1 does nothing. The pull is a little longer than before to give the two stages room.

## Pull to refresh is a first-down chain

The pull-down refresh used to be a drop of water, which belonged to nothing else in the app. It is now the chain crew's first-down markers, drawn from the real ones: two padded orange rods, each with a round target disc on top and a long tapered banner with black-and-white chevrons pointing down, ending in a black rubber foot, joined at the foot by a steel chain with a red clip at its middle (the way the rods are joined on a field), on a strip of turf along the foot of the header. The rear rod stands planted at the left. Pulling down carries the lead rod in from above the top edge at an angle, swinging upright and dragging the chain taut; the slack lies in humps that flatten as it comes. At the threshold its rubber foot plants on the turf with a squash, a puff of dust and one light buzz, and the chain snaps taut and twangs: that is the signal to release. Letting go reloads the page (after 1.2 seconds, so the twang can be seen) while the chain keeps humming; letting go early lets the lead rod draw back up. It is drawn inside the header's height and never below it, runs only in the installed app, and with reduced motion the chain simply appears taut. The strip behind it matches the header, so it is invisible on pages with a header.

## 2026-10-20 - The pull-to-refresh chain can never get stuck

Once the chain was planted, a finger lift the page never heard of (or a reload that never came, or the page coming back from the browser's back/forward cache) could leave the chain drawn over the header after the page had refreshed by other means. Now the gesture always ends: letting go with the foot planted refreshes as before; any other ending, or a touch that goes quiet (1.5 seconds with no finger down, 4 seconds with a finger held still), resets the chain; a page restored from the cache starts clean; and a reload that has not happened after 6 seconds takes the football down again.

## 2026-10-21 - New tables are granted to the service role explicitly

Supabase stops granting Data API access to new `public` tables on 2026-10-30. A catch-up migration re-grants the service role access to every existing table, sequence and function and to future ones, and from now on each migration that creates a table grants it in the same file; a test fails if one does not. Existing tables, and what anon and authenticated players can reach, are unchanged.

## The browser tab shows the site's own goalpost icon

The tab still showed the framework's default (a white triangle in a black circle). `src/app/favicon.ico` and `src/app/icon.png` are now an 8-bit goalpost under a night sky: yellow uprights lit on one edge and shaded on the other, small red streamers on top, crimson padding on the stem, mowed turf below, and "JB" between the uprights in white varsity letters with a crimson drop shadow. It is two hand-placed pixel pictures rather than one shrunk image: a detailed 32 by 32 (used at 32, 64 and 256 px, enlarged without smoothing so it stays crisp) and a simplified 16 by 16 for an ordinary tab. The home-screen icons (`apple-icon.png` and the manifest icons) are unchanged. Browsers cache a site's icon for a long time, so it can take a hard refresh, or a few days, to appear in a tab that has been open before.

## 2026-10-21 - On a phone the Slate's display switch sits beside the week selector

The All games / Pool action switch moves to the right of the View week selector on the same row (below 768 px), saving a row of height at the top of the Slate. Wider screens keep the stacked layout.

## The home-screen icon is the goalpost too

The app's home-screen icon (what shows when the pool is added to a phone, and the manifest's 192 and 512 px and maskable icons, and `apple-icon.png`) was a football with "JB" on cream. It is now the same 8-bit goalpost as the browser tab: yellow uprights with the varsity JB between them, crimson padding, a night sky and mowed turf. It is the detailed 32 by 32 picture enlarged without smoothing (16 times for 512, 6 times for 192, so every pixel stays crisp) as a full square with no transparent corners, since the phone applies its own rounded mask; the maskable icon is the same picture, because the goalpost and JB sit well inside the 80% safe zone. A test checks the sizes and that none of the files has transparency. A phone keeps the icon of an app that was already added to the home screen, so to see the new one remove the app from the home screen and add it again.

## 2026-10-21 - A Survivor champion is never eliminated afterward

The no-pick rule eliminates any active Survivor entry with no pick in a finished week. A crowned champion stays an active entry and makes no further Survivor picks, so the week after the crowning the rule eliminated the champion and the weekly recap then reported the winner as eliminated. The rule now leaves a season alone once its champion is crowned (new migration). The recap never marks a champion OUT and decides "crowned this week" from the crowning time, not from "somebody was eliminated that week"; the Survivor table shows the champion as WON. An entry already wrongly eliminated cannot be reinstated (an integrity trigger forbids reactivating an entry, deliberately), so the champion is identified by the season's champion record, never by the entry's status.

## The Trophy Room is the Commissioner's alone, with a link in the name menu

The Trophy Room (the three trophies on the turning table, the champion banners, and the all-time Wins and Hit rate table with each player's Streaks) lives at `/trophy-room` and is open only to the Commissioner for now. The way in is a "Trophy Room" link in the drop-down menu under the Commissioner's name (between the name and Notifications); the shortcut on the Commissioner's operations desk was removed, and the old `/admin/trophy-room` address forwards to the new one. A player has no link, and the page and its data answer "not found" (the page says it is not open yet).

Opening it to every player later is one setting: `TROPHY_ROOM_PLAYER_OPENS_AT` in `src/lib/trophy-room-access.js` (null today). It was first planned to open with the Bowl Pool (`bowlPoolLaunchAt(2026)`, December 7 at 3:00 AM Eastern); setting it to that, or any time, opens it to everyone from then on, and it stays open between seasons. `/api/profile` tells the menu whether to show the link.

It is built only from graded picks, so even when opened it can never show anyone's unstarted pick. The Commissioner's Performance tab (the league / player dropdown with splits, histograms and most picked team) is private either way.

The first-down chain was improved after a first look. It now spans the whole width of the page (the rods end up a chain, ten yards, apart, at 10% and 90% of the width), and its strip of turf is a football field: a sideline, yard lines every five yards and hash marks on the yards between. The chain stretches more believably: it pays out of a heap lying on the turf by the rear rod (tight humps that shrink as the slack is used up), then lifts off the turf behind the lead rod and runs straight up to its ring, coming taut as the rod plants; the rod leans against the strain for a moment and settles. A football is spotted at the end being measured, lying on the field with its nose a couple of inches past the lead rod's near edge: it is a first down by inches.

## 2026-10-19 - Trophy Room: compass rose, plaque lettering, streak table, slower arrows

- **Compass rose, steady:** the table's marquetry is a classic compass rose again (eight points, each split into a light satinwood and a dark ebony half, two rings with a ring of tick marks between, a small boss at the centre). The old star flickered and its colours blended as the table turned because overlapping pieces lying almost flat on the top fought over the depth buffer (which piece wins changed with the angle) and the clear coat turned the ebony grey at low angles. Each layer is now pushed forward by a depth offset and the inlay is matte, so it reads the same from every angle. The gold line round the table's apron, which showed up in tapering slivers where it poked out of the wood, is removed.
- **Plaques:** lettering is lighter and more refined (smaller capitals with wide tracking, a small diamond between the year and the name, a fine double keyline) instead of heavy block letters. The keylines follow the plate's concave corners at a steady distance, so none runs off the gold; the corner rivets, which sat in the cut-out corners, are gone. The Survivor plates are smaller, with room between them.
- **Streak table:** both streak headings say "Consecutive" ("Consecutive Donut Free Weeks", "Consecutive 2-0 Sweeps") and the second one is centred over its column like the first (a left-align rule meant for the Player heading was catching it). In each cell the all-time best is the big number and the current streak is the small "now N" under it; the bar and the gold star still show how close the current streak is to the best.
- **Arrows:** the arrow buttons turn the table slowly and evenly (about a second and a half for a full step, easing in and out) instead of snapping round in half a second. A settle after a drag or flick is capped at roughly 10 degrees a frame: the pictures are 3 degrees apart and the fluted pedestal repeats every 22.5, so a faster turn made its flutes appear to roll backwards.
- **Banners:** each champion's banner is now a hanging cloth banner: cut-felt lettering on a stitched, swallowtailed field, hung from a brass rod on two cords, in red (Pick'em), blue (Bowl Pool) or green (Survivor). The cloth moves freely instead of hanging stiff: the picture is cut into thin strips that slide sideways in two slow waves of different lengths travelling down from the rod (none at the rod, most at the free hem), and the whole banner sways from the rod. It still drops in from the rafters when a trophy settles and lifts away when the table turns; reduced motion stills it. The old noisy "cloth" filter is gone.

## Banners are red and blue cloth, and the plaques are readable

Pick'em's banners are red, the college Bowl Pool's blue and Survivor's green (they were navy, red and green). The banners now look like fabric: each is a layer of cloth lit through an SVG filter (a slow, streaky height map for long vertical folds, lit from one side and multiplied into the banner's colour, with a fine woven grain), wavy side edges, a dark sleeve at the top where it hangs from the rafters and stitched (dashed) trim. The unfurl and sway from before are unchanged, and the text sits above the cloth, unfiltered, so it stays sharp.

The brass plaques on the trophies themselves were hard to read in the pictures: the year and the name were small and thin, with scrolls and a double keyline taking most of the face. The plaque now has one slim keyline and the lettering fills it: a bigger year and an even bigger name, heavy strokes (filled and outlined), near-black engraving on a brighter brass, and wider plates where the base has room (Pick'em's, Survivor's and a taller Bowl Pool plate). All 120 turntable pictures were re-rendered.

The names on the trophies' plaques were still blurry on a phone because the 1100 px pictures are enlarged to the width of the screen. The three resting views (one for each trophy at the front) are therefore also kept at twice the size (2200 px, higher quality, `rest-0.webp` to `rest-2.webp`, about 360 KB each) and the page draws them whenever the table is exactly at rest, which is when the names are read; the 120 ordinary pictures are still used for the spin, so it costs little extra to load. The sharp pictures arrive after the spin's own, one at a time.

## 2026-10-19 - Survivor is off once it has a champion: the ticket and the reminders agree

Zac's ticket said he owed three selections. He had been crowned Survivor champion, but a champion's entry stays "active" in the database (the crowning does not change it), and the ticket counted any active entry as a required Survivor pick while its Survivor section had already been torn off. The crowned champion is the "Survivor is over" switch the app already has (`seasons.survivor_champion_player_id`, set automatically when one entry is left), so it now ends the competition everywhere the same way: `ticketCompletion` never counts Survivor once the pool is complete (so the champion owes just the two Pick'em selections), and the Survivor reminders (`survivor_due`, and the courteous check that covers both) are not sent once a champion is crowned. Playoff rounds were already Pick'em only.

## The Trophy Room's hit rate table is evenly spaced, and shows each streak against its best

The all-time Wins and Hit rate table uses fixed column widths (rank, player, wins, hit rate and two streak columns share the width in set proportions, with the player's name trimmed with an ellipsis if it is too long) so the columns line up and nothing runs off the edge of a phone. The streaks sit under one "Regular Season Streaks" heading with two columns, "Weeks with a win" and "2-0 weeks". Each cell shows the current streak as the big number, the all-time best under it ("best 23"), and a thin bar showing how close the current streak is to that best; when the player is at their best the cell turns gold with a star, and the cell's spoken label says so.

The two streaks are named **Donut Free Weeks** (weeks in a row with at least 1 win, never a 0-2) and **2-0 Sweeps** (2-0 weeks in a row), in the Trophy Room's table and on the Performance tab. They sit under "Regular Season Streaks".

## 2026-10-19 - Performance: three tables side by side

The Performance panel's teams, splits and season tables sit side by side (one column on a phone), each as tall as the five-team table (a header and five rows; the season list scrolls inside that height past five seasons). The small pick count beside each team's Picked percentage is gone. The teams table can show either the five most picked teams or the five with the best hit rate (ties go to the team picked more often): the Picked and Hit rate headers are the buttons. The splits table is one plain list (Favorites, Underdogs, Home, Away) with no sub-headings, and says Away, not Road team. The league now has a Season by season table too, from the same per-season records the players use. The stats route sends `teamsByHitRate` beside `teams` for the league and for each player.

## Performance tab cleanup: ties, no neutral site, no league streak boards, Survivor over, and a steadier pool map

- **Most picked team:** when teams tie for the most picks the tile says "3 teams tied" with how many picks each, instead of naming whichever sorts first. The top-five table still lists them.
- **No neutral-site row:** the home / road split is just home and road. International games are not treated as neutral, and the Super Bowl has a designated home team, so a pick is always on the home or the road team. (A game flagged neutral in the data is still counted as the home or the road team.)
- **No league streak boards:** the two Player / Longest / Now tables are gone from the Performance tab; the streaks are in the Trophy Room's table (and a player's own view here keeps their two streaks).
- **Survivor over:** once a Survivor champion is recorded for the season, Participant impact counts the last player standing as complete and says "Over · 1 winner · 10 eliminated", not "1 active".
- **The pool map:** the line between two stages was dark only when the stage on its left was complete, so it broke between an in-progress stage and a completed one. It is now dark between any two stages that have been reached (complete or in progress), so the progress line is unbroken.

The Today panel's three boxes were tidied: "Up next" no longer lists the Schedule (games loaded) or Provider allowance lines (the allowance is still shown in Automation health and in the operations map's footer), and "Next message" moved under the "Notification readiness" heading, where the rest of the message queue is.

The Trophy Room page is plainer: "Trophy Room" (capital R) with no line of subtext under it, and the all-time record is now called "All-Time Table" with no subtext under its title, no "Under 50 picks" divider and no "How these are figured" section. The ordering is unchanged (Hit rate still ranks players with at least 50 picks first); it is just no longer explained on the page.

The Trophy Room page is plainer: "Trophy Room" (capital R) with no line of subtext under it, and the all-time record is now called "All-Time Table" with no subtext under its title, no "Under 50 picks" divider and no "How these are figured" section. The ordering is unchanged (Hit rate still ranks players with at least 50 picks first); it is just no longer explained on the page.

The first-down chain is now zoomed in on its last three yards. Still inside the header (nothing is drawn below it): the whole scene is three yards across the page, so the chain runs in from the left edge (its rear end, the rear pole and the heap of slack are ten yards off to the left, out of view) and is dragged across the turf toward the lead pole, which is drawn three times larger than before so that only its bottom third shows (the target disc and most of the banner are above the header), ending in a big rubber foot. The football is spotted at the right, behind the pole, with its tip poking out a couple of inches (2.5, measured against the yard) past the pole's foot: a first down. The field is a deep strip of turf with hash marks every yard and a yard line every five. Chain links, the ball and the marks are drawn larger to match; the pole planting, the squash, the dust, the twang and the lean are unchanged.

## 2026-10-20 - Banners lowered like a curtain, a gliding table, a floating top, and a steadier refresh pole

- **Banners:** each banner is lowered like a stage curtain (it comes down from behind the beam with its cloth unfolding, overshoots slightly, then hangs and moves gently). The lettering is larger, solid gold and cream with dark outlines, and moves as one piece while only the cloth ripples, so letters and years no longer shear. The dashed stitching is replaced by a gold double rule (a firm outer line and an inner hairline) with small diamonds at the corners and the swallowtail point.
- **Table:** the turn keeps its speed but glides: neighbouring pictures (3 degrees apart) are blended in proportion to how far on the turn is, instead of snapping to the nearest. The pedestal and legs are gone; the top floats (all pictures re-rendered).
- **Refresh graphic:** once planted, the lead pole leans about its foot instead of its top, so its foot stays exactly where it touched down (it used to slide about 10px forward as the lean eased out). The football is fuller (about 1.8 long to 1 across).

## 2026-10-21 - The Trophy Room fits in a phone's memory, and its banners stay until the next trophy settles

The Trophy Room page crashed an iPhone's Safari tab ("a problem repeatedly occurred"): it kept 120 decoded 1100x825 pictures (about 3.6 MB each, roughly 450 MB) plus a 2200x1650 canvas, more than the browser allows a page, so it killed the tab and then gave up reloading it. A phone now gets a smaller set (`public/trophies/turntable/sm/`: 60 pictures 6 degrees apart at 660x495, plus sharp resting views at 1320x990), about 100 MB decoded, blended between neighbours so the turn still glides at the same speed; every other device keeps the full set. Decoded pictures are released when the page goes away, and fewer are fetched and decoded at once. The sharp resting canvas and the turning canvas are two stacked canvases, so touching the table no longer reallocates a canvas (that hitch was the jerk when a finger went down); finger moves are drawn once a frame. The banners no longer lift away when a turn starts: the old trophy's banners stay hanging until the table has settled on the next trophy, then lift away and the new ones are lowered like a curtain.

## The chain plants once, the football is redrawn, and the loading football appears at once

- **One touchdown:** the lead pole bounced a couple of times on landing because the rubber foot's squash was a spring (it rebounded past its resting height and swayed). The foot is now fully squashed at contact and eases back up in one smooth movement, never going past its resting height, and the pole's lean eases out the same way, so the pole touches the ground once. (The chain still twangs, since a taut chain does vibrate.)
- **A better football:** the spotted ball is drawn properly: a pointed body shaded like leather (lighter on top), a soft gloss, a white stripe near each end clipped to the outline, laces along the top, a dark outline and a shadow on the turf, slightly larger.
- **No wait after letting go:** the page used to sit there for 1.2 seconds with the chain humming before it reloaded, and only then did the page's own loading football appear. Letting go now covers the page (below the header) with the same spinning loading football at once and reloads 120 ms later, right behind it, so the football is on screen immediately and the reloaded page's own loading screen takes over in the same place.

The "Wins" axis label on the Season Snapshot chart sits 2px further from the card border (translate x 8 → 10), clear of the numbers beside it; nothing else in the chart moved.

## 2026-10-19 - Fluid CPU estimate recalibrated

The Commissioner dashboard estimated 4 h+ of Fluid Active CPU while Vercel's own meter read 3 h 16 m. The per-active-player cost in `src/lib/vercel-usage-estimate.js` drops from 30 to 22 seconds a day (the slower chat, home and grading polling since the 2026-10-02 calibration costs each player less), so 11 active players plus the scheduled jobs and uptime probes now come to 3 h 16 m. It is still an estimate (Vercel does not expose Hobby usage to an app): compare it with the Usage page now and then and adjust that one constant.

The Provider cost chart (credits per game, 15- and 30-day averages) no longer starts its axis at zero: it now fits the axis to the range the two lines actually move in (the existing "tight" scale, with one step of room above and below), so the story of the lines is not flattened into the top of a tall chart.
