const runbook = [
  ["1. Before the first lock", "Open Season Readiness, then Automation Preflight. A red item means pause and resolve it before the pool reaches a deadline."],
  ["2. At the scheduled line lock", "Automation is primary. If its health check is late or failed, use Check official spread locks once. It is safe to re-run and records what it did."],
  ["3. At kickoff", "Do not publish or edit selections. The site reveals each game automatically at its own kickoff, leaving the full receipt in place for audit."],
  ["4. When a game is final", "Wait for the score window, then use score sync. It imports a completed score, grades ATS and Survivor separately, and only advances a settled period."],
  ["5. If a provider is late", "Keep the game pending. Do not estimate a score or replace an official line from memory. Refresh health and retry the relevant check. A final-score correction is intentionally an audited database workflow, never a casual page edit."],
  ["6. If a game is moved, postponed, cancelled, or no contest", "Open Game Exceptions, select the verified game, and confirm the status. A rescheduled game keeps its existing pick but receives its new lock time; cancelled and no-contest selections follow the published settlement policy and remain in the audit trail."],
];

// The pool's constitution: how it is built (format), how it runs (mechanics) and the rules of each contest.
// Every clause states something the site enforces today; change the rule in the code and its clause here together.
const constitution: Array<{ part: string; articles: Array<{ title: string; clauses: string[] }> }> = [
  {
    part: "PART ONE · FORMAT",
    articles: [
      { title: "Article I · The pool", clauses: [
        "The pool is private. A player signs in with a name and a four-digit PIN, and only an active player can pick.",
        "It holds two NFL contests: Pick'em, picked against the spread, and Survivor, picked to win outright.",
        "The NCAA Bowl Pool is a third contest. It is optional and runs in December and January.",
        "Each contest has its own standings, its own champion and its own trophy. A result in one never counts in another.",
      ] },
      { title: "Article II · The season", clauses: [
        "A season starts on August 1 and ends when the Super Bowl is final and graded.",
        "The regular season is one pool week for each NFL week. The playoffs are four rounds: Wild Card, Divisional, Conference Championships and Super Bowl.",
        "From the Super Bowl until August 1 the pool is closed. Nobody can pick; the standings and every past week stay open to read.",
        "On August 1 the new season starts by itself with every record at zero. Past seasons are kept whole.",
      ] },
      { title: "Article III · The pool week", clauses: [
        "A pool week runs Wednesday through Tuesday.",
        "The next week takes over on Wednesday at 3:00 AM, or one day after the week before is fully graded if that is later. When the next kickoff is less than a day away, it takes over as soon as the week before is graded.",
        "A player can open the next week early and pick it, from midnight after the current week's last result is graded.",
        "A week is finished only when every game is final or formally settled and every pick is graded. A postponed game holds its week open until it is played or cancelled.",
        "Every finished week stays in the week selector.",
      ] },
    ],
  },
  {
    part: "PART TWO · MECHANICS",
    articles: [
      { title: "Article IV · The lines", clauses: [
        "Every game has one official line: the spread on file at the moment its line locks.",
        "Lines lock at 8:00 AM on game day unless the Slate says otherwise.",
        "Before the lock a line is preliminary. It shows in black and can still move. After the lock it is official. It shows in teal and never changes.",
        "Every pick is graded on the official line, whenever it was made. A pick made on a preliminary line follows that line to where it locks.",
        "If the line source is down at the lock, the latest line on file is used only when it is no more than 24 hours old. Otherwise the line stays open and the Commissioner is alerted. A line is never guessed.",
        "On the Slate the favorite is on the left and the home team is in capitals.",
      ] },
      { title: "Article V · Making picks", clauses: [
        "Click a team to choose it, then click SUBMIT. Nothing is saved until SUBMIT.",
        "A pick can be changed or taken back until its own game kicks off. At kickoff it is sealed for good.",
        "Each game locks by itself. An early game sealing never closes the games after it.",
        "A pick must be a team playing in a game on that week's Slate, and a player may pick only one side of a game.",
      ] },
      { title: "Article VI · Who sees what", clauses: [
        "A player always sees their own picks.",
        "Nobody else sees a pick until its game kicks off. At kickoff the pick is public on the Slate, in the Standings and in the picks email.",
        "Picks are shown one game at a time. A later game's picks stay hidden until that game kicks off.",
        "The same holds for Pick'em, Survivor and the Bowl Pool.",
      ] },
      { title: "Article VII · Scores and grading", clauses: [
        "Scores come in by themselves, starting 2 hours 50 minutes after kickoff. A score counts only once it is verified as final.",
        "A late score stays pending. A score is never estimated.",
        "If the score source still has no final three days after kickoff, the Commissioner may enter the verified final, with a written note that is kept on the record.",
        "A wrong final is corrected and every pick on that game is graded again. The correction is recorded; the original is never erased.",
        "A voided pick is neither a win nor a loss. It stays on the record and counts for nothing.",
      ] },
      { title: "Article VIII · Emails and notifications", clauses: [
        "Each player chooses an email plan (Essentials, Regular or Full Card) and can switch any single email on or off in Notifications.",
        "The week's emails are the new Slate on Wednesday, the official lines on game day, pick reminders, the picks at kickoff, and the recap on Tuesday at 6:30 AM once the week is graded.",
        "Pick reminders go out Sunday at 11:00 AM, Sunday at 3:00 PM, and before the prime-time games (Sunday 6:00 PM and Monday 5:00 PM), and only to a player who still has a pick to make.",
        "A phone that has the pool on its Home Screen with notifications on gets the same messages at the same moments.",
      ] },
    ],
  },
  {
    part: "PART THREE · RULES",
    articles: [
      { title: "Article IX · Pick'em", clauses: [
        "Each regular-season week a player makes two picks against the spread, from any games on that week's Slate.",
        "A team that covers the official line is a win. Each win is one point in the Standings.",
        "A push is a loss. So is a tie in a game with no spread.",
        "A pick not made by the last kickoff is no win.",
        "The Standings rank players by wins. Only graded wins count; a pending pick counts for nothing until it is graded.",
      ] },
      { title: "Article X · Survivor", clauses: [
        "Every active player is entered when the season opens. Survivor is played in the regular season only.",
        "Each week a player picks one team to win its game outright. There is no spread.",
        "A team can be used only once in a season.",
        "A win keeps the player in. A loss or a tie ends the run.",
        "A week with no pick ends the run, once the last game the player could have picked has kicked off.",
        "A pick on a postponed or cancelled game is voided. It is not a loss, the team is not used up, and the player may pick again while a game is still open. If none is, the player stays in.",
        "The last player standing is the champion. If everyone left goes out in the same week, they share the title. If several players last the whole regular season, they share it.",
        "A player who loses reads OUT only once another player wins that week.",
      ] },
      { title: "Article XI · The playoffs", clauses: [
        "Pick'em continues through the playoffs and every win adds to the season total. Survivor does not continue.",
        "Every playoff game is picked: six in the Wild Card round, four in the Divisional round, two Conference Championships and the Super Bowl.",
        "A whole round can be submitted at once. Each pick can still be changed until its own kickoff.",
        "A player stays in the race while they can still tie the leader: their wins plus the games left must reach the leader's wins.",
        "That is checked at the start of each playoff game day. A player who is in at the start of a day plays every game that day.",
        "A player who can no longer tie the leader is out. Their picks on later games are voided, not counted as losses, and nothing they pick afterward counts.",
        "A player still in the race may forfeit from the bottom of the Slate. It asks three times. Picks on games not yet started are voided; picks on games already started are still graded. Only the Commissioner can reverse a forfeit, and the voided picks do not come back.",
        "The morning after each playoff game day, a note in the pool chat gives the games left, the leader, who is how far back and who was knocked out. It never names a pick.",
      ] },
      { title: "Article XII · The Bowl Pool", clauses: [
        "The Bowl Pool is optional. It opens to players on December 7 at 3:00 AM, and a player joins by claiming a seat before the first game kicks off.",
        "A player may opt out only before the first game kicks off.",
        "Every bowl and College Football Playoff game is on the card, through the National Championship. A player picks each one against the spread.",
        "Picks can be saved a few at a time. Each game locks and becomes public at its own kickoff.",
        "Lines lock at 8:00 AM on game day. A whole-number spread is moved half a point so a game cannot push. A game with no spread stays that way.",
        "A win is one point. A game with no pick is a loss.",
        "The tiebreaker is a guess of the total points both teams score in the National Championship. Among players tied on wins, the closest guess wins, over or under. No guess loses to any guess. Players still tied are co-champions.",
        "Bowl Pool results never count in Pick'em, in Survivor or in the All-Time Table.",
      ] },
      { title: "Article XIII · Postponed and cancelled games", clauses: [
        "A game that only moves to a new time keeps its picks. Its line lock and kickoff move with it.",
        "When a game is postponed, cancelled or ruled no contest, every pending pick on it is voided.",
        "A player may replace a voided pick with any game still open in that week.",
        "A postponed game stays in its original pool week, even when it is played in a later one.",
        "No score is ever made up for a game that was not played.",
      ] },
      { title: "Article XIV · Champions and the record", clauses: [
        "The Pick'em champion is the player with the most wins after the Super Bowl, regular season and playoffs together.",
        "Pick'em has no tiebreaker. Players tied for the lead are co-champions, and each is recorded the same.",
        "The trophy beside a name belongs to the latest season's champion or co-champions.",
        "The Trophy Room keeps every champion of every contest. Its All-Time Table counts Pick'em picks only.",
        "Finished weeks and seasons are frozen. A correction is a new entry on the record, never a rewrite.",
      ] },
      { title: "Article XV · The Commissioner", clauses: [
        "The Commissioner runs the pool and plays under the same rules as everyone else.",
        "The Commissioner may add a player, record a postponed or cancelled game, enter a verified final when the score source cannot, set a missing Bowl line, reschedule a postponed bowl game and reverse a forfeit.",
        "No Commissioner tool makes or changes a player's pick, replaces a locked line or changes a grade outside the recorded correction.",
        "Everything the Commissioner does to a game, a line or a pick is written to the audit record.",
      ] },
    ],
  },
];

export default function CommissionerHandbook() {
  return (
    <section className="commissioner-tool">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-(color:--themed-text-28)">COMMISSIONER REFERENCE</p>
          <h2 className="mt-1 font-serif text-3xl font-bold">Game day and season handbook</h2>
          <p className="mt-2 max-w-3xl text-(color:--themed-text-29)">The safe operating order, the rules the system enforces, and the few moments that require a commissioner decision.</p>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="font-serif text-2xl font-bold">Gameday runbook</h3>
        <ol className="mt-3 space-y-2">
          {runbook.map(([title, detail]) => <li className="desk-panel p-3" key={title}><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-5 text-(color:--themed-text-29)">{detail}</p></li>)}
        </ol>
      </div>

      <div className="pool-constitution mt-6">
        <h3 className="font-serif text-2xl font-bold">Pool constitution</h3>
        <p className="mt-2 text-sm leading-5 text-(color:--themed-text-29)">How the pool is built, how it runs, and the rules of each contest. Every time is Eastern. Commissioner only for now.</p>
        {constitution.map(({ part, articles }) => (
          <section className="mt-5" key={part}>
            <h4 className="text-xs font-black tracking-[0.16em] text-(color:--themed-text-28)">{part}</h4>
            <div className="mt-2 space-y-2">
              {articles.map(({ title, clauses }) => (
                <article className="desk-panel p-3" key={title}>
                  <h5 className="font-bold">{title}</h5>
                  <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-5 text-(color:--themed-text-29)">
                    {clauses.map((clause) => <li key={clause}>{clause}</li>)}
                  </ol>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="border border-zinc-400 bg-(color:--themed-bg-19) p-4"><h3 className="font-bold">Data-source contingency</h3><p className="mt-1 text-sm leading-5 text-(color:--themed-text-29)">Before lock, retry the official-line check. At or after lock, preserve the saved official line; never retroactively replace it. A late score remains pending until verified.</p></article>
        <article className="border border-zinc-400 bg-(color:--themed-bg-19) p-4"><h3 className="font-bold">Rare controls</h3><p className="mt-1 text-sm leading-5 text-(color:--themed-text-29)">Import is preview-first. Line locking is repeat-safe. Final-score reconciliation is read-only. A score correction requires the audited database workflow; disruption changes demand confirmation and write an audit record.</p></article>
        <article className="border border-zinc-400 bg-(color:--themed-bg-19) p-4"><h3 className="font-bold">Season closeout</h3><p className="mt-1 text-sm leading-5 text-(color:--themed-text-29)">Confirm every period is complete, review the final archive, verify every champion and co-champion history record, then create—not overwrite—the next season.</p></article>
      </div>
    </section>
  );
}
