# Joe Barr Memorial Pick'em project reference

Last verified against `main`: 2026-10-05 (commit `145c8f7`).

This is the durable product and system reference for the Joe Barr Memorial
Pick'em application. It explains what must remain true across code changes,
provider failures, NFL schedule changes, weekly progression, playoffs, and
annual rollover. `AGENTS.md` loads the short mandatory rules; this file holds
the detailed context behind them.

For a code-owner and request-boundary overview, see the
[architecture and measurement map](ARCHITECTURE_MAP.md).

## Product in one paragraph

The application runs a private, season-long NFL pool with two related games.
Pick'em players select teams against a locked official spread. Survivor players
select one straight-up winner per regular-season scoring period without reusing
a team. The same Slate, schedule, final-score provider, audit system, and
commissioner controls support both pools, while scoring and history remain
separate.

## Terminology

- **Season**: one annual pool, moving through `preseason`, `regular_season`,
  `playoffs`, and `complete`.
- **Scoring period**: a pool week or playoff round. Exactly one period may be
  active at a time.
- **Gameweek pin**: the immutable relationship between an NFL game, its
  original scoring period, and its original NFL gameweek.
- **Official line**: the spread captured at the game's configured line-lock
  time. It is never replaced retroactively by a later market line.
- **Settled week**: every game is final or formally resolved, every applicable
  pick is graded or voided, and the database can close the period atomically.
- **Default week**: the completed or upcoming period shown when a player first
  opens the site. This does not limit which completed weeks are accessible.
- **Void pick**: a retained audit fact that is excluded from active limits,
  scoring totals, championships, and Survivor team reuse. It is not a loss.

## Sources of truth

When investigating behavior, use this order:

1. `supabase/migrations/` for the current database contract.
2. `test/` for executable rule examples.
3. `src/lib/` and API routes for application orchestration.
4. This reference and accepted decisions in `docs/DECISION_LOG.md`.
5. Operational runbooks for human procedure.

The root-level numbered SQL files under `supabase/` describe the original
database build only. They are not the current migration stream and must never
be replayed.

## System boundaries

- **Next.js/Vercel** serves the player pages, Commissioner tools, API routes,
  health endpoint, and manual recovery controls.
- **Supabase/Postgres** owns durable state, row-level security, integrity
  triggers, atomic mutations, audit logs, execution leases, and scheduled jobs.
  The privileged application client in `src/lib/supabase-admin.ts` is marked
  `server-only`, so an accidental import into a Client Component fails at
  build time rather than weakening the service-role boundary.
- **nflverse** supplies the canonical NFL regular-season structure and ongoing
  kickoff corrections. The importer validates the feed's season length instead
  of assuming a fixed game count.
- **Odds/final-score provider** supplies preliminary spreads, official-line
  inputs, and verified final scores.
- **ESPN** supplies Bowl Pool schedule, preliminary lines when available, and
  final scores. NCAAF Odds API calls are an explicitly enabled fallback.
- **Brevo** delivers reminders, reveals, recaps, and actionable watchdog email.
- **GitHub Actions** runs application quality, database migration workflows,
  isolated lifecycle checks, encrypted backups, and monthly upgrade rehearsals.

### Where a response is shaped

The routes read rows and answer; deciding what a viewer may see lives in small
modules with no database access, each covered by tests with fictional rows:

- `src/lib/slate-shape.ts` shapes The Slate's games (lines, scores, results, and
  pickers, named only for games that have kicked off) and the player's Survivor state.
- `src/lib/home-shape.ts` shapes the Pick'em Pad's rows (a player's own pick is
  always visible to them, everyone else's only at kickoff).
- `src/lib/reveal-rows.ts` builds the rows of the pick-reveal email images (only
  picks on the revealed games, in the current period, from allowed players).
- `src/lib/api-contracts.ts` defines the viewer-safe Slate and Standings JSON
  shapes shared by each route and its page. Route responses must satisfy these
  types at build time; database rows are not exposed as API contracts. A new
  Survivor entry state must receive an explicit viewer rule before it can be
  serialized as a familiar state.

- `src/lib/slate-view.ts` holds the Slate page's selection rules and derived views (what a click does, the Survivor used-team rule, day grouping, Pool Action filtering, the receipt's list).

A change to who can see what belongs in one of these modules, with its test.

For a fictional-data CPU and JSON-size baseline of the two player response
shapers, see [response cost baseline](RESPONSE_COST_BASELINE.md). It does not
measure database requests or end-to-end route time.

## Request boundaries

- **One authentication result.** Every protected route uses `authenticateActivePlayer`
  (directly, or through `commissionerAccess` and `profilePlayerAccess`): 401 for a
  missing or invalid session, 403 for an inactive player or a missing role, 503 for
  a sign-in or database outage (never reported as lost access), 500 for missing
  configuration, each with a stable `code`. No identity or permission is cached and
  only safe reads are retried. The session token is verified locally against the
  project's public ES256 signing key (signature and expiry; the key set is kept ten
  minutes per server instance) instead of a round trip to Supabase Auth on every
  request, so a signed-out session stays usable until its token expires (at most an
  hour); `players.active` is read on every request, so deactivation is immediate.
- **Bodies are validated before use.** Routes read JSON with `readJsonObject` and
  take fields through the parsers in `src/lib/request-bodies.ts`; a malformed, null,
  array or mistyped body is a 400 before any pool data is read or written.
- **Database types are generated and committed** (`src/lib/database.types.ts`, from
  the isolated database via `npm run db:types`). The isolated workflow checks that
  they still match the schema when a pull request touches migrations or the types.
  Status lists come from `src/lib/db-statuses.ts`, checked against the migrations'
  CHECK constraints.
- **Route cost budgets.** `test/route-cost-budgets.json` caps database requests, rows
  and bytes for `/api/home` and `/api/board`; see
  [RESPONSE_COST_BASELINE.md](RESPONSE_COST_BASELINE.md).

## Player identity and privacy

- Players authenticate with their assigned pool identity and PIN/session flow.
- Concurrent page and navigation startup share one in-flight session read. The
  result is not cached after completion, so sign-out and expiry remain immediate.
- Header identity and Commissioner access use the same authenticated profile
  route as the rest of the app. A temporary profile-read failure does not erase
  an already verified identity; an invalid session returns the player to PIN
  sign-in instead of leaving a half-signed-in page.
- Season Snapshot, Pick'em saves, Standings, Slate, Survivor, and Bowl Pool use a
  request-scoped active-player access result. A bad
  session is 401; a verified but missing or inactive player is 403;
  unavailable auth or player storage is 503; missing server configuration is
  500. Standings reads its display preferences in the same verified profile
  lookup. Read and save responses include a stable error code; Pick'em save
  validates its payload before access, retries only safe token/profile reads,
  and never blindly retries its selection mutation. Temporary failures must
  not be presented as a lost sign-in. Other player routes retain their prior
  authentication handling until separately migrated and tested.
- PIN sign-in is routed through the application. Five recent failures from one
  privacy-safe source fingerprint start a one-minute cooldown; ten start a
  15-minute cooldown and open a Commissioner incident and email alert.
  Successful login clears prior failures, no individual player PIN is locked
  by this protection, and raw PINs or network addresses are never retained.
- The four-digit PIN is not the Supabase Auth password. Auth accounts use a
  versioned HMAC credential derived only on the server from the PIN and a
  dedicated `PLAYER_AUTH_PEPPER`. Launch preflight fails when that protected
  value is missing or too short. All active accounts use the protected
  credential; the Commissioner can re-run the audited bulk rotation from
  Today → Health and safety → Commissioner handbook after an intentional pepper rotation.
- A player can always see their own selections.
- Another player's selection remains hidden until that selected game's kickoff.
  Reveal is per game, not all-at-once for the week.
- Anonymous and ordinary authenticated clients cannot read private pick tables,
  playoff eligibility snapshots, service-only functions, or commissioner APIs.
- Commissioner routes use the shared commissioner gate. Scheduled mutation
  routes require the shared automation bearer secret.

## Pick'em selection and scoring

- Regular-season periods normally require two ATS picks.
- Playoff rounds use their configured slate sizes: Wild Card 6, Divisional 4,
  Conference Championships 2, and Super Bowl 1.
- A player may submit a full round at once. Each individual pick remains
  editable until its own kickoff, so earlier games can lock while later games
  remain changeable.
- A Pick'em save never resubmits or validates an unchanged Survivor selection.
  A sealed Survivor pick therefore cannot block a later legal Pick'em save.
- Pick'em and Bowl Pool save routes reject malformed bodies, duplicate game
  selections, and oversized arrays before reading a slate or writing picks.
  Omitting `survivorSelection` leaves it unchanged; explicit `null` requests a
  clear. The database remains the final authority for game membership, kickoff,
  ownership, and atomic saves.
- The selected team must belong to the selected game. A kicked-off pick cannot
  be added, removed, or replaced.
- Picks use the saved official line. A cover is a win; an ATS push or tied
  pick'em game is a loss under the pool rule.
- A missing usable official line leaves the pick pending and blocks unsafe
  period completion.
- Standings count only explicitly graded ATS wins. Pending, loss, and void rows
  never become wins by inference.
- A final tie for the Pick'em lead creates co-champions; the system invents no
  tiebreaker.
- The Season Snapshot is the back of the Pick'em Pad; a round button at the pad's
  top right turns it over. Commissioners always have it. Players get it once
  every Week 6 Pick'em pick has settled (every player has a full card or every
  game has kicked off, and no pick is pending), and keep it through the playoffs
  until the August 1 season rollover, when the new season's periods are all
  upcoming and it disappears until that season's Week 6 settles. The same rule
  gates the data route. The route shares one finished
  chart in memory for as long as it can be trusted (checked per viewer, never
  before the release gate): until the active week's last kickoff, then every two
  minutes while grades land, then an hour once the week has settled. It reads
  picks in pages past PostgREST's 1,000-row cap. The browser loads the chart
  only while the back is showing and only when the standings changed since it
  last loaded, never on a timer, and keeps the last chart so the back opens
  instantly while fresh data loads behind it.
  Everyone begins at zero on the regular-season chart. Completed periods carry
  every player's cumulative ATS wins forward; the active period is plotted for
  everyone at once, as soon as its last Pick'em pick settles, which is usually
  before the final game of the week because nobody has to have picked it. The
  week is settled when no pick is pending and every active player either holds
  all their picks for the week or every game has kicked off (a player with an open
  pick slot could still add one, so the chart waits for the last kickoff). A separate playoff chart starts at each
  player's final regular-season total and continues season totals. All players
  share exact week columns. The horizontal scale fits the visible weeks from
  baseline through the current week. Lines have no point markers or data table;
  shared paths use touching three-pixel ribbons, centered on the score. A line
  sits above another if it held the greater total more recently: compare their
  totals from the latest week back and stop at the first week they differ.
  Identical histories keep current-standings order, and lanes never swap
  mid-chart. Each week is one straight band from a player's slot at the
  start of the week to their slot at the end, so lines bend only at week
  boundaries. Inset highlights and shaded edges distinguish bands without gaps
  or overlapping strokes. Bands join at common week boundaries and taper to the
  zero baseline. The chart has sparse axis labels but no point callouts or
  duplicate data table. During the playoffs the playoff
  chart replaces the regular-season chart. Each person has a permanent color: eleven validated hues, shuffled
  three times at random and frozen, assigned in the order players joined the
  pool (inactive players keep their slot), so hiding, leaving, or joining never
  repaints anyone. The pad turns over flat; turned over, it widens to the full
  Standings rail (the Survivor Table's width) on the same parchment, and each
  face hides at the edge-on moment so no mirrored text shows.
  An All / 6 Wk toggle (regular season only) sits between the title and the
  flip button. 6 Wk shows exactly six weeks, scrolls sideways one notched week
  at a time with the y-axis standing still beside it, and always opens on the
  most recent six weeks. Its y-axis fits the weeks in view (a win or more under
  the lowest line and over the highest) and glides on a spring as the view
  scrolls, the lines with it; the tick spacing stays the same for the whole
  view, so the numbers slide past like a ruler and fade in or out at the edges.
  All always counts from zero. A slim position rail under the "Week" label
  replaces the browser's scroll bar. Axis margins are kept tight. On phones the key is a compact
  four-column grid. The key lists everyone in current-standings order;
  pressing a name hides or shows that person, the axis and stacking recompute
  for whoever remains, and hovering a name or line highlights one player. The
  playoff chart starts with players out of the playoff race hidden. The
  week-range choice and each phase's hidden players are remembered on the
  device (browser storage) and restored next time.

## Survivor selection and scoring

- Every active player is enrolled when Survivor opens for the season.
- Survivor is regular-season only. An active player must make one straight-up
  selection per period and cannot reuse a team from a non-void prior pick.
- A selection can be changed or cleared until its game's kickoff.
- A straight-up win advances the player. A loss or tie eliminates the entry.
- Missing the required selection by the final eligible kickoff eliminates the
  active entry.
- A postponed, cancelled, or no-contest selection is void, not a loss, and
  never advances Survivor. Voided selections do not consume the team and can
  be replaced while a legal future game remains. If no legal replacement
  remains, the disruption does not eliminate the entry or hold week rollover.
- Survivor results never count toward season-long ATS wins or ATS percentage.
- Survivor always ends with a champion, decided only once the deciding week has
  settled: the last entry standing wins alone (as soon as its own pick that week
  wins, or the week completes); if everyone left is eliminated in the same week,
  they share the title; if several entries survive the whole regular season, they
  share the title. Every co-champion gets a trophy and is named together.
- Once a Survivor champion is crowned the competition is over: the no-pick rule never eliminates the champion (or anyone) in a later week, the weekly
  recap never reports the champion as eliminated, and the Survivor table shows the champion as WON, not IN or OUT.
- On the Standings a lost Survivor entry still reads IN until it is officially
  out: another entry must make a correct pick in the same week (`officiallyOutEntryIds`).
  If everyone left loses together nobody is out, because they share the title. The
  stored status is unchanged; only the Standings display waits.
- The Survivor, Pick'em and Bowl trophies beside a name belong to the latest season's champion or
  co-champions; a new champion takes it from the previous one. The hover text lists every title.

## NCAA Bowl Pool

- The NCAA Bowl Pool is a separate, voluntary annual competition. It has its
  own seasons, entries, college teams, games, lines, picks, standings,
  championships, and audit history; it never changes NFL Pick'em or Survivor
  records.
- Players see the Bowl Pool opt-in beginning December 7 at 3:00 AM Eastern.
  Commissioners can access it before then. A player may withdraw only before
  the first game kicks off. Their private draft remains during that withdrawal
  window and is deleted at the first kickoff.
- Every FBS bowl and College Football Playoff game, including campus CFP games
  and the national championship, is represented in chronological order (the
  schedule pull and a Commissioner Reschedule keep it so unless the Commissioner
  has arranged the order by hand). An
  opted-in player may save any number of selections at once and return later;
  every individual game locks at its own kickoff and becomes public then.
- NCAA ATS picks follow the NFL privacy and locked-line rules. A whole-number
  source spread is adjusted by half a point for this pool so it cannot push;
  an actual `PK` game remains `PK`. A win is one standings point.
- A Bowl line locks at 8:00 AM Eastern on its game day, like an NFL spread
  (the schedule import and the provider sync both set `line_lock_at` that way).
  Until then the line is preliminary: the latest provider spread is kept on the
  line row with `locked_at` empty and shown in black; at the lock `locked_at` is
  filled and the line, shown in teal, never changes. Only a locked line, or a pick,
  freezes a game's teams and kickoff, so a provider moving a kickoff while the
  spread is still preliminary is accepted. Health, integrity and the official-lines
  email count only locked lines. The pool is live from December 1 (Eastern) until
  its champion is crowned and never runs in the NFL off-season.
- Bowl standings are visible to all players in an expandable grid. Before a
  game's kickoff, only the owner can see their selection; after kickoff the
  represented pick is public. Final cells show a full green win or red loss.
- Final standings sort by ATS wins, then the smallest absolute difference from
  the combined points scored in the CFP national championship. The guess is optional:
  a missing guess loses the tiebreaker to any guess but never outranks more wins.
  Remaining ties, including leaders who all skipped the guess, create
  co-champions.
- Active participants with pool email enabled receive an individual reminder
  three hours before an unpicked game's kickoff and a 5:00 AM Eastern recap on
  the following day after that gameday's results are terminal. Recaps may
  contain the entire day's slate; immutable snapshots and keyed delivery
  receipts make retries safe and prevent duplicate messages.
- Phone notifications (Web Push) are a second delivery path beside email, for the pool added to a phone's Home Screen. A player turns them on from
  the Notifications page ("Notifications on this phone": the phone asks permission, subscribes with the pool's own key, and the server saves the
  subscription in `push_subscriptions`); the same page sends a test and turns them off. An iPhone browser tab cannot receive them (only the app
  added to the Home Screen can), and the page says so. The signing key pair (VAPID) is made by the server the first time it is needed and kept in
  `push_vapid_keys` (one row, service role only), so nothing is configured in Vercel; the service worker is `public/sw.js` (notifications and
  the icon badge only, no fetch handler, so nothing is cached). Subscriptions must be on a known push service (Apple, Google, Mozilla, Microsoft),
  at most ten devices a player, and a device the push service reports gone (404 or 410) is deleted. Every player sees the section (an iPhone browser tab is told to add the app to the Home Screen first).
  Inside the Home Screen app a signed-in player whose notifications are not on yet also gets a one-tap banner under the header ("Get pool reminders on
  this phone", Turn on), so adding the app and turning notifications on needs no hunting: one tap asks the phone and saves it, through the same
  `turnOnPhoneNotifications` as the Notifications page. Not on the sign-in or Notifications pages, never once on or blocked, and Not now keeps it away 14
  days (`notificationsBannerVisible`, `src/lib/phone-push.js`).
  On Android and Chromebooks the one-tap Install does both: once the browser's install goes through, the phone is asked for notifications straight
  away and saved (`turnOnAfterInstall`; only when signed in and never asked before). If that does not happen, the in-app banner asks on first open.
- Both Bowl Pool announcements (`bowl_pool_open` and `bowl_pool_last_call`) are previewable in the Email center (read-only entries of the email image studio) and can be
  test-sent to the Commissioner alone: the preview and the test use `bowlInvitationMessage` (the real first game and championship date, the same words the sweep queues);
  their wording is never saved, so the template save and reset routes refuse them.
- The Bowl Pool's last call (`bowl_pool_last_call`, same words file) is one email and one phone notification 24 hours before the first Bowl kickoff
  ("The first game kicks off Tue, Dec 15 at 5:30 PM ET, and entry closes then. Claim your seat now."; email subject "Last call: claim your Bowl Pool seat", a
  short "How it works", and a Claim your seat button). It goes only to active players with pool emails on who have no Bowl entry of any kind this season
  (`bowlLastCallRecipients`, read when it is sent). The sweep queues it once that time has come, under `bowl:<season>:last-call`, from the earliest scheduled game
  when its time is confirmed and no game has kicked off; it is dropped if the first game starts first, and cancelled and rebuilt if the first game's kickoff moves.
- The Bowl Pool's opening announcement (`bowl_pool_open`, words in `src/lib/bowl-opening-announcement.js`) is one email and one phone notification to every
  active player with pool emails on (the phone follows the email, as for every reminder), at 9:00 AM Eastern on December 7, six hours after players first see the
  Bowl Pool. The reminder sweep queues it once that time has come, under the key `bowl:<season>:open`, from the schedule as it stands then (the season's years,
  the National Championship's date, and the earliest scheduled game as "the first game"), so the words never go stale; it is queued only while no game has
  kicked off, and is dropped, not retried, if the first game starts before it goes out. The phone notification is "The Bowl Pool is open" with "Claim your seat
  and pick every bowl and playoff game against the spread. First game: Tue, Dec 15."; the email's subject is "The Bowl Pool is open: claim your seat", with the
  six steps under "How it works" and a Claim your seat button to the Bowl Pool. Its words are saved on the reminder (`recap_snapshot`), so a retry never changes them.
- Haptics: the app gives five feels, one meaning each (`src/lib/haptics.js`): tick = chosen, light tick = taken back, lock-in = a heavier choice, success = saved, warning = that did not work, ratchet = one notch while pulling. Android vibrates (`navigator.vibrate`) for all of them; an iPhone cannot, but it gives its light tick when a finger flips a switch. Since iOS 26.5 the switch must be flipped by the finger itself (a page can no longer flip it from code), so a tapped button carries an invisible label with a hidden switch laid over it (`src/components/haptic-tap.tsx`): one tick per tap, and nothing after a wait or mid-drag (no success, warning or ratchet on an iPhone; the pull gives nothing there). The layer stays mounted through the tap even when the tap changes the button (the finger's switch flips only after the click finishes), and it lets taps through on a disabled button. Where: the Slate (picking a team ticks, taking it back is lighter, going over the limit or touching a closed game warns; a Survivor chip is a lock-in; Submit ticks, then success or a warning once the save answers), the Bowl Pool picks and Submit (the same), the pull-to-refresh chain (a notch as the down counter drops 4 to 3 and 3 to 2, lock-in at 1; Android only), the Notifications page (email plan and final-lines choices, the Turn on / Send test / Turn off buttons, the tick boxes), the "Turn on notifications" banner, the Trophy Room arrows, the theme button, chat Send, and a wrong PIN (a warning on Android). On an iPhone the Notifications tick boxes become the phone's own switch. Never on scrolling, page loads, background updates, arriving notifications, animations or the Commissioner desk. Haptics are always on: there is no switch to turn them off (an old `pickem-vibration` "off" left in a phone's `localStorage` is ignored). A device without haptics, or one that refuses, simply gets nothing and every button works as before.
- Workshop (Commissioner): full screen at `/admin/workshop`, reached from the desk's Workshop tab. Every custom piece (the real components with sample data) sits on one endless board: one patch of tiles (`WORKSHOP_PATCH` in `src/lib/workshop-board.js`) repeats in every direction, every other row shifted half a patch, and only the copies on screen are drawn. Drag, scroll, pinch, the arrow keys or the edge buttons move and zoom it; a tap plays that one copy. A piece's settings open only from its tune button, in a panel (right side on a computer, bottom sheet on a phone), and every copy shares them. Settings are kept on that device (`localStorage` `pickem-workshop`; a save that no longer fits is ignored piece by piece) and change nothing for players; the Menu's Copy settings gives the text to send so a value can be made the default in code. Beyond the first nine pieces it holds the pull-to-refresh strip (the real chain and Dial-A-Down scene; slide it by hand or tap for a whole pull) and the three trophy banners (words and colour adjustable). The easing of the pick highlight, megaphone and crest rules is a setting too (`--selection-sweep-ease`, `--megaphone-raise-ease`, `--crest-rule-ease`; the player CSS uses today's curve unless one is set), and "Zoom in tile" and Menu > Play everything are for looking only and never appear in the settings to copy. Left off on purpose: the turntable (it fetches 120 pictures, too heavy for an endless board), the app-icon badge and the Home Screen banner (they depend on the phone, not on anything the page draws). Nothing on the board reads or writes pool data.
  A phone notification **mirrors its email**: when the reminder worker sends a player's email (`deliverEmailReminder`), that player's phones get a notification with the
  email's subject as the title, its message (plus the champion or elimination line, when it has one) as the body, and the same destination page (one shared
  `reminderDestinationPath`). Same audience, same moment, same choices: the recipients are exactly the players the email's choices selected, and only emails
  sent in that run notify (a repeat run, or an email that failed, sends none; a retried email that finally goes out notifies then), so a phone never gets a
  message twice or one its email choices did not allow. A phone problem is logged and never changes the email result.
  The number on the app icon is the player's **picks still to make this week** (`picksStillToMake`, `src/lib/picks-to-make-rule.js`): the Pick'em picks the week allows minus those made (never more than the open,
  unpicked games), plus one while they are still in Survivor and have not picked; zero when nothing is open. It is set three ways: by each mirrored notification (so it is right with the app
  closed), when the Home Screen app opens or is returned to (`/api/badge`, at most once every five minutes), and right after picks are saved. Bowl Pool picks are not counted yet.
- Add to Home Screen (`src/components/add-to-home-screen.tsx`, rules in `src/lib/home-screen.js`) helps every player put the pool on a phone's Home Screen,
  where it opens like an app and can receive notifications. A slim banner under the header of every page shows on any phone that is not running the
  Home Screen app, with the steps for that phone and browser one tap away ("Show me how"): Safari on an iPhone (Share, Add to Home Screen, leave Open as
  Web App on, Add, sign in with your PIN: the app keeps its own sign-in), Chrome, Edge or Firefox on an iPhone (their own Share button; they can add web
  apps since iOS 16.4), a link opened inside another app's window such as Facebook, Instagram, Gmail or the Google app (open it in Safari or Chrome first,
  with Copy link), the Android menus of Chrome, Samsung Internet and Firefox, and Chrome on a Chromebook (installed, it opens in its own window from
  the launcher). When the browser (Android, Chromebook) offers its own install (`beforeinstallprompt`,
  kept from the moment the page loads; Chrome waits for a tap and 30 seconds on the site) the button becomes one-tap Install. Its ✕ ("Not now", the only
  way to close it; opening the steps replaces "Show me how" rather than adding a Hide) hides the banner 14 days (a note in the phone's own storage). It never shows on a computer or in the installed app, nor on an Android
  phone known to have the app: Chrome answers that itself (`getInstalledRelatedApps`, from `related_applications` in the manifest, which also notices the
  app being removed), and in other browsers a note left when the app was last opened counts (the app and the browser share storage on Android; an iPhone's
  Safari cannot see its Home Screen app, so there the ✕ is the answer). The Notifications page carries the same help as a card for everyone, always. The
  manifest (`src/app/manifest.ts`) states `id: "/"`, the identity browsers already computed for earlier installs. Nothing records who has installed it.
- Before the player-visible launch, placeholders and missing lines are expected
  and the Bowl health contract remains available. From player visibility onward,
  monitoring checks schedule integrity even before first kickoff. Verified
  postponed, cancelled, and no-contest games must be recorded by the
  Commissioner so picks are handled as void disruptions.
- A Bowl game that is not `scheduled` (postponed, cancelled, no contest) is closed to picks although its kickoff may still be in the future. The
  Bowl page treats it as locked, says "Postponed", "Cancelled" or "No contest" where the venue would be (the Bowl Card says it where the line
  would be; `bowlDisruptionLabel`), and leaves it out of Submit; the route skips a pick sent for it (a page opened before the Commissioner recorded it)
  instead of refusing the player's whole Submit; and `save_bowl_pool_submission` deletes an omitted pick only on a game that is still open, so a
  postponed game's pick survives, and a cancelled game's voided pick stays in view. The Commissioner's Reschedule (`reschedule_bowl_game`) moves a
  postponed game back to `scheduled` with the new kickoff marked confirmed and its line locking at 8 AM Eastern on the new game day (a line already
  locked is kept); the matchup freeze (`protect_bowl_game_identity`) lets that one step change the kickoff although the game has picks, and nothing
  else. Rescheduling, like a moved kickoff in the schedule pull, cancels the game's queued reminders (lines-are-set, pick-due, recap) and gives up
  their keys (`cancelQueuedBowlReminders`), so the reminder sweep queues fresh ones for the new time. Known limit: a game moved onto a day that
  already has games is not added to that day's already-queued lines-are-set email (the page still shows its line).

- The Commissioner's Bowl Pool tab can Reschedule a postponed game (new Eastern date and time, `/api/admin/bowl-pool/exceptions`) and set a missing
  line (`/api/admin/bowl-pool/lines`, `bowlManualLineProblem`): a game with teams and no line row, whose line locks within 24 hours or that is final,
  takes a favorite and a half-point spread (or a pick'em at 0). The line is inserted already locked with `manual_override` and source "Commissioner"
  and a history row; an existing line is never replaced by it.

## Trophy Room

- The Trophy Room (`/trophy-room`) has been open to every active player since 2026-10-23 (`TROPHY_ROOM_PLAYER_OPENS_AT` in
  `src/lib/trophy-room-access.js`; the Commissioner could always open it). Until a player is let in, the page and the API answer
  "not open yet" / 404 and the name-menu link is absent.
- It shows three trophies (Pick'em, Bowl Pool, Survivor) on a turning table, built from 120 rendered pictures (3 degrees apart) drawn
  on a canvas, with three sharp resting views; a phone gets the same 120 views at 660 wide (the full set is more than an iPhone page
  can hold). Only the arrows at its sides (and the arrow keys) turn it, one trophy at a time; it cannot be dragged or swiped. The champions
  of the trophy at the front hang under it as cloth banners, one per person, carrying every year they won (a person's banner is drawn at the
  screen's full resolution and moves with a smooth swing and wave). Until the champions have loaded the rafters stay bare; "No ... champion
  yet" shows only for a trophy nobody has won.
- The brass plaques are part of the pictures. A new champion needs a new render: see `tools/trophy-render/README.md`.
- Below it is the All-Time Table, which counts graded **Pick'em picks only** (Survivor and Bowl Pool are not part of it; their champions
  appear only on the trophies and banners). Record view: Wins, Hit rate, Perfect Weeks (all 2-0 weeks), places with ties. Other Stats
  view: Shutout Free Weeks in a Row and Perfect Weeks in a Row (best run, current run beneath), games decided by a half point (wins, losses, hit
  rate) and pushes picked; A to Z by default, no places, every column sorts. The two views are one two-way switch.
- Its figures are the same for everyone and change only when a game is graded, so the API builds them once a minute per server instance
  (`src/lib/short-cache.js`); a graded game shows within about a minute. Access is checked before the cache.
- A week counts toward the weekly figures (Perfect Weeks, both streaks) once every game in it is final, not only once the pool has advanced, and
  a player's own week counts sooner still: as soon as both of their picks are graded, since nothing left in the week can change their 2-0,
  1-1 or 0-2. A week with a pick still pending or voided is left out; a pick not made is a loss only once the whole week is final.

## Weekly lifecycle

All operational times below are `America/New_York` and therefore remain stable
across daylight-saving changes.

1. The next period becomes manually selectable at midnight on the next Eastern
   calendar day after the prior period's final result settles. If its slate is
   loaded, picks may be made immediately.
2. Preliminary schedule and spread refreshes run before games lock. Each game
   carries its own kickoff and line-lock timestamps; international games can
   therefore lock earlier without special commissioner action.
3. Official lines lock at their configured time. Picks remain editable until
   kickoff, not merely until the line locks.
   If the provider is unavailable, the most recent preliminary line may lock
   only when it is no more than 24 hours old. An older or unverified line stays
   preliminary and opens an urgent Commissioner review instead of being guessed.
4. Final-score eligibility begins two hours and fifty minutes after kickoff. Automation polls
   only eligible unfinished games, imports verified finals, and grades ATS and
   Survivor atomically.
5. The major weekly recap becomes eligible Tuesday at 6:30 AM Eastern. It sends
   only after the week is trustworthy; a late result sends as soon as it settles
   rather than waiting another week.
6. The normal default-week handoff is Wednesday at 3:00 AM Eastern and at least
   24 hours after the prior week settled. If the next kickoff is less than 24
   hours away, the handoff may occur immediately when the prior week settles.
7. Default handoff never hides history. Every completed period remains
   available in the archive/week selector.

Period completion is fail-closed for missing lines, pending grades, or other
unresolved competitive records. Verified cancelled and no-contest games settle
as void disruptions and do not hold the handoff. A postponed game voids its
affected picks but stays open: it holds the handoff (the app answers `blocked`,
the database refuses to complete the week) until it is played or recorded as
cancelled or no contest.

## Playoff eligibility

Playoff competition uses cumulative season ATS wins and the remaining possible
playoff wins.

- At the beginning of each Eastern game day that actually contains a playoff
  game, the database creates one immutable eligibility snapshot for every
  active player. It waits for all earlier game days to finish reconciling first.
- Wins from games on that same day do not change who may compete later that
  day. If a player could tie the leader at day start, every eligible game that
  day still counts for that player.
- A player is out only when `day-start wins + remaining possible wins` is less
  than the day-start leader's wins. Tying remains mathematically alive.
- Future playoff periods contribute no more wins than their real remaining
  schedule and configured pick limit allow.
- When a new day-start snapshot marks a player ineligible, their affected
  future pending picks are atomically changed to `void`. They are excluded from
  totals rather than left as losses.

### Forfeiting

- A player who is still in the race may forfeit the Pick'em from the bottom of
  the Slate, as soon as the first playoff round is open for picks. It takes
  three separate clicks on three different questions ("Forfeit?", "Don't give
  up, you still have a chance! Still want to forfeit?", "I understand this
  can't be undone and my Pick'em season would end."); only the third sends
  anything, and a "Never mind" link backs out at any point.
- `forfeit_pickem_season` records one forfeit per player and season
  (`pickem_forfeits`) and, in the same transaction, voids the player's pending
  picks on playoff games that have not started (excluded from totals, never
  graded as losses, the same treatment as a player who can no longer catch the
  leader). Picks on games that already kicked off stay on the card and grade
  when those games finalize, so the score is final once the last of them has
  graded. It is idempotent and audited (`pickem_forfeited`, and
  `ats_pick_voided` with reason `forfeited`).
- From then on `replace_unlocked_picks` refuses the player's saves in the
  database itself, and `/api/picks` answers 403. The Slate and Standings show
  the same quiet "You have been eliminated, thanks for playing." banner an
  eliminated player sees, and the Standings row carries the same ELIMINATED
  stamp over the final score (a forfeit has no label of its own for players;
  only the Commissioner's Players page says "Forfeited" so it can be reinstated).
- Only the Commissioner can reverse a forfeit (Players page: a "Forfeited the
  Pick'em playoffs" tag with a two-step Reinstate). A reversal lets the player
  pick again for games that have not started; picks voided by the forfeit are
  not restored. It is audited (`pickem_forfeit_reversed`).

## NFL schedule agility and gameweek integrity

### Preseason bootstrap

- The annual bootstrap creates the new preseason when needed, downloads the
  complete regular-season schedule, and accepts it only if every game and
  week validates. The season's length is read from the feed (currently 272
  games over 18 weeks); every week must have games and all 32 teams must play
  the same number of games. A longer season adds its missing weeks before the
  playoff rounds in preseason, so a changed NFL format does not silently fit
  into the old template.
- A partial, malformed, duplicate, or structurally inconsistent schedule makes
  no database change and is retried later.
- Initial import assigns and permanently pins every game to its scoring period
  and original NFL gameweek.

### In-season reconciliation

- The canonical schedule is rechecked no more than once every four hours during
  normal operation.
- An unlocked, scheduled future game with the same provider id, teams, scoring
  period, and gameweek may receive a new kickoff and line-lock time. Its stale
  unfinalized official line is reopened so a fresh line can lock later.
- A postponed game may cross a calendar-week boundary while remaining in its
  original pool week.
- Changes to a locked, settled, disrupted, re-paired, or cross-period game are
  quarantined for commissioner review. Safe unrelated changes continue.
- A game omitted by the provider is reported but never deleted.
- Database triggers independently reject changes that would break gameweek or
  pick-to-game scoring-period consistency.

The schedule provider is canonical for game identity and timing. The odds feed
may enrich spreads but cannot override canonical schedule assignments.

## Disruptions and corrections

- A commissioner records a verified `postponed`, `cancelled`, or `no_contest`
  state through Game Exceptions. Provider refreshes never silently overwrite a
  final or disruption status.
- Pending affected ATS and Survivor picks become `void` atomically and receive
  append-only audit events. A legal unstarted replacement can be selected.
- A verified score correction uses the audited atomic correction function. It
  preserves void rows, regrades affected picks, and records league impact.
- Final-score reconciliation is read-only. It compares stored finals with the
  provider and flags discrepancies; it never edits scores or grades.
- Completed periods, games, official lines, picks, and audit history are frozen.
  Corrections are new audit events, never rewrites of original history.

## Season progression and annual rollover

- Season state follows scoring-period state: preseason before play,
  regular-season during regular periods, playoffs during playoff periods, and
  complete only after the final period settles.
- Closing a period and activating its successor is one atomic operation that
  leaves exactly one active period.
- On or after August 1 Eastern, the annual rollover is safe to retry. It returns
  the existing season if already created rather than duplicating it.
- The new season copies the prior season's ordered scoring-period template and
  configured pick limits. Every new period is `upcoming` with blank dates.
- Games, lines, picks, Survivor entries/picks, grades, scores, championships,
  player season results, and prior audit history are not copied.
- Old seasons remain queryable for personal records, archives, championships,
  and dispute resolution.
- Annual cleanup runs only after the prior season, every scoring period, game,
  pick grade, schedule review, and required championship is certified complete.
  A blocker is recorded and alerted; it never causes automation to guess.
- Certified cleanup removes only superseded pre-kickoff save snapshots,
  redundant preliminary spreads, expired worker/security state, and eligible
  180-day operational records. The final player save snapshot and every
  official game, line, pick, score, championship, and delivery receipt remain.
- The turnover creates missing active-player Survivor entries for the new
  season and stores one permanent kept/deleted-count receipt. Retrying returns
  that receipt without cleaning twice.

### Off-season mode

- The season runs from August 1 (Eastern) until the Super Bowl is final and
  graded. `public.season_phase()` (and its application mirror in
  `src/lib/season-phase.ts`) answers `in_season` or `off_season`: the current
  season year's row is complete **and** its Super Bowl period is complete. At
  12:00 AM Eastern on August 1 the season year turns over, the new year has no
  completed Super Bowl, and the phase flips back without anyone acting.
- Outside their windows the line-lock, reminder and Bowl dispatchers return
  false inside Supabase, and the score worker, pre-lock spread refresh and
  email-schedule reconciliation (called straight from pg_cron) carry the same
  `season_phase()` gate, so an idle off-season tick never wakes a function. The
  cron routes also answer `skipped` before taking a lease. The preseason
  bootstrap (which performs the August 1 rollover) and the watchdog are not gated.
  If the phase cannot be read the routes treat it as in season.
- Players see a "See you next season!" banner in place of the ticket and the
  Slate receipt, every table whole (stored hide choices are suspended, not
  erased) with no hide, "− OUT" or Bowl-hide buttons, and a read-only Slate.
  `/api/picks`, `/api/survivor`, `/api/bowl-pool` and the display fields of
  `/api/profile` answer 409 `season_closed`. A player eliminated from the playoff
  race gets the same quiet page ("You have been eliminated, thanks for playing.")
  until August 1. Notification settings, the Pool Action filter, Pool Chat, the
  Season Snapshot and its controls, and every Commissioner tool stay available.

## Automation safety and efficiency

- Scheduled and commissioner-triggered mutation paths claim the same
  token-owned execution lease. A duplicate run exits instead of overlapping.
- Reminder workers claim at most three due messages per pass. An interrupted
  claim is reclaimed only after 20 minutes and only when no recipient receipt
  exists, preventing both a stranded queue and uncertain duplicate delivery.
- The NFL score worker is called by a database gate only when it has work (a
  final due, a week to open, picks to settle, its recorded next handoff,
  Survivor or playoff day-start time, or the hourly safety run) and spends no
  provider credit unless a game's durable retry time is due. Regular-season and playoff games
  become eligible 170 minutes after official kickoff and use the same fixed
  10/10/10/10/10/10/20/20/20/60/120/240-minute delayed-final sequence, with
  the final 240-minute window reserved for emergencies.
- Remaining credits do not change the normal cadence. Repeated polling pauses
  only below the protected 50-credit emergency reserve. Every paid response can
  settle all due completed games it contains. The Bowl dispatcher checks every
  15 minutes but calls the app only when its seasonal schedule says work is due.
- Provider response headers feed a 30-day Commissioner efficiency summary of
  credits, imported finals, productive checks, credits per final, and the
  seven-day trend. Only the real 7:00 AM Eastern pre-lock window may spend the
  schedule-refresh credit, even though both DST-safe cron entries remain.
- The Commissioner grading dashboard combines score-polling credits per settled
  game and pooled-kickoff-to-accepted-final latency by game-time slate, with
  separate labeled axes. Its credits-per-game trend is weighted by games over
  the current and prior 14 Eastern calendar dates. Incomplete slates and
  ambiguous or missing polling attribution are excluded from that cost trend;
  separate game- and period-level latency charts are not shown in this card.
  Its selected-period game rows also supply the IDs for the locked-line read;
  see the [request-count note](GRADING_READ_OPTIMIZATION.md). This does not
  change grading, provider polling, or player-visible data.
- Commissioner Connected Systems also reports calendar-month quota usage,
  scheduled month-end forecast, source breakdown, and average tracked credits
  per elapsed regular-season Sunday. This is the planning view for the
  provider's monthly reset; the 30-day view is strictly
  an efficiency trend. Bowl Pool schedule and scores use ESPN by default and
  do not consume NFL Odds API credits unless the NCAAF fallback is explicitly
  enabled.
- Schedule-provider failures use a circuit breaker and shared cooldown. Manual
  commissioner override may bypass timing, but not authentication, leases,
  quota reserve, pins, or atomic validation.
- Mutations are idempotent or retry-safe. Imports validate before writing;
  rollover returns the existing result; line locking and scoring operate only
  on due records.
- When the watchdog proves a critical worker is unhealthy while it has real
  due work, it makes one lease-protected recovery attempt through that worker's
  normal line-lock, score, or reminder path. It immediately rechecks the saved
  result; an incomplete recovery remains an actionable incident rather than
  being reported as healthy.
- Operational logs and delivery receipts are retained and reviewed separately
  from permanent competitive history.
- Once per Eastern day, the leased watchdog reuses Launch Preflight's
  zero-credit external checks for cron authorization, Odds access, the active
  Brevo sender, and a Commissioner alert address. A failed daily check retries
  no more than hourly and becomes one deduplicated configuration incident.
- Launch Preflight also reports the name—not the value—of the selected
  Supabase server credential. Production is healthy only when the managed
  `SUPABASE_SERVICE_ROLE_KEY` path is accepted. A working compatibility
  fallback remains available for isolated/local recovery but opens a drift
  incident in production instead of silently becoming authoritative.
- The public automation heartbeat proves that an authenticated, leased
  watchdog invocation reached the database and recorded a durable run receipt.
  Its 35-minute freshness window absorbs bounded five-minute cron and
  serverless delivery jitter while retaining a finite outage signal.
  It is intentionally written before the watchdog's heavier diagnostics,
  provider checks, alert delivery, Bowl readiness, and cleanup. Those failures
  remain visible as failed watchdog runs and actionable incidents, but cannot
  make an otherwise running scheduler flap the external liveness monitor. A
  failure before the durable receipt still fails closed.
- A weekly storage guardrail runs through the protected Monday watchdog and
  removes only routine `sync_runs` plus resolved watchdog and schedule-review
  incidents after 180 days. The certified annual cleanup may additionally
  remove superseded pre-kickoff save snapshots and redundant preliminary
  spreads from the completed season. Final save snapshots, picks, final scores,
  official lines, championships, and email receipts are never part of cleanup.
  During the live season, repeated unchanged preliminary spreads are stored at
  most once per Eastern day.
- Players choose one of three email plans: **Essentials**, **Regular**, or
  **Full Card**. Each remains individually adjustable in Notifications; existing
  choices are never changed just because the plan labels evolve. Regular includes
  the daily playoff recap; Full Card additionally includes every playoff kickoff
  reveal. A playoff recap is delivered to anyone who selected weekly recaps or
  the legacy dedicated playoff-recap choice, so custom weekly plans do not miss
  the round summary.
- Final gameday lines use one explicit choice: every gameday, Sundays only, or
  none. Selection reminders use three independent choices: Sunday 11:00 AM,
  Sunday 3:00 PM, and the combined Sunday 6:00 PM/Monday 5:00 PM primetime set.
  All times are Eastern, and a reminder sends only while that player can still
  make a needed selection.
- Those plans are operational schedules, not just presets. The reminder worker
  queues each promised occurrence from the live NFL schedule, safely replaces
  unsent occurrences after a flex or cancellation, and preserves sent wording
  plus the exact source-game receipt.
- Public-pick emails are scoped to their exact kickoff window and are intentionally
  suppressed when nobody selected a represented game. Playoff reveals normally
  become one message per game because playoff kickoff times rarely match; games
  combine only when their kickoff timestamps match. Each playoff receipt shows
  every player eligible for that matchup, including an explicit no-pick loss, but
  never repeats picks from an earlier kickoff or exposes a later one.
- Regular-season Sunday and featured-window reveal images also carry a Survivor
  section, in the same image under the Pick'em table: each Survivor pick on a
  game in that window that has already kicked off, with W or L once graded.
  Picks on later games stay private. Playoff reveals have no Survivor section.
- Wednesday Slate and Tuesday recap subjects include the scoring-period name.
  Playoff reveal subjects include the round, matchup, and represented Eastern
  game date; playoff recap subjects include the completed round and game date.
  Daily playoff recaps identify eliminations, and the final recap explicitly
  crowns the Pick'em champion or co-champions. After Survivor concludes, weekly recaps automatically use
  Pick'em-only wording; the championship-week recap still memorializes the
  Survivor champion.
- Email artwork is pre-rendered by the reminder worker and served from the
  public `email-artwork` Supabase Storage bucket. Reminder manifests make
  retries reuse the same assets; the Vercel image route remains for older sent
  messages and as a fallback when static storage is unavailable.
- Multiple valid pool emails may be delivered on one day when the live schedule
  and the player's choices call for them. Every occurrence retains an immutable
  source-game snapshot, and the unique reminder/player delivery receipt plus
  uncertain-retry guard prevent duplicate copies without suppressing a different
  valid message.
- ESPN is the default NCAA Bowl Pool schedule, preliminary-line, and final-score
  source. The Odds API's NCAAF markets are used only when
  `BOWL_POOL_ODDS_API_ENABLED=true`; an existing preliminary line may lock when
  no fresh market is available. Locked lines and commissioner-curated bowl
  names, order, or exception status survive provider refreshes.
- The ESPN schedule pull (`syncAnnualSchedule`, rules in `src/lib/bowl-pool-espn-schedule.js`) reads each bowl's name from ESPN's headline
  (the event's own name is the matchup) and pairs it with our row **by name**: ESPN's name ends with ours ("Union Home Mortgage Gasparilla Bowl"
  is "Gasparilla"), so a changed sponsor does not matter, and kickoff time alone never pairs two games (the four first-round games share one
  headline and are told apart by time). A row already linked to an ESPN game keeps it. Only FBS bowls and College Football Playoff games enter
  the pool: the FCS playoff and the Celebration Bowl (the FCS conference-champions game, left out by the owner's choice) are ignored. A game ESPN
  lists that we lack is added, named in the seeded style, and the display order is renumbered by kickoff unless the Commissioner has curated one.
  A kickoff replaces ours only when ESPN has confirmed the time (`timeValid`): a game with a day but no time keeps its placeholder, is marked
  `time_confirmed = false` (players see "Time TBD") and gets no pick-due reminder; a new game with no time waits at noon Eastern on its day. The
  database lets such a placeholder kickoff be corrected even after picks or a locked line exist (a confirmed kickoff stays frozen), because
  otherwise an early pick would freeze the placeholder. A team ESPN still lists as "TBD" is no team: a game gets both teams or neither, never a
  TBD team a player could pick. A kickoff that moves cancels the game's queued reminders and releases their key so the new time queues fresh
  ones. A pull that finds nothing new writes nothing.

## Action-only watchdog

The watchdog evaluates frequently but opens one incident and sends one alert
only when commissioner action is likely required:

- a game passed line lock without an official line;
- final scores are due and the score worker is failed or stale for 45 minutes;
- a scheduled pool message is overdue or stuck sending;
- the full schedule is still incomplete after August 15; or
- a required production cron/preflight condition is missing.

Individual bad email addresses and intentional provider cooldowns do not alert.
An incident resolves automatically after recovery and may alert again only if
the condition genuinely recurs.

## Commissioner controls

The Grading page uses every data point recorded, not a window of recent rows. The
polling histogram (new game finals by retry rung) reads every score run that
recorded a rung since the start of the season, in pages, and says which date it
starts from (rungs were first recorded on Sep 21; earlier checks did not record
one and are not guessed). "Last score sync" reads score runs only, Worker activity
shows the latest run of each worker, and the efficiency totals are season to date.

The Grading charts share the dashboard's selected period and adaptive refresh:
every minute while games are live, attention items are open, or a scheduled
kickoff is within 15 minutes; otherwise every five minutes. Polling pauses while
the tab is hidden and refreshes immediately on return. A periodic poll is skipped
while another dashboard request is in flight. The Standings page polls every
three minutes while visible, refreshes when the player returns (at most every 30
seconds), and refreshes exactly at each pick reveal. Reminder delivery is gated
in Supabase so idle ticks never call Vercel.
If a Commissioner response omits a measurement, its
numeric label displays a dash instead of crashing the surrounding dashboard.
The Home standings read does not perform Survivor enrollment or elimination
maintenance; those changes run through the existing scoring and selection paths.
Season-wide pick reads paginate through PostgREST's 1,000-row response limit.
Commissioner-facing player activity is best-effort and rate-limited to one write
per player per 15 minutes per warm function, with a database-side cutoff to
coalesce concurrent instances. Chat, settings, snapshot, and Home reads do not
update activity; successful sign-in and player actions do. Board and Survivor
reads can also refresh activity, subject to the same throttle.
The Players page (Commissioner only) shows for each player: emails on or off, whether they have ever opened the installed app, whether a phone
or computer is subscribed to notifications, the days they visited in the last seven (`player_visit_days`: one row per player per Eastern day,
written once a day per warm function), when and on what they were last seen (a short fixed label such as "iPhone · Home Screen app" or
"Windows computer · Chrome", made on the server from the browser's User-Agent; the raw text is never stored), and totals across the pool.
The installed app marks its requests with an `X-Pickem-App` header, which is how "has the app" is known; it reads "not yet" until the player
opens the app once. The device and visit figures ride on the same throttled activity write, and a device change is written even inside the
15-minute window. If the visit or notification records cannot be read the list still loads and that figure says "Unknown" or is left out,
never a false zero.
Monthly credit usage runs from the first UTC day through today, with daily and
cumulative views of recorded provider costs (charged failures included).
Provider-reported quota snapshots remain separate from logged costs. Receipt
queries paginate so a busy month cannot silently lose older records.
Slate efficiency uses exact kickoff times; legacy receipt attribution is
explicitly estimated and withheld for overlapping windows. The ladder plots
fresh-final counts with widths proportional to configured polling gaps.

### NCAA Bowl Pool schedule staging

The separate NCAA Bowl Pool is staged by the Commissioner before its December
7 launch. The schedule importer accepts an ordered CSV with `order`,
`bowl_name`, `kickoff_at`, and stable `game_key` columns; team names, spreads,
and CFP flags are optional so the known bowl order can be loaded before teams
and lines are confirmed. Commissioners enter the sponsor-free display name
they want players to see. Imports are idempotent by `game_key`, update kickoff
and order without changing NFL picks, and are locked after launch. The empty
standings card is commissioner-only before launch and expands responsively for
any number of opted-in players after launch.

The Commissioner area is the operational control plane. Its intended order is:

1. Read the quiet watchdog and Automation Health.
2. Run Season Readiness, Opening Week Checklist, or Automation Preflight as
   appropriate.
3. Let scheduled automation run normally.
4. Use the matching manual line, score, schedule, reminder, or watchdog control
   once when recovery is required.
5. Use final-score reconciliation or Game Exceptions for verified anomalies.
6. Confirm Season Readiness and every settled game and pick before a rare
   lifecycle recovery.

The Email image studio renders the same PNG artwork and HTML used by delivery,
with phone/desktop previews and image downloads. Standings and recap selections
share one row per player. Images fit their content; Survivor shows at most six
completed weeks, with earlier history on the website. Commissioners edit
template wording, not image density; sent artwork uses an immutable rendered
asset so later wording or renderer changes do not restyle an earlier email.
Preview generation does not send mail, queue messages, or persist a recap
snapshot. Saved data and fictional layout samples are explicitly distinguished
when final data is unavailable. Grading remains the place to correct results.

The Reminders view is an action queue, not a health score: it plainly lists
automatic messages, items needing attention, and empty reveal windows intentionally
suppressed. The Commissioner may edit
standard future wording but cannot create an ad-hoc scheduled pool blast. The
built-in email test sends only to the signed-in Commissioner's opted-in address,
never the player pool.

Manual controls are recovery paths, not alternate implementations.

## Environments and deployment

- **Production** contains the real league. Never seed it or run destructive
  tests against it.
- **isolated-test** contains disposable fixtures and mirrors migrations. The
  exact confirmation value `isolated` is required before integration work.
- Application changes pass tests, lint, build, GitHub quality checks, and a
  Vercel preview before merge.
- Release work uses one clean branch and one push after local verification.
  The release helper checks GitHub reachability before treating a saved login
  as expired, rejects credentials in the remote URL, and passes authorization
  to Git only for the command being run. New commits to one pull request cancel
  superseded application-quality runs. The post-merge main-branch quality run
  remains until branch protection requires that check and prevents bypass.
- Every human-authored pull request runs the real PIN/session/player flow
  against the confirmed isolated project, including account navigation, a
  transient profile-read failure, pick persistence, and Survivor replacement.
  Dependabot pull requests receive an explicit successful no-secret gate because
  GitHub intentionally withholds environment secrets from those events;
  Application quality still validates them without privileged credentials.
  Production is explicitly rejected by the browser-test harness.
- A successful Vercel production deployment starts an independent smoke gate.
  It retries the canonical site plus availability, automation, aggregate-worker,
  backup, and Bowl Pool contracts until all return HTTP 200 or the release is
  marked failed. Individual worker and settlement monitors remain separate
  UptimeRobot signals; they are not part of this smoke script.
- The public worker contract stays deliberately opaque, but its exact same
  due-work and heartbeat evaluation powers the Commissioner Automation Status
  card. A 503 can therefore be diagnosed there by responsibility (line locks,
  final scores, or reminders) without exposing operational timestamps publicly.
- Client error reporting discards only exact, confirmed browser-extension
  infrastructure noise; broad message classes are never suppressed. Player
  identity remains excluded from every Sentry event.
- Database changes are new timestamped migrations. The production migration
  workflow dry-runs before applying them; the isolated project receives them
  first for lifecycle-sensitive work.
- The current full-season certification fixture covers 18 regular weeks, four
  playoff rounds, and 285 games, plus schedule changes, disruptions, scoring,
  eligibility, privacy, Survivor, archives, and annual rollover. It deliberately
  tests the current format; production schedule validation is feed-driven.
- The scheduled Wednesday isolated workflow also rehearses one realistic live
  week: revised ATS and Survivor saves, final grading, historical retention,
  and an atomic next-week handoff. Its transaction is always rolled back.
- The monthly upgrade rehearsal updates dependencies only inside the isolated
  job, applies every migration, runs the lifecycle drill, lints, and builds. It
  never commits upgrades or deploys production. Its scheduled gate uses the
  canonical NFL calendar to choose the first available non-gameday each month,
  includes playoff dates, fails closed on missing in-season schedule coverage,
  and records one completion marker so it cannot repeat after success. A
  scheduled failure also waits until the following month; a manual run is the
  explicit retry mechanism.

## Documentation maintenance contract

Any change to a pool rule, lifecycle time, provider policy, privacy boundary,
manual control, database invariant, or deployment gate must update all three in
the same pull request:

1. the executable test demonstrating the new rule;
2. this project reference and the affected runbook; and
3. `docs/DECISION_LOG.md`, including the reason and superseded rule.

Use the [SOP index](SOP_INDEX.md) to find the correct operational procedure.
