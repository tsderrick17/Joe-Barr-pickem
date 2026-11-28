const runbook = [
  ["1. Before the first lock", "Open Season Readiness, then Automation Preflight. A red item means pause and resolve it before the pool reaches a deadline."],
  ["2. At the scheduled line lock", "Automation is primary. If its health check is late or failed, use Check official spread locks once. It is safe to re-run and records what it did."],
  ["3. At kickoff", "Do not publish or edit selections. The site reveals each game automatically at its own kickoff, leaving the full receipt in place for audit."],
  ["4. When a game is final", "Wait for the score window, then use score sync. It imports a completed score, grades ATS and Survivor separately, and only advances a settled period."],
  ["5. If a provider is late", "Keep the game pending. Do not estimate a score or replace an official line from memory. Refresh health and retry the relevant check. A final-score correction is intentionally an audited database workflow, never a casual page edit."],
  ["6. If a game is moved, postponed, cancelled, or no contest", "Open Game Exceptions, select the verified game, and confirm the status. A rescheduled game keeps its existing pick but receives its new lock time; cancelled and no-contest selections follow the published settlement policy and remain in the audit trail."],
];

// The pool's constitution, written to the player: what they pick, how it is scored and how each contest is won.
// Every clause states something the site does today; change the rule in the code and its clause here together.
export const POOL_CONSTITUTION: Array<{ part: string; articles: Array<{ title: string; clauses: string[] }> }> = [
  {
    part: "1 · PICK’EM",
    articles: [
      { title: "Article I · Your weekly picks", clauses: [
        "Every week of the regular season you pick 2 games against the spread, from any games that week.",
        "Tap a team, then tap SUBMIT. Nothing counts until you submit. You can change a pick until its game kicks off; each game locks on its own.",
        "Nobody sees your pick until its game kicks off. You can always see your own.",
      ] },
      { title: "Article II · The lines", clauses: [
        "The favorite has to win by more than the line. The underdog covers by winning, or by losing by less than the line.",
        "Lines lock at 8:00 AM Eastern on game day. A game played overseas on a Sunday morning locks at 6:00 PM Eastern the night before.",
        "Your pick is graded on the locked line, even if you picked before it moved.",
      ] },
      { title: "Article III · Winning", clauses: [
        "Only wins count. A loss, a push (the margin lands exactly on the line) or a pick you never made scores nothing.",
        "Most wins after the Super Bowl is the champion. There is no tiebreaker: players tied for the most wins are co-champions.",
        "The champion wears the trophy beside their name until the next one is crowned, and every champion is kept in the Trophy Room.",
      ] },
      { title: "Article IV · The playoffs", clauses: [
        "You pick every game: 6 in the Wild Card round, 4 in the Divisional round, the 2 Conference Championships and the Super Bowl. Playoff wins add to your season total.",
        "Send a whole round at once if you like, and change any pick until its game kicks off.",
        "You stay in while you can still catch the leader: your wins plus the games left must reach the leader’s wins. It is checked the morning of each playoff game day, and if you are in that morning you play every game that day.",
        "Once you can no longer catch the leader you are out. To bow out early, Forfeit is at the bottom of your picks; it asks 3 times and cannot be undone.",
        "The morning after each playoff game day, a note in the chat shows the race: games left, the leader, how far back everyone is and who is out. It never shows picks.",
      ] },
    ],
  },
  {
    part: "2 · SURVIVOR",
    articles: [
      { title: "Article V · Survivor", clauses: [
        "Everyone is in. Survivor runs through the regular season only.",
        "Each week pick one team to win its game outright. There is no spread, and you can use each team only once all season.",
        "Win and you move on. A loss, a tie or a missed week and you are out.",
        "Your pick is hidden until its game kicks off, like Pick’em.",
        "If your team’s game is postponed or cancelled, that team is not used up, and you can pick another team that week.",
        "The last player standing wins. If everyone left goes out the same week, they share the title.",
      ] },
    ],
  },
  {
    part: "3 · THE BOWL POOL",
    articles: [
      { title: "Article VI · Joining and picking", clauses: [
        "The Bowl Pool is optional. It opens the day after Selection Sunday. Claim your seat before the first bowl kicks off; you can opt out only until then.",
        "Pick every bowl and College Football Playoff game against the spread, through the National Championship. Save a few at a time if you like; each game locks at its own kickoff.",
        "Lines lock at 8:00 AM Eastern on game day. A whole-number line moves half a point so no game can push.",
      ] },
      { title: "Article VII · Winning", clauses: [
        "Most wins takes the Bowl Pool. A game you did not pick is a loss.",
        "The tiebreaker is your guess of the total points both teams score in the National Championship. If players tie on wins, the closest guess wins, over or under. Skip the guess and you lose a tie to anyone who guessed.",
      ] },
    ],
  },
  {
    part: "GOOD TO KNOW",
    articles: [
      { title: "Article VIII · When a game moves", clauses: [
        "If a game only moves to a new time, your pick stays and the game locks at its new kickoff.",
        "If a game is postponed or cancelled, your Pick’em pick on it is cleared. Pick any other game still open that week.",
      ] },
      { title: "Article IX · Emails and reminders", clauses: [
        "Choose how much email you get in Notifications (Essentials, Regular or Full Card) and turn any single email on or off. Add the pool to your phone’s Home Screen and turn on notifications to get the same messages there.",
        "Reminders go out Sunday at 11:00 AM and 3:00 PM Eastern and before the Sunday and Monday night games, only if you still have a pick to make. The weekly recap arrives Tuesday morning.",
      ] },
      { title: "Article X · The Commissioner", clauses: [
        "The Commissioner plays by the same rules as everyone else, and can fix a wrong score or handle a postponed game but can never make or change your pick.",
        "Every change the Commissioner makes is kept on the record.",
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
        {POOL_CONSTITUTION.map(({ part, articles }) => (
          <section className="mt-5" key={part}>
            <h4 className="text-xs font-black tracking-[0.16em] text-(color:--themed-text-28)">{part}</h4>
            <div className="mt-2 space-y-2">
              {articles.map(({ title, clauses }) => (
                <article className="desk-panel p-3" key={title}>
                  <h5 className="font-bold">{title}</h5>
                  <ol className="clauses-lettered mt-1 space-y-1 text-sm leading-5 text-(color:--themed-text-29)">
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
