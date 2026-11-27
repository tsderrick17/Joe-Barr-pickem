# Durable decision log

This log records project rules that future changes must not casually reverse.
Entries preserve the original reasoning; a later change marks an older detail
as superseded and records the current contract rather than rewriting history.

## Where older decisions are

This file holds the most recent entries, newest first (about the last two weeks).
Older entries are archived unchanged, with the same standing, and are found
with a text search (for example `grep -rn "Survivor" docs/decisions`):

| Archive | Entries |
| --- | --- |
| [2026-11-early.md](decisions/2026-11-early.md) | 2026-11-01 to 2026-11-14 |
| [2026-10-late.md](decisions/2026-10-late.md) | 2026-10-05 to 2026-10-31 |
| [2026-10-early.md](decisions/2026-10-early.md) | 2026-10-01 to about 2026-10-06, plus the undated polish entries appended after them |
| [2026-Q3.md](decisions/2026-Q3.md) | 2026-08-09 to 2026-09-29 (including REF-001 to REF-034) |

Add new entries at the top of this file. When it passes about 60 KB, move
everything older than about two weeks into a new file under `docs/decisions/`
and add a row above. (It is read at the start of every change, so short is cheaper.)

## 2026-11-26 - Pool stats: Most faded teams

Beside Most picked teams is the same table for the teams faded: the team on the other side of each graded pick, its share column named
Picked against. From 1200px the three tables (What the league picks, Most picked, Most faded) sit in one row, each title over its switch, two-line
column names and teams by nickname (Chiefs, 49ers) so every row stays one line and the three line up; 900-1199px it sits under Most picked in
the right column; stacked on a phone. Its record is the picks' own, so a high hit rate means fading that team paid off. Share is of all graded picks, like
Most picked. It has its own sort (Faded or Hit rate, pressed again to turn it over: Most / Least faded teams, Best / Worst teams to fade) and
its own All-time / This season switch. Both team tables use the same fixed widths for every column but Team (Picked against and
Hit rate may take two lines), so a team name wraps in one only where it would in the other. Requested by the Commissioner.

## 2026-11-26 - Shutout Free Weeks count the first win at once

A week's first win already rules out a shutout (0-2), so Shutout Free Weeks in a Row now counts a week still being played the moment the
player has a win in it, without waiting for the second pick to be made or graded. This mirrors Perfect Weeks, which already ends the moment
a week in play has a loss. The week still is not a counted week for anything else (Perfect Weeks total, the group's weekly records) until it is
decided. Reported by the Commissioner: a first win of the week left the streak unchanged.

## 2026-11-26 - Clubhouse: a real beach outside the glass

- The outside of the clubhouse room is drawn to look real (owner: "the palm trees ... not very convincing. None of the outside is really"). Coconut palms: a grey, weathered trunk ringed where old fronds fell, swollen at its foot and tapering up, a boot of old frond bases, green and brown coconuts, and a crown of long feather fronds (narrow leaflets hung from the midrib in a V, light between them), young ones upright, older ones arching over, one or two dead brown fronds hanging. Sky: fair-weather cumulus, white on top and grey underneath, with haze at the horizon. Sea: wind ripples catching the light; turquoise shallows fading into deep blue with no edge; grainy, rippled sand; a darker band of wet sand and a lacy line of surf at the waterline.
- Nothing inside the room moved: every new surface draws from its own random counter, and the shared one is still stepped exactly as before, so the tap spots (`src/lib/clubhouse-room.json`) are unchanged.

## 2026-11-25 - Clubhouse: a bookcase by the fire, a real neon sign, Notifications on the thatch

- A low walnut record cabinet stands against the chimney's near face under the constitution (owner's spot and ask): two rows of square bays packed with LPs on their edges, spines out in their covers' colours, two or three leaning at each bay's end so their covers show (sixteen made-up covers on one sheet, no real words). On top a small record player (walnut plinth, black record with a red label, tone arm) between two walnut bookshelf speakers toed in toward the room. It stands clear of the stones' relief.
- The neon is a real sign now (owner: "looks flat"): lit tubes (a white core in pink glass with a glint) on a clear acrylic backer held off the walnut by four brass stand-offs, their soft shadow and a pink haze on the wood, and a little real pink light on the walnut round it.
- On a desktop the Notifications pill sits on the thatch just under the beam, left of the ledge plants (owner, 2026-11-25).
- The tucked ticket's spacing (owner: "a little sloppy"): each place's mark and words sit centred in its share of the ticket instead of pushed left, the padding above and below is even, and the lamp dot is smaller and closer to its mark.
- On the clubhouse Bowl ticket a game's name never wraps onto a second line (owner); the logo pennants are shorter (7.25rem from 9rem) to give the names room, and a name that still does not fit ends in an ellipsis.
- The Bowl sheet's win counts are cream figures on navy flaps, like the games-left counter: the ticket's cream ink had fallen on cream flaps and they could not be read (owner, 2026-11-25).
- Your ticket's top is tighter (owner: trim excess space): the line note is two lines at most on a phone ("Gold line: locked. White line: can move until 8 AM on game day."), the gaps under the week row and between sections are smaller, and All games | Pool action is one touching switch like the chart's All | 6 Wk, two equal halves filling the left half of the row.
- A lamp that is not lit has no gold rim, and a pick on the ticket but not sent shows a cream ring instead of a gold one, so only a lit lamp is gold (owner: the gold outline made him look twice).
- The Bowl ticket's header is shorter: the games-left counter stands to the left of the dial instead of under it.
- Picks waiting to be sent or saved on a clubhouse ticket are guarded on every way out: closing the pop-up or going back asks (as before), a link out of the clubhouse asks the same question and then follows it, and closing or reloading the app asks the browser's leave-this-page question (owner, 2026-11-25: picks made in the clubhouse must never go missing on the way to Classic). Both views save Bowl picks through the same POST /api/bowl-pool and read the same entry, so a saved pick shows in both.
- Save is never a scroll away (owner's pick of four ideas, 2026-11-25): on both clubhouse tickets the Save picks / Submit button rides a bar pinned to the foot of the ticket's list while changes are waiting, with the count of changes beside it ("1 change"), sliding up at the first change; with nothing waiting it rests at the end of the list saying Saved or Submitted.

## 2026-11-25 - Bowl scores flip on every visit; rounded lines on the clubhouse chart

- The classic Bowl Card's score tiles spin in every time the card is opened or the page refreshed (owner, 2026-11-25), the same as the clubhouse Bowl sheet. The once-a-day-per-player memory in the browser is gone. Reduced motion still lands them at once.
- The two Frisco bowls keep the same pennant colour (owner: fine as is).
- On the clubhouse Season Snapshot (the chalkboard's chart) the lines' bends are rounded: a monotone curve through every week's point that never swings past the totals on either side, so it never shows a score nobody had. The classic Pick'em Pad chart keeps straight lines until the owner decides after trying it in the clubhouse.
- The Season Snapshot's key has quick choices under it, in both views: Top 5, Me + Top 5 (only when you are outside the top five), All and None, with "N of M shown" at the end of the row; tapping a name still adds or removes just that player. A pool of eight or fewer opens with everyone; a bigger one opens on you and the top five. Colours still follow the person.
- The Big Board's way to your ticket is set like your ticket's own heading: a small YOUR TICKET over what is left (picks still owed counted in a red seal, the words in ink), and once saved, when, on the right. "Tap here" is gone: the whole ticket is the button and its stub says PICK or VIEW.
- In the clubhouse the Bowl Pool's Claim your seat ticket keeps its navy and gold but has the room's rounded corners, and its perforation notches are cut through the card. It also carries its own colours (it came through see-through over the room after an opt-out, 2026-11-25).
- The clubhouse Notifications pop-up is its own card, no longer the Notifications page restyled (owner: "doesn't fit the design aesthetic; should be intuitive and easy to know the options"): set like a phone's settings on the ticket's paper. On this phone first (Get the app, phone alerts), then Email: a "Send me pool emails" switch and the address, the plan as three plain choices (Essentials, Regular, Full Card) with what it sends underneath ("Your own mix" when none matches), every single email folded under "Choose each email" as switch rows grouped The Slate, Pick reminders, Pick reveals, Recaps & playoffs, and one Save. It saves exactly what the Notifications page saves (one shared `useNotificationChoices`).
- Haptics across the clubhouse, with the app's five feels and their one meaning each: picking on your ticket ticks, taking a pick back is a light tick, a full ticket warns, a Survivor team locks in (as on the Slate); tapping a place in the room, the ticket, the deck's tabs, the Big Board's week and links, the Bowl ticket's Picks/Sheet and the Notifications fold tick; a pop-up put away by the player gives a light tick (shared Sheet, the Commissioner's too).
- On a desktop the Chat pill sits on the bar's front panel, just under the counter by the laptop (owner, 2026-11-25).
- Room texture pass: the beams and mantel are solid timber with grain, knots and checks; the leather (poker chairs, the table's rail, the bar stools) has a fine hide grain. New surfaces draw from random streams of their own so nothing else in the room shifts.
- The chalkboard's still sketch is lighter and less basic (owner: "a bit too bold and a bit too basic"): seven fine chalk lines that weave and cross over nine weeks like a real season, each with a soft halo of dust and a dot where it ends, faint dashed week guides and a finer axis. Still no names, numbers or title.
- Plant realism pass: every leaf wears a skin (pale midrib, fine side veins, lighter at the stem and deeper to the edges, a faint stipple), a waxy sheen and a little light through it; stems are a lighter grey-green; the bird of paradise's paddles are broader, cupped and split along their veins.

## 2026-11-23 - Small batch: trophies beside names, centred sun and moon

- The clubhouse Big Board and Bowl sheet (and the Bowl ticket's standings list) show the champion's trophy beside their name like the classic pages (`PlayerTrophyName`, titles on hover, only the current holder wears the mark). The board's rows now carry `trophies` and `holdsTrophy`.
- The day/night button draws its sun and moon as SVG in one exact square instead of typing the characters: the typed sun sat off-centre (font side room, worse for the emoji sun) and turning it on night mode swung it further off. A test measures both glyphs at the button's centre.
- The clubhouse ticket's tuck control is just an arrow on a small folder tab at the ticket's far left (like the Slate's How it works chevron, turning the other way, with no words). The fold is one measured motion (2026-11-25, after the owner called the old one awful): the ticket's edge glides to its new height while each logo slides from where it was to where it now sits, the words fade in place and the heading fades as it goes, all on one smooth deceleration with no overshoot (420 ms, the iOS sheet curve); the arrow turns on the same curve and the tab presses down when tapped. Nothing moves with reduced motion.
- Workshop Lab: a "Game states" try-out (first on the shelf) shows the real Big Board and ticket in nine states on sample players, hand-written to match what `boardView` and `roomTicket` produce, so the owner can review every state in one place. No pool data is read.

## 2026-11-23 - Clubhouse: chalkboard, bottles, one lamp, sheet snap, city and state, mantel ship, deeper stone

- The chalkboard was a "Snapshot" pill only; the board face is now a tap target for the Season Snapshot too. The bottles on the back bar open Pool chat. Both are real-clubhouse hit areas with no plate of their own.
- Only the ceiling light changes day and night; the bar lamp no longer does.
- The Bowl ticket's sheet snaps to a game column like the classic Bowl Card (scroll-snap, game columns align to the held columns).
- Each Bowl ticket game's small line carries where it is played (city, state) after the time, on the same single line (ellipsis, never wraps), so a row is never taller for it. Pennants stay non-tappable.
- The chat pill sits slightly lower and to the right. The mantel ship is smaller and turned so it sits on the mantel instead of running into the stone. The fireplace stone has deeper joints, cavity shading, pitting and grain; per-stone relief is tabled for about a week (owner).
- The Trophy Room's plaque shelf has no visible "Plaques" heading (still a labelled region).

## 2026-11-22 - Clubhouse: the chalkboard is a still chalk drawing

The chalkboard in the room no longer draws the live chart: it is a still chalk sketch of a race (an axis, four coloured chalk lines,
old dust), so it reads as a real chalkboard and the room no longer reads the Season Snapshot as it loads. Tapping it opens the Season
Snapshot (with no title line: the owner wants the room for the chart). The Chat plate stands on the bar stools just above the board, and on a phone's home
screen app the ticket's frame stands clear of the screen's rounded corners.

## 2026-11-22 - Season Snapshot: flat weeks are flat

Lines on the same total stack side by side so none hides another, but each player's place in the stack was chosen fresh every week,
so a player who won nothing could wobble a line-width as others arrived on or passed through their total. Now a player keeps one lane
for as long as they stay on a total (a week with no win is dead flat), only the players really on a total share its lanes and those
already there keep theirs, and lanes go in stacking order, centered on the total when nobody is settled there. This applies to every
Season Snapshot chart: the Pick'em Pad and the chalkboard, All and 6 Wk, the regular season, the playoffs and the Bowl Pool.

## 2026-11-21 - Clubhouse: the chalkboard carries the Season Snapshot

The Bowl Pool's bulletin board was only wheeled into the room from Dec 7 and was never the way into the Bowl Pool (the poker table's
plate is, once Survivor is done). It is gone, and with it the six bowl-season pictures of the room. In its place a chalkboard on a wheeled
walnut stand stands in the room all season at the front right, in front of the poker table (further right on a desktop, whose
wider view would otherwise put it in the middle). Its slate is live like the two screens: the page draws the Season Snapshot's own chart
on it, the same chart as the Pick'em Pad (its last six weeks; the playoffs once they begin) in a chalk skin without its key, and a player
who cannot see the Season Snapshot yet (before Week 6 settles) reads "Opens after Week 6". The owner found the first hand-drawn sketch
hard to read. Tapping it opens the full Season Snapshot (#snapshot), working exactly as on the pad, on a slate in a walnut frame. The
chalk colours are the pad's order of hues, toned for the dark slate and checked so the first eight players stay apart for normal and
colour-blind eyes. The Bowl Pool has its own chart, a point a bowl day once every bowl that day is decided, built from the Bowl Pool's
read the room already makes (`bowlSnapshot`); it joins only once the first 10 bowls are final (`bowlChartReady`), so it opens on a real
race. Then the board turns between the two pools every 10 seconds and the full chart gains a Pick'em | Bowl switch, remembered on the
device. The chalkboard and its chart share one Season Snapshot read, made again only when a result changes the standings. The owner
asked for no weekly story line or rival line.

## 2026-11-21 - Clubhouse pop-ups: one notch, data-only scrolling, the tiebreaker in the title game

Every clubhouse pop-up has the same pull notch at the same spot (a tall pop-up had squeezed it to a sliver on a desktop). Each scrolls
only its data under a heading that stands still: the ticket's games and its send box, the Bowl Pool's bowls, the Constitution's
articles, the Trophy Room's rooms; the scroll bar runs tight down the data, never beside a heading or out at the screen's edge, and a
pull-down to close counts only once that data is back at its top. The Bowl tiebreaker is back in the title game's own box ("Closest
wins."), the Bowl sheet's matchups are two quiet lines ("Teams TBD" before the schools are set) and the bowl pennants are a little bigger.

## 2026-11-21 - Lab try-outs retire once they ship

The Workshop Lab kept sample versions of the Bowl ticket, the Big Board (tote board) and the Clubhouse room after all three went live,
so every change to the clubhouse had to be made, pictured and tested twice. A try-out now leaves the Lab once it ships: those three are
gone, with their sample data, styles, pictures and tests. The pieces the live clubhouse borrowed from the Lab moved into it (the Survivor
board, now `src/components/clubhouse/survivor-board.tsx`; the Big Board's paging, `src/lib/board-pages.js`; the room's picture map,
`src/lib/clubhouse-room.json`). Behaviour only the Lab's room was tested for now runs on the real clubhouse: tap spots at least 44 px,
name plates never overlapping on a phone or desktop, the Big Board turning a page every 8 seconds, the games board shifting a row every 7.
The Lab keeps what has not shipped: the Survivor poker table, Pad skins, the Horse race and the haptics feel test.

## 2026-11-21 - Tests trimmed to what catches problems

The screenshot suite had grown to 982 runs and 1,436 pictures, mostly from picturing every state at four or five widths in both themes.
It now follows one rule (`test/visual/coverage.ts`): every state by day on a phone and a desktop, night on a phone only for the states
with the most styles, the narrow phone and tablet only for each page's most crowded states; a Lab try-out live in the clubhouse keeps
one picture a state; width sweeps that only check things fit run at the narrowest phone and the tablet. 715 runs. The baseline workflow
gained a prune switch that records every picture afresh and leaves out stale ones. Unit tests that only pattern-matched a component's
source (against this repository's own rule) were removed; the slowest checks sample less (a year, not two, with every daylight-saving
switch and midnight still covered; 800 seeded playoff scenarios, not 5,000); twenty-one one- and two-test files became four area files
(bowl, email, player, Survivor rules) with no test lost. Owner's choice of the standard set, 2026-11-21.

## 2026-11-21 - Clubhouse code lives in its own folder

The clubhouse went live from the Workshop Lab, so its real pieces were still in `src/components/lab/` beside the Lab's samples. They
now live in `src/components/clubhouse/`, one file a piece: `room-scene` (the room picture, boards and name plates), `room-ticket`
(your ticket at the foot), `big-board`, `ticket-form`, `lamps` (lamps and logos), `trophy-room`, `constitution`, `popups` and `chips`.
`src/components/lab/` keeps only the Lab's sample rooms, which draw the same pieces. The ticket's states are worked out in
`src/lib/clubhouse-ticket.js` and its styles are `src/styles/82-clubhouse-ticket.css`; the kickoff and line helpers every board shares
are `src/lib/game-lines.js`. Unused Commissioner styles (the old command bar and panel tabs) were removed. Nothing a player sees
changed: every screenshot is the same.

## 2026-11-21 - Clubhouse: your ticket is an admission ticket

The ticket pinned at the foot of the clubhouse was the board’s own green with amber lettering, so it clashed with the green Big Board
over it and said little more than lamps and a count. It is now an admission ticket on cream card (the Lab ticket-and-receipt family),
chosen by the owner (option A) and given a second, showcase-quality pass on 2026-11-21:
- The body: a fine brass frame inside its edge; the week over YOUR TICKET in the Big Board’s own serif lettering; one place a pick,
  divided by hairlines, each with the team’s logo, its lamp set at the logo’s shoulder (dark, lit, green, red; Survivor’s spade),
  the team and line, and the kickoff or result. Survivor’s pick is its team’s logo under the word Survivor, never the team’s name.
  A place still to fill is an empty ring, named (Pick 1, Survivor) and marked Open.
- Across a perforation notched at its ends, a dark stub is the one thing to press: PICK while a pick is owed (with how many are left),
  VIEW once all are in.
- The heading’s right side is always a small word over a short value, from the first state that holds: FORFEITED or RACE OVER /
  Score stands; FINAL / the week’s record (1–1); nothing while a pick is owed (the stub counts them; owner: no next game on the ticket); ALL IN /
  Change until kickoff; ALL IN / Locked. Saved / the time shows for a while after a save. It never speaks of picks locking (owner:
  unclear); the Bowl Pool’s owed bowls likewise show just their game time. Where a player stands is the Big Board’s to say, never the
  ticket’s (owner, 2026-11-21).
- Every place is open, missed (nothing left to put it on: a fainter ring, No pick, never counted as owed), in (kickoff, Live or
  Postponed), or won/lost (Pick’em against the spread with a push said as “Push · loss”; Survivor straight up with a tie said as
  “Tie · loss”). All of it is decided in one place, `src/lib/clubhouse-ticket.js`, with a unit test a state.
- Built for the playoffs first: a playoff round has a place a game in kickoff order (a game still to pick named by its matchup,
  BUF @ KC); a pick is owed only for a game still to kick off. The owner wants all work
  built for the playoffs (2026-11-21). The ticket is always one row so it never grows over the room: four across tighten their type and
  show a game still to pick as a ring marked PICK; on a phone five or six show each place as its logo or ring and line alone; on a
  desktop each place lies on its side and a playoff round widens the ticket. A behavior test holds that no name plate in the room is
  covered, in a regular week and the Wild Card, on a small phone, a phone, a laptop and a desktop (owner worried the playoff ticket
  would cover the poker table’s Bowl Pool plate on a desktop; it did, and a 1366×768 laptop clipped the Survivor plate even in a
  regular week).
- The way to your ticket under the Big Board is a small ticket of the same card, its verb on the same dark stub.
- On a phone it is fixed to the foot of the screen at whatever height it needs. By night the card is a little warmer and dimmer (theme
  tokens, not night rules). House fonts only; pop-ups still have no X.

## 2026-11-20 - A provider blip does not page the Commissioner for an hour

The watchdog's daily external check asked the odds provider once with a 10-second limit. One dropped connection at 9 PM Eastern opened
a critical "Scheduled automation configuration is incomplete" incident, emailed and paged the Commissioner, and the failure stood until
the hourly retry. Now the zero-credit odds check is tried three times, 2 and 5 seconds apart, before it counts as failed (an answer of any
kind, even a refusal, is taken at once); its detail says whether it timed out or the connection failed; and a failed daily check runs
again after 15 minutes, not an hour. All three cost no provider credits. Unit tests hold the retries and the 15-minute recheck.
## 2026-11-20 - Clubhouse: a pick is never lost, and the tiebreaker is always in sight

A player could tap teams on the clubhouse ticket and put it away (slide it down, Escape, another tab, another week, the phone's back
gesture) without pressing Submit, and the picks were dropped without a word; the Slate has always asked first. Now any of those, while
the Pick'em or Bowl ticket holds picks not sent, holds the ticket up and asks: Send my picks (sends them, then carries on), Go back to
my ticket, or Leave without sending. Once sent, the Big Board's bar says PICKS SAVED with the time, and the Bowl ticket's Save says
"Saved at" the time. The Bowl tiebreaker (total points in the title game) was a small box on the title game's row, the last of some
40 bowls, where a player could not find it: it is now in the ticket's own box beside Save, gold-edged while blank, the title game's row
is marked TIEBREAKER GAME, and a save without a guess reminds the player. The Pick'em ticket now says what its line colours mean while a
line can still move (gold: locked; white: can still move until 8 AM on game day), as the Slate does. Behavior tests hold each.

## 2026-11-20 - Clubhouse efficiency pass

Measured on open (phone and desktop): both room pictures (day and night) loaded at top priority, and a desktop loaded the phone's pictures
before its own (about 340 KB extra on a phone, 760 KB on a desktop); the room waited on a third, chained read (last week's totals, for
the Big Board's arrows) before it appeared; the Trophy Room (the pool's whole history, the heaviest read) was read the moment the room
opened; closing any pop-up read the room again. Now: the picture on screen is started as the page opens and is the only one loaded
first (the other theme follows after 2.5 s, so the lamp switch stays instant; the wide-or-tall choice is known on the first render);
the room is drawn without waiting for the totals, which are read once per week per visit; the chat and Trophy Room are read ahead
after 3 s, and the browser keeps the Trophy Room's read for 5 minutes (`Cache-Control: private, max-age=300`); a pop-up closing reads
nothing (a pick sent from the ticket still reads the room at once); Notifications' settings load only when opened. A behavior test holds
the picture and Trophy Room order. Team logos are already resized in production; JavaScript is within 5% of the Standings page.

## 2026-11-20 - The poker table shows only the pool being played

Owner: Survivor and the Bowl Pool are never played at once, so the clubhouse's poker table carries whichever is: Survivor while it runs,
the Bowl Pool (in its navy and gold) in bowl season from Dec 7, and no plate between the two. Both are always tabs on the board's switch
(Bowl Pool / Survivor / Ticket / Big Board). This replaces "Survivor and the Bowl Pool are always in the clubhouse" (earlier today) for
the room; the always-there tabs stand.

## 2026-11-20 - A season list on the Standings, from the second season

Once the pool has run more than one season, the Standings (Pick'em, Survivor and the Bowl Card) carry a Season list. Choosing a past
season changes only the data: the same page reads `/api/home?season=YEAR` and `/api/bowl-pool?season=YEAR` (that season's roster is its
Survivor entries; the Bowl Pool's launch gate and the Commissioner's pre-launch list apply only to this season). Nothing is remembered: a
reload is this season again. With one season (2026) there is no list, so it first appears when the 2027 season starts on August 1.
## 2026-11-20 - Survivor and the Bowl Pool are always in the clubhouse; bowls on the ticker; lamps switch day and night

Owner: Survivor and the Bowl Pool can always be seen. The clubhouse's poker table is always Survivor's (decided or not); the Bowl Pool
has a plate all year (its bulletin board from Dec 7, by the lounge before); the board's switch always reads Big Board / Ticket / Survivor /
Bowl Pool. This supersedes the phase switching of #817 (the table turning into the Bowl Pool's, tabs coming and going). In bowl season
the room's ticker carries the bowls from the Bowl Pool's own read (three days either side): today's NFL games first, then today's bowls,
then two NFL games to a bowl. The ceiling light (and the bar lamp on a desktop) switches day and night, the header's switch.

## 2026-11-20 - No end-of-season banner

The navy banner that replaced the ticket once a player was out of the playoff race ("You have been eliminated, thanks for playing. Back
August 1") or had forfeited ("You forfeited, thanks for playing.") is gone, on the Standings and the Slate (owner: it read badly). The
player's row already says it (OUT, or the FORFEITED stamp over the final score, and "your score stands" on the board), so the page simply
shows no ticket and no receipt. Supersedes the banner in the 2026-10 entry on eliminated players; the Workshop's piece for it went too.

## 2026-11-18 - The clubhouse beta: chosen players get the switch

The clubhouse opens to a few players before everyone: each player now has `clubhouse_access` (off for all; migration
20261118010000), set from a Clubhouse On/Off switch on that player's card at `/admin/players` (`PATCH /api/admin/players`, audited as
`clubhouse_access_granted` / `clubhouse_access_removed`, put back if the audit row cannot be written). `GET /api/profile` answers
`clubhouseAccess` (the Commissioner always has it); the header's light switch and `/clubhouse` follow it. Nothing the clubhouse reads or
writes changed: it uses the classic pages' own routes, so a beta player sees exactly what the Standings and the Slate already show them.
First testers, after Thanksgiving week: Connor and Zac.

## 2026-11-18 - The clubhouse room's second pass: a real bar, a sunny shore (Commissioner only)

The room picture was rendered again with the owner's notes: the bar's walnut is veneer with true grain; the back-bar bottles hold their
spirits (amber, clear, green, red, blue) behind labels, caps and corks, lit from their shelves by day and night; the blue night light along
the bar is five soft low lights, so no plaque catches a hot spot; the glare over the bar moved beside the neon, a brass lamp lighting the
walnut there; the high shelf's vines hang over its edge instead of through it; a tall bird of paradise stands by the bar. Outside, one side
is open sea curving to a far, sloping headland, the other jungle (banana plants, undergrowth, coconut palms), under a sunny sky.

## 2026-11-17 - The clubhouse board's switch, your ticket every week, and a smoother, cleaner clubhouse (Commissioner only)

- **One board, three tabs.** The Big Board, your Ticket and Survivor (the Bowl Pool instead once Survivor is decided and the bowls are on; whichever was asked for when both are) are one sheet with a switch pinned on top. Each tab keeps its own address (#standings, #slate, #survivor, #bowl), so back still closes the board in one step. The ticket is no longer a sheet over the board: it is the middle tab, and sending it lands back on the Big Board.
- **Your ticket is always there to look at**, every week: once everything has kicked off (or for a week looked back on) it is that week's ticket as it stands, nothing left to change.
- **The standings move week over week.** The room's Big Board shows ▲ or ▼ with the places each player has climbed or slipped since last week (against every player's wins through last week once this week has a graded game, else through the week before). Regular season only.
- **The Big Board plate says what matters to you:** "You lead by 2", "You share the lead", or "Earl leads · You: T3, 2 back", with your own ▲▼ since last week.
- **Pop-ups rise out of the ticket** at the foot of the screen: a quick slide that settles softly (440 ms), the dimmed room fading in behind it; no coloured band across the top of the paper ones. Reduced motion: no slide.
- **On a phone the ticket is the foot of the screen itself:** edge to edge, flush with the bottom, top corners rounded like a drawer. On a desktop it stays a centred card.
- **A losing pick keeps its logo in full colour**: only the red ring and slash say it lost (a win is the green ring).
- **Your row on the Survivor table** is lit gold with a YOU tag.
- **The ticker's spreads** on finished games are bigger.
- **The Trophy Room** stands the plaques side by side (up to three a row, on a phone too) and has the All-Time Table with its Record / Other Stats switch, the same table the Trophy Room page shows (now one component).

## 2026-11-17 - The clubhouse room turned round, and furnished again (Commissioner only)

- The room picture is the mirror image of the old one: the bar now runs down the right wall and the stone chimney (Trophy Room,
  Constitution) stands on the left. Words in the room (the neon, the constitution, the Bowl Pool's cards and pennant, the live
  boards) still read the right way round; the name plates are anchored to the new sides.
- The lounge is white and blue: white slipcovers and white-painted cane, navy, cornflower and ticking-stripe cushions, a white table,
  a blue-and-white striped rug.
- The poker table's chairs are swivel card-room chairs on five-star bases, and each seat's cup holder is sunk into the padded rail.
- At night the blue light is placed on purpose: a neon line under the lip of the bar and of the picks counter and along the bar's foot.
  The pool's light no longer reaches in to light the counter's corner.
- The Bowl Pool's board (from Dec 7) hangs a little lower on its stand.

## 2026-11-17 - The clubhouse on a desktop (Commissioner only)

- From 1024 px wide, the clubhouse's pop-ups sit under the site's bar (never over it) and use the width: the Big Board and Survivor in a 760 px sheet with bigger type and taller rows, the ticket's games two across in a 920 px sheet, the Bowl ticket one bowl a row in a 720 px sheet, and the Trophy Room's turning table sized to the screen's height with the plaques up to three a row, centred.
- Your ticket sits centred at the foot of the screen (it used to keep to the bottom left), the place every pop-up rises from.
- With a mouse, pointing at a thing in the room lights its name plate.
- Phones are unchanged.

## 2026-11-17 - Playoff rounds in the clubhouse: the Big Board and ticket cover a pick for every game (Commissioner only)

- **No more classic page for the playoffs.** A playoff round opens on the clubhouse's own Big Board and ticket, as a regular week does (the Survivor spot shows the Big Board, Survivor being over). The pool's playoff rules are unchanged and still enforced by the server: a pick for every game against the spread, the whole round can be sent at once, any pick can be changed until its game kicks off, a pick is hidden from everyone else until its game kicks off, and eligibility is frozen at the start of each Eastern game day.
- **One column a game.** The Big Board's playoff face heads each column with its two teams; a pick is the team's logo under its own game (lit green or red once decided, as Survivor's chips are), three dark dots while another player's pick is hidden, a dashed PICK ring where your own pick is still owed. A hidden pick is placed under a game that kicks off at its time, so it never says which team or game it is.
- **The race.** Under each name: LEADS, "N BACK", OUT or FORFEITED (an out or forfeited row is greyed with the name struck through). Over the board, one line: who leads and with how many, and where you stand ("You: 1 back"), or that your score stands once you can no longer catch the leader or have forfeited.
- **Out of the race, or forfeited:** no ticket bar and no ticket; everything stays in view. **Forfeit** sits at the foot of the ticket (the Slate's own three questions) while you are still in the race.
- **The ticket** lists every game of the round by kickoff with one lamp a game, names each line on its summary by its game ("LAC @ HOU"), and sends the same POST the Slate sends.
- **The Lab** gains Wild Card, Wild Card game day and Out of the race on the tote board.
## 2026-11-17 - The Bowl Pool in the clubhouse is the Bowl ticket, with each bowl's own pennant (Commissioner only)

- **One ticket for the Bowl Pool.** The clubhouse's Bowl Pool spot no longer opens the classic page in place: it opens the Bowl ticket, the Pick'em ticket's layout in the Bowl Pool's navy and old gold, with Picks and Standings on one page and two tabs to swap between them. It is drawn from the Bowl Pool's own read (`/api/bowl-pool`) and saves with the very same POST the classic page makes (every open pick, favourite or underdog, and the tiebreaker; a game that has kicked off is never sent). Before a seat is claimed it is the Claim your seat ticket; Opt out sits under Save until the first kickoff and asks once before it happens. Before the pool opens to players it says when it opens.
- **The gauge.** The header carries a half-dial marked only at a quarter, half and three quarters of bowl season, the needle at the share of bowls decided (final, or cancelled), and the bowls left under it.
- **Picks owed are pennants, not lamps.** Every bowl flies its own pennant: the bowl's real logo in full colour on a pennant in that logo's own colours (cloth and hoist), from a table in `src/lib/bowl-logos.js` that recognises a bowl by name whatever sponsor is in front. A bowl without a logo file flies a navy pennant lettered with its short name, so a new bowl never breaks the ticket. A bowl still owed waves its pennant, its row carries a gold edge and "PICK DUE · LOCKS 7:30 PM", and the header counts them ("3 TO PICK"); once picked it hangs still; a bowl that kicked off without a pick fades to grey and says "MISSED · COUNTS AS A LOSS". The owner chose real logos in full colour over one-colour patches or names alone.
- **The logos** are small webp files in `public/bowl-logos/`, made from the logos on the bowls' Wikipedia articles (the Rose Bowl's "presented by" line trimmed off). New or renamed bowls are added by hand each December: a logo file and a row in the table. The sponsor's "presented by" tail is left off the bowl's name on the ticket.
- **The Lab** keeps the Bowl ticket on sample bowls (`?try=bowl`, first on the shelf) with a day chooser to walk the season and a Name pennants switch.

## 2026-11-16 - Pop-ups slide closed with no X; the Big Board looks back at the pool as it stood (Commissioner only)

- **No X on a pop-up, and it slides.** Every `Sheet` (the clubhouse's pop-ups, the Commissioner's, the Workshop's settings) lost its X. A sheet is put away by sliding it down with a finger (it follows the finger; a short or sideways drag springs back, a long one carries on and closes), by tapping the small handle bar at its top or the empty space above it, or with Escape. All of them slide the sheet off the bottom of the screen (240 ms) before it closes, and the backdrop fades with it; a player who asks for reduced motion gets the instant close. The handle stays a button labelled "Close" so a keyboard or a screen reader has a way out. Do not put an X on a pop-up.
- **The Big Board looks back at a snapshot.** Choosing an earlier week shows the pool as it stood when that week ended: that week's picks (as the Slate names them), and in the W column every player's wins added up from Week 1 through it, in that order. It used to show only that week's own wins. The new read `GET /api/board-totals?week=ID` returns each player's total (picks graded a win, regular-season weeks up to and including the chosen one; a push is a loss and a void pick counts nothing, exactly as the Standings count them). It reads only graded results, which every player can already see; the page asks for it beside the week's Slate and shows the week only when both answer.
- **The Survivor pop-up wears the Big Board's skin.** The clubhouse's Survivor pop-up is no longer the classic ledger on paper: it is the Big Board's green-and-gold housing with the same two tabs (Big Board / Survivor, each way across), a row per player with IN or OUT beside the name, a lit green ring round a week's win and a red slashed ring round the loss, a hidden pick as three dark lamps, the players who are out struck through, your own row marked in gold, and the status and name held still while the eighteen weeks scroll sideways. It shows exactly the Survivor Table's data (`survivorRows`); the classic Standings page keeps the classic table.
- **The room's ticker keeps the spread.** A game that is over used to swap its line for the final score. It now keeps the spread, small, between the team and the score; a game still to play shows only its line. A finished game's card drops its team logo to make room (team, spread and score do not fit beside a logo in half a screen) and lines up in three columns: team, spread in the middle, score at the right. The side that covered is the lit one (gold cell, glowing score); the other side's score is plain, and the old check mark is gone.
- **The room's Big Board top line says LEAD.** It was "LEADER" with the name starting further left than the names below it. It is now "LEAD" in the rank column, so the leader's name lines up with every name under it; level leaders show "N-WAY TIE" in that place (their names are the T1 rows below) with the shared score on the right. The winning team names on the Big Board glow less, and the Survivor pop-up's header words are centred with each other.
- **The Constitution pop-up is quieter.** The sub-line "Everything you need to know to play. Every time is Eastern." is gone (here and in the Handbook), and so is the second "Constitution" heading over the page's own "Pool Constitution" title (the sheet keeps its name for screen readers). Because the sub-line was the only place saying times are Eastern, the clauses that give a clock time (the 8:00 AM line lock, the Sunday reminders) now say "Eastern" themselves.
- **The poker table's plate** (Survivor, then the Bowl Pool) moved up into the table's near rail, between the two chairs, on the phone's pictures (the desktop picture already had it there).
- **The room's pictures.** The night sky's stars no longer use the random numbers the stone chimney is drawn from, so the bricks are the same at night as by day; the fire's light is softer and the night floor a little less glossy, so the glare no longer streaks; plants were added where they do not block the way through: a monstera at the near end of the bar, and a row of small plants of every sort (aloe, trailing pothos, fern, snake plant, cactus, baby monstera, herbs) along the ledge of the clerestory windows over the bar back. A palm tried on the floor by the lounge blocked the walkway and was taken out; keep the floor between the bar and the lounge clear.

## 2026-11-16 - All-time / This season on the Pool stats tables (Commissioner)

The two tables at the foot of Pool stats (What the league / a player picks, and the five-team table) each carry their own All-time / This
season switch at the top right of the card; All-time is the default, and the other figures on the page stay all-time. "This season" is the
newest season, and its numbers come from that season's graded picks alone (`thisSeason` from `buildGroupStats` in `src/lib/group-stats.js`).
A player with no graded pick this season sees "No graded picks this season yet." in the teams card.

## 2026-11-16 - The Big Board's week, All games / Pool action, and no ticket when nothing can change (Commissioner only)

- The Big Board's two tabs read "Big Board" and "Survivor" (they said "This week's picks" and "Survivor table").
- The week on the Big Board is a button (a native week list laid over the words): choosing another regular-season week, as far as the Slate
  offers it, reads that week from the Slate (`/api/board?bootstrap=1&week=`) and draws the board from it. A player's picks are the ones the Slate
  names under each team of a game that has kicked off, so nothing is shown that the Slate does not show; their wins are that week's; there is no
  Survivor column and no ticket (a look back only). Opening the board from the room always starts on this week.
- The ticket carries the Slate's All games / Pool action switch at its top, kept in the same place (`PUT /api/profile`, `showPoolAction`). Pool
  action leaves out a game that has kicked off with nobody's pick in it (`BoardGame.action`).
- The ticket bar (and the ticket) show only while something can still change: a pick or Survivor team whose game has not kicked off, or a pick
  still owed. With every pick in and locked the Big Board has no bar and the room's ticket says "All 3 in · all locked".
- Sliding a pop-up down never pulls the refresh chain: while a pop-up (`dialog[open]`) is open, a pull on the page is ignored.
- Every clause of the constitution is lettered, (a) (b) (c), in the clubhouse's Constitution and in the Commissioner's Handbook, so a clause is cited
  like a lawyer's: Article III(b). The letters are drawn by the page (a counter), not typed into `POOL_CONSTITUTION`, so adding a clause renumbers itself.
- A pair of toggle pills is two exact mirrors: the same width and height, words centred, stacked where a half is too narrow (the Big Board's tabs,
  the ticket's All games / Pool action, the numbers pages' `ViewSwitch`). The Survivor tab has no arrow, so it matches Big Board.
- On the ticket, a finished game shows under each side's score the players who took that team (as the Slate names them once a game has kicked
  off), not the margin; the gold score still says which side covered ("NO PICKS" when nobody took it). The ticker is unchanged.
- A pop-up draws no focus ring round its own edge: putting the ticket away used to leave a blue line across the top of the Big Board. A bare
  pop-up now opens with focus on the sheet, not its handle, and a sheet itself never shows an outline (its buttons still do for the keyboard).
- The room's day picture is lit between the first bright try and the first soft one: the window glass and far wall were clipping to white.

## 2026-11-15 - Final scores and who covered; Survivor leaves the room with the classic pages; the mail flag (Commissioner only)

- Owner: "The locks shouldn't be over the spreads and we should figure out a way to show the final score and who covered better"; "Survivor should disappear the same time it does from the classic version ... the bowl pool could take its spot"; "show scores, who covered ... on the ticker"; the mail flag "should come out of the left side of the pill".
  - **The ticket** (`TicketForm`): no lock over a line (the header already says KICKED OFF). A game that is decided shows, under each side, its final score and "COVERED BY n" (lit gold) or "MISSED BY n" ("PUSH · A MISS" on a push: a push is a loss). The number is the margin past the spread (`coverMargin`), the word is the graded ATS result. A game in play shows no score: **only final scores are ever shown, never live ones** (owner: "I don't want live scores").
  - **The ticker** in the room shows the same: a final game says "FINAL · THU", each side shows its score in place of its line, the covering side lit with a check. Both come from the same data (`BoardView` results; `clubhouseFeed` games), so they cannot disagree.
  - **Survivor leaves the room when it leaves the classic pages:** once it is decided, and for the playoffs (`survivorOver` in the feed). Its poker-table spot then becomes the **Bowl Pool** (navy and gold plate, so it is not mistaken for the old table), the Bowl Pool's separate spot is not drawn twice, and Survivor's news line goes. The Big Board still links to the Survivor table. The picture itself is unchanged (a Bowl Pool table in the picture is a later piece of artwork).
  - **The mail flag** is the pill carried on past its own left end in red with the envelope, the same height and rounded outside shape (the plate is drawn in by the flag's width so it is never cut off).
  - **Round 2 (owner's list):** the board and ticket pop-ups are bare (the picture and a handle on top; slide down or tap the handle to put them away); the Survivor winner is called out only for the week after the crowning (8 days from `survivor_champion_crowned_at`, now sent as `survivorCrownedAt`), then the Big Board's Survivor column goes and the link stays; the Survivor pop-up always shows the whole table (a player's own show/hide choices no longer blank it); a link that only jumps within the page (the rules' list of articles) never opens another pop-up; the "Your picks" bubble is gone; name plates are flat (no raised edge); the phone's second bar of tabs is not shown in the clubhouse. The 3D room was re-rendered (`tools/clubhouse-room`): the brass lamp at the far end of the bar that stood in front of the games ticker is gone, and the day light is brighter and airier (exposure 1.16 to 1.45, more sky light). Night is unchanged but for the lamp.
  - Not built: picking a player to see their picks on the ticker (asked, the meaning is to be confirmed with the owner).

## 2026-11-15 - The clubhouse's pop-ups are the new views on real data (Commissioner only)

- Owner: "it should just be pop ups over the clubhouse ... No we have the new views!!" The classic pages embedded full screen are replaced by pop-ups over the room that show the new views, drawn from the pool's real reads:
  - **The Big Board** (the tote board: wins, player, Pick 1, Pick 2, Survivor, as in the Lab) and **your ticket** (the sheet over it: pick against the spread, then Survivor; lamps; one Submit). The Big Board and the Survivor spot's "Survivor table" link open the first; the games board, Your picks and the pinned ticket open it with your ticket ready. **Submit is the real pick:** the very same `POST /api/picks` the Slate makes (`buildSlateSubmission`, the Slate's default week), with the server's own refusal shown under the button; the room and the board read again at once, so the pick shows.
  - **Survivor** is the real Survivor table, fed by the Standings' own read. **Trophy Room** is the turning table of trophies, a plaque for every season that has a champion, and the all-time Pick'em records, from the Trophy Room's own read (404 before it opens still says so). **Constitution** is the Handbook's own text.
  - One shape feeds the tote board and the ticket, `BoardView` (`src/lib/board-view.js`): `realBoardView` builds it from `/api/home` + `/api/board?bootstrap=1`; the Lab builds the same shape from its sample players (`src/lib/lab-board-view.js`), so the two cannot drift. Another player's pick shows only if the Standings sent it (a covered pick is only ever a covered pick); the viewer's own picks come from the Slate's read of them; a pick not made yet is a muted dash, never a made-up one.
  - **Not covered yet, so classic:** a playoff week (a pick for every game, no Survivor) and the Bowl Pool still open the classic page in place, with its Back to Clubhouse bar. The playoff ticket ("Pick ALL", a lamp per game) is the next piece.
  - Each pop-up keeps its own address (`#standings`, `#slate` = board with the ticket ready, `#survivor`, `#trophies`, `#rules`), so back closes it and a reload reopens it. The ticket's sheet stands beside the board's sheet in the page, never inside it (a sheet inside a sheet is drawn under its parent), and after it, so it opens on top.
  - Players still cannot reach any of it. Nothing here can show more than the classic pages do; the unit tests (`test/board-view.test.mjs`) cover hidden picks, empty slots, locked and used Survivor teams, an eliminated viewer, the playoff fallback and a finished week.

## 2026-11-15 - The clubhouse is a real view of the site (Commissioner only)

- **How it lives (same day):** the switch is a mode remembered on this device: up, opening the app (the Standings address) lands in the clubhouse; down, it does not. Each open page has its own address (`/clubhouse#slate`), so the phone's back gesture closes it and a reload reopens it; a link to another real page (the header's, or one inside a page) opens that page in place; Escape closes. The room's boards and ticket are read again whenever a page is closed (a pick made there shows in the ticket's lamps at once), when the app returns to the front, and every five minutes while the room is showing. A failed re-read leaves the room as it was.
- **Superseded in part (same day):** it is one screen with no scrolling. Nothing leaves it: the Big Board (and Survivor) open the real Standings page, the games board, Your picks and the ticket open the real Slate, the trophy the Trophy Room, the Bowl Pool board the NCAA Bowls page, the constitution the rules, each in place over the room with Back to Clubhouse pinned under the site's header; the chat opens as a sheet. The pages are the real ones, embedded, so a pick made there is the same pick.
- The light switch beside the day/night button now opens `/clubhouse`, not the Lab. It is another way into the same site: the room fills the screen under the site's bar (a taller phone picture, `room-*-full.webp`, so a phone is filled with only a sliver cropped at the sides; plates near an edge are drawn in so none is cut off), and every thing in it is a link to the real page: the Big Board to the Standings, the games board, Your picks and the ticket to the Slate, the poker table to Survivor, the trophy to the Trophy Room, the laptop to the chat, the Bowl Pool board (from Dec 7 Eastern through January) to the Bowl Pool, the constitution to `/clubhouse/rules`.
- The boards and the ticket read only the Standings' and the Slate's own reads (`/api/home`, `/api/board`), shaped by `src/lib/clubhouse-feed.js`: wins only on the Big Board, and the only picks lit are the viewer's own. It can never show more than those pages. No new routes, no new database rules.
- Players cannot reach it: anyone but the Commissioner is sent to the Standings, and only the Commissioner has the switch. The Lab keeps its sample clubhouse for trying designs.

## 2026-11-15 - Only the two boards move; games two wide, shifting up every 7 seconds (Lab)

- The fans and plants no longer move (owner: they look terrible). The still room picture is all there is; the pre-drawn frame strips were removed from the site. `tools/clubhouse-room` can still render them but nothing loads them.
- The games board stands two wide, so two whole games are always up. Every 7 seconds it shifts up one row, like a slot machine or the ticker along the bottom of ESPN, and the last row runs on into the first with no jump. Reduced motion holds it still.

## 2026-11-15 - Net pts on Pool stats (Commissioner)

- **Net pts** is the sum, over graded Pick’em picks, of how far each pick landed past (+) or short of (−) its locked number (a push is 0). Kept for the league and for each player, and per season. It is a measure only; nothing shown influences picks.
- It replaces Perfect weeks as the third headline tile (the tile also shows the average per game picked). Perfect weeks stay in the Trophy Room.
- The Hit rate by season chart has a second axis on the right for Net pts, in its own colour. Both axes are symmetric about their middle line, so .500 and 0 sit on the same line, and that line no longer carries the words “Coin flip”.

## 2026-11-15 - The room breathes; brighter, softer light; a trophy shelf; the Commissioner's light switch (Lab)

Owner: shadows too harsh and late in the day; the Trophy Room sign implied a hallway; plants more real, swaying; fans spinning; all
lightweight. The room is lit as a bright mid-afternoon: more fill from the sky, a softer and higher sun, edges darkened less. The
painted Trophy Room sign is now a walnut shelf on the chimney with one gilt cup (it still opens the Trophy Room). The potted palm grows
as a kentia does (older fronds arching low, younger ones upright, two greens, its own stems). The fans turn slowly and the indoor
plants sway: drawn in advance as a loop of 16 small frames per moving thing (one strip each, about 230 KB a picture in all), laid
exactly over its place in the picture and stepped through by the browser alone, with no 3D and no script on the phone; with reduced
motion on they are hidden and the room holds still. The lamps are small glass lenses (a highlight, a dark bezel).
Commissioner only, for now: an unlabeled light switch beside the day/night button swaps between the classic site (switch down) and
the clubhouse in the Lab (switch up, glowing). Players never see it (a Slate test checks). Plan for more Lab states and the switch on
real data: LAB_STATES_PLAN.md (outside the repo). Lab only.

## 2026-11-15 - Lamps at the top of the ticket; a desktop clubhouse (Lab)

Owner: play into the lamps, but not a lamp in every box. The top right of your ticket has one lamp per pick, 1:1 with Pick 1, Pick 2
and Survivor (and the ticket pinned in the clubhouse has the same three): dark = no pick; a gold ring with a dark centre = picked on
your ticket but not sent; lit yellow = in, its game undecided; green = won; red = lost. Survivor's lamp is a poker chip (the lamp
inside the dashed rim Survivor wears across the pool). In the playoffs there is one lamp per game, stacked in rows, and no chip.
The Big Board keeps its cells as they were (team and line in type, three dots for a hidden pick, Survivor's logo with its ring) and
wears the lamps' colours: a shown pick is yellow while undecided, green for a win, red and struck through for a loss.
The clubhouse has a desktop version (900px and wider): a wide picture of the same room from the same spot through a longer lens, the
whole room in one view, with its own label positions; the ticket sits under the picture there. The tall picture stays the phone's.
The new-message sign sits on the left corner of the Chat button. Lab only.

## 2026-11-15 - Lab: the real constitution and the real Survivor table; a Survivor quick link (Lab)

Owner: post the actual constitution; the pool's current Survivor view is clearly better than the Lab's poker-table try-outs, so those
are gone. The Lab's Constitution room shows the very text the Commissioner Handbook holds (one list, exported, so they cannot differ),
set as a printed rule book with a row of the ten articles at the top that jumps to each. The Lab's Survivor room (and the shelf's
"Survivor" try-out) shows the pool's own Survivor table fed from the sample players, with a week stepper; improvements to Survivor are
tried on that. On the Big Board page a quick link under the title ("Survivor table") stands where the standings tab was. The ticket's
switch reads "Pick'em / pick 2 against the spread" and "Survivor / pick 1 to win · N of 32 unused". Lab only.

## 2026-11-15 - The Big Board is one face; the pinned ticket is built like the board (Lab)

Owner: ditch the Season standings tab, and the pinned "Your ticket" bar clashed. The Big Board page is now just this week's picks (the
room's board shows the standings with the leader on top, and the Standings page has the full table). The ticket pinned to the bottom of
every clubhouse screen is built like the Big Board itself: its green housing and gold keyline, amber lamp lettering, the same lamps;
it rides just above the Commissioner wheel when the wheel is there, never behind it.
No chat zoom (owner: terrible): tapping Chat opens the chat at once. The way back is always in reach: Back to Clubhouse stays pinned
just under the site's menu at the top of every room as you scroll, and waits again at the room's foot; going in or back starts at the top
of the page. The spreads ticker runs faster (a full loop in 36 seconds, was 64). Lab only.

## 2026-11-15 - Room labels are the buttons; taller Big Board; results without letters (Lab)

Owner: people had no clue where to tap. Each label on the room picture is now drawn as a button (raised cream plate, arrow) and takes the
tap itself; before, a tap on a label fell through to whatever was behind it. The new-message sign rides on the Chat label, and tapping
Chat zooms the picture in on the laptop before the chat opens (it just opens with reduced motion). The room's Big Board is narrower and
taller (the leader and five more a page; nine others are a page of five, then four) and the spreads board under it a little taller.
On the Big Board page every pick in a column starts on one left edge near the cell's left side, a hidden pick's three dots standing in
for a team name (owner: dots line up with dots, names with names; nothing centred), so a result can no longer be a letter beside it: a win glows green, a loss is red and struck through. Survivor is the team's logo, always centred: a win
is a lit green ring, a loss a red ring with a bar through a greyed logo.The spreads ticker now reads like the ticket: each matchup one card, its kickoff over the away team and the home team below it, each
with logo, team and line, your own picks framed in gold. The ticker itself opens the Big Board with your ticket ready (no label on
it), and the "Your picks" button stands by itself in the empty gap between the poker table's chairs. Lab only, sample players.

## 2026-11-15 - The Slate keeps home capitals and away lowercase in every game state

Owner: once a game started, both teams on the phone's compact names turned to capitals. The rule is the same in every state (upcoming,
live, final): the home team in capitals, the away team not ("Favorites left; home team ALL CAPS"). A behavior test reads every row's
compact names in an upcoming, a live and a completed Slate.

## 2026-11-15 - The room's standings turn pages; a hidden pick is three dots (Lab)

Owner: two boards moving at once was too much. The room's Big Board now shows five players a page and turns the page every 15 seconds;
only the spreads ticker moves. Its top line always shows the leader and their wins (or "N LEADERS" and the score when level), so every
page has a sense of scale. On the Big Board a hidden Pick'em pick is just the three dark lamps (the dots alone say a pick was made;
blank means none), centred, and a shown pick is centred the same way; a shown Survivor pick is the team's logo. Survivor keeps its green IN.
The room picture is framed tighter (owner: too much floor and ceiling): the camera stands about half a metre further in with a
slightly longer lens (63° instead of 68°), turned a little right so the Rules frame and Trophy Room sign stay in; the neon over the bar is
about a fifth bigger and hangs further down the wall so it reads whole. Lab only, sample players.

## 2026-11-15 - One ticket, one list: Pick 2 and Survivor share one game list (Lab)

Owner: making and seeing picks must be simpler. The Big Board stays the only place to see picks (one row a player, a green IN until
kickoff). Making picks is one sheet with one list of the week's games and a two-way switch, "Pick 2" or "Survivor" (with "N teams left");
the second Pick'em pick moves on to Survivor if it is still owed. The board's Survivor column is plain text like a pick (no chips).
A used team still reads "USED WK n" and cannot be picked. Lab only, sample players; nothing here reads or writes the pool.

## 2026-11-15 - The room's boards move; plaques and records go into the Trophy Room (Lab)

The owner: the Big Board "should have some movement on it": the standings auto-scroll and the spreads run across "like a sportsbook
ticker", always slowly moving. The plaques and the record book come out of the room and go into the Trophy Room, which is then
today's page as it is plus the plaques. So the standings on the Big Board now roll up through all ten players (the list shown
twice, so there is no seam) and the week's lines run across the spreads board; both stand still for anyone who asks for reduced
motion. The room has one fewer plaque spot and one fewer record spot; the Trophy Room carries the turning table, the banners, the
plaques (with the crowning scene) and an all-time Records table of sample numbers.

## 2026-11-15 - Picks are made on the Big Board; Survivor table in plain words; a name plate on every tap spot (Lab)

The owner, on the clubhouse try-out: it has to be clearer where to tap on the picture; the Survivor choices "feel really clunky";
the poker table "makes little to no sense" and must show who has taken what team, what they took before and what they have left;
and "we can use the big board like a ticket". Asked which he meant, he chose: **pick on the Big Board** (no separate Window
screen), and the clunky part was **the chip grid in the Window**. So:

- **Your row on the Big Board is your ticket.** It is a strip of ticket paper on the dark board; its cells are buttons and an
  owed pick reads PICK. Tapping it opens the ticket in a sheet over the board; one Submit; the row then shows what was sent. The
  Window room is gone: the room's picks wall and the pinned ticket both open the Big Board with the ticket ready. Still one pick
  path, the same rules: nothing can be changed after its kickoff, nobody else's unstarted pick is shown.
- **Survivor is picked from plain rows**, one per game, the same rows as the picks against the spread above them, not from a
  grid of round chips. A used team says "USED WK n".
- **The Survivor table answers three questions in words.** This week: one line per team taken, with the players' full names and
  WON or LOST (the 32-box felt of initials is gone). Used: every team a player has used, in week order, the week number under
  each. Left: a count on the card, and a sheet with all 32 teams by division, the used ones dimmed. A pick that is still face down
  is never counted as used, so "left" cannot give it away.
- **Every tap spot in the room wears a name plate with an arrow, always.** "Show labels" is gone; nothing has to be discovered.

Same day, after seeing it, the owner: "the board doesn't need to mark whose account it is", the hidden Survivor chips "look
terrible", and "you're doing too much with Survivor now". So the Big Board marks no row (your cells and the bar under the board
still open the ticket); a hidden Survivor pick is the same plain green IN as a hidden pick against the spread, not a striped chip
back; and the Survivor table is one row a player: this week's team on the top line, the teams used before and how many are left on
the bottom line, with the 32-team sheet one tap away. The lines-per-team felt, the USED/LEFT captions and the week-by-week list in
the sheet are gone. Lesson kept: for this pool, simpler wins.

## 2026-11-22 - Chalkboard further right on the phone, a Snapshot pill, ticket back to its frame

On the phone the chalkboard stands further right (clear of the poker table) and a small "Snapshot" pill sits on its upper edge so it reads as tappable (the desktop keeps its position and gets the same pill). The phone ticket went back to its old frame: the home-screen-app lift that cleared the rounded corners is removed (the owner would rather have the corner clipped than the frame moved).

## 2026-11-22 - Drag the 6 Wk graph; calmer pick lights; a loss ends a 2-0 streak at once

The owner asked for three things. The 6 Wk Season Snapshot lost its bar over the chart: the graph is dragged sideways and lands on exact weeks (a vertical swipe stays the pop-up's). The lamps that show a pick is in lost their wide halo and hot white centre (a tight, dim ring on the ticket, a softer bulb on the boards). A player's perfect-week streak now ends the moment a loss is in a week still being played (Rick's was still 3 with a loss and a pick to play); that week still counts for the other figures only once both picks are graded.

## 2026-11-22 - Bowl Pool ticket: read ahead, one gold trace, split-flap numbers

The clubhouse's Bowl Pool tab opened on "Loading" out of bowl season (it was read ahead only from Dec 7): it is now read ahead as soon as the ticket, Survivor or Big Board pop-up opens. The gold trace round each pick drew twice on opening (the ticket remounted when its fresh read matched the one it opened on); a read that brings nothing new now leaves the ticket alone. The Bowl sheet's wins and the games left under the dial turn on the classic Bowl Card's split-flap tiles (owner: "use that same movement").

## 2026-11-22 - Sailboat on the mantel, tuck-away ticket, day/night crossfade in the room, no Trophy Room in the clubhouse menu

- The mantel (now 0.6 deep) carries a model sailing yacht, turned to show its sails (owner picked it over a seascape and a vase; the renderer keeps `art=vase|painting` as options).
- Your ticket tucks away: drag it down and it folds to about half its height (heading folded away, every pick on its side, the stub's word kept); drag up to bring it back. Remembered on the device. A drag never opens it and never pulls the refresh chain.
- In the clubhouse, day and night crossfade the room's two pictures in place instead of the page-wide view transition, which photographs the page and could show the perspective boards out of place mid-switch.
- The name menu leaves out Trophy Room in the clubhouse (it has its own plate in the room).

## 2026-11-22 - With the clubhouse switch up, Standings links go straight to the clubhouse

Clicking Standings (or the masthead) from a Commissioner page with the clubhouse switch up flashed the classic Standings before the redirect to the clubhouse caught up. Those links now point at the clubhouse while the switch is up (outside the clubhouse; inside it they stay the Standings pane), so the classic page never renders on the way. Opening the app by its address still redirects as before.

## 2026-11-22 - Notifications opens as ticket paper in the clubhouse

The Notifications pop-up in the clubhouse is dressed like the ticket (cream card paper, dark ink, brass rules, cognac accents, a walnut button) instead of the navy/gold Bowl look, which was hard to read. Body text is 16px, its small print about 15px and its secondary ink darker; only the clubhouse copy changes, the Notifications page keeps its own paper.

## 2026-11-22 - A pulled-down refresh in the clubhouse blinks the lamps

The clubhouse read itself again in place with nothing to show it had. A refresh pulled down now blinks every lit lamp (ticket and boards) twice, once, when the read lands. The timed five-minute and return-to-front reads stay quiet, and "reduce motion" skips the blink. Dragging the ticket never starts a refresh.

## 2026-11-22 - Trophy Room plaque shelf: no subtitle, tighter

The plaque shelf in the clubhouse Trophy Room lost its "one for every season" line, and the case, its heading and the shelf took less space (smaller padding and gaps), so more of the Trophy Room shows without scrolling.

## 2026-11-23 - Slower score checking starts at 450 credits used; finals chart readable on a phone

The low-balance line, where Normal score checking ends and Lean or Minimal begin, moved from 440 to 450 of the month's 500 Odds API credits used (the Commissioner asked for a 450 floor): Normal runs 10 credits longer, leaving 50 credits (35 after the lines) for the lighter schedules instead of 60 (45). On Odds credits, every card heading now puts its explanation under the whole heading row instead of squeezing it beside the headline number; the finals chart's headline reads "found in 10 min" (the share of finals found within 10 minutes of the first score check) and its explanation is shorter. Tapping a bar or day on a phone keeps its details up until a tap lands outside the chart (they used to vanish the moment the finger lifted).

The monthly credits chart's title uses the three-letter month ("Credits in Nov 2026").

## 2026-11-23 - Side-by-side teams on the clubhouse games board stay level

When one side's list of pickers ran to a second line, its box grew and the other side's box stayed short and centred, so the team names no longer lined up. Both boxes in a game now stretch to the same height and each keeps its team and line on the top row; only the bottom grows.

## 2026-11-23 - Clubhouse Bowl dial: smaller games-left tile; pop-up scroll bars leave room

The games-left flap tile under the Bowl dial in the clubhouse is smaller. The scrolling pop-up bodies reserve 14px on the right so the floating scroll bar never covers the figures (the Window's pick lines).

## 2026-11-23 - The ticket tucks with an arrow; the Bowl pop-up's top section is shorter

Dragging the clubhouse ticket to tuck it away is replaced by a small arrow tab on the ticket's top edge: it folds the ticket to half its height (heading away, every pick kept) and, turned the other way, opens it again; the choice is still remembered on the device. The fold settles with a small spring, the picks pop back into place one after another and the arrow flips with a little overshoot (all still, with "reduce motion"). Tapping the ticket still opens your ticket.

The Bowl Pool pop-up's heading is compact (no row of stars, a smaller title, counts and dial, a slimmer Picks/Sheet switch): the first game day starts about 65px higher on a phone. The earlier smaller-tile note is superseded: the games-left tile shrank by its flap size (1.9rem by 1.2rem), not its font.


## 2026-11-27 - Every non-Sunday-afternoon kickoff gets a public pick reveal

The Black Friday game sent no reveal email because the featured reveal was planned only for Wednesday, Thursday, Monday, Sunday night and International games. It now covers every kickoff outside the two Sunday afternoon windows (which keep their own reveals): Friday, Saturday, Tuesday and holiday games included. The notification wording says so.
