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
const constitution: Array<{ part: string; articles: Array<{ title: string; clauses: string[] }> }> = [
  {
    part: "THE BASICS",
    articles: [
      { title: "Article I · How it works", clauses: [
        "Every week of the regular season you pick 2 games against the spread, from any games that week.",
        "In the playoffs you pick every game: 6 in the Wild Card round, 4 in the Divisional round, the 2 Conference Championships and the Super Bowl.",
        "Every win is a point. Whoever has the most points after the Super Bowl wins the pool.",
        "You are also in Survivor all regular season, and in December you can join the Bowl Pool.",
      ] },
      { title: "Article II · Making your picks", clauses: [
        "Tap a team, then tap SUBMIT. Nothing is saved until you tap SUBMIT.",
        "You can change a pick any time before that game kicks off. Each game locks on its own, so an early game never closes the rest.",
        "Nobody sees your pick until that game kicks off. You can always see your own.",
        "A new week opens Wednesday morning. Once every game of the current week is final, you can open the next week the following day and pick early.",
      ] },
      { title: "Article III · The lines", clauses: [
        "You pick against the spread. The favorite has to win by more than the line. The underdog covers by winning, or by losing by less than the line.",
        "On the Slate the favorite is on the left and the home team is in CAPITALS.",
        "Lines lock at 8:00 AM on game day. Before that the line is black and can still move. Once it locks it turns teal and never changes.",
        "Your pick is graded on the locked teal line, even if you picked earlier.",
        "A push, where the margin lands exactly on the line, is a loss.",
      ] },
      { title: "Article IV · Winning", clauses: [
        "A win is one point. A loss, a push or a pick you never made is zero.",
        "Results post on their own shortly after each game ends, and the Standings update with them.",
        "There is no tiebreaker. Players tied for the most points after the Super Bowl are co-champions.",
        "The champion wears the trophy beside their name until the next champion is crowned, and every champion is kept in the Trophy Room.",
      ] },
    ],
  },
  {
    part: "THE CONTESTS",
    articles: [
      { title: "Article V · Survivor", clauses: [
        "Everyone is in. Survivor runs through the regular season only.",
        "Each week pick one team to win its game outright. There is no spread.",
        "You can use each team only once all season.",
        "Win and you move on. A loss, a tie or a missed week and you are out.",
        "If your team's game is postponed or cancelled, it does not count against you and the team is not used up. Pick again if a game is still open; if none is, you move on.",
        "The last player standing wins. If everyone left goes out the same week, they share the title, and so do players who make it through the whole regular season.",
      ] },
      { title: "Article VI · The playoffs", clauses: [
        "You can submit a whole round at once and change any pick until its game kicks off. Playoff wins add to your season total.",
        "You stay in the race as long as you can still catch the leader: your points plus the games left must reach the leader's points.",
        "That is checked the morning of each playoff game day. If you are in that morning, you play every game that day.",
        "Once you can no longer catch the leader you are out. Your picks on later games do not count, and they are not losses either.",
        "If you want to bow out, Forfeit is at the bottom of the Slate. It asks three times, and only the Commissioner can undo it.",
        "The morning after each playoff game day, a note in the chat shows the race: games left, the leader, how far back everyone is and who is out. It never shows picks.",
      ] },
      { title: "Article VII · The Bowl Pool", clauses: [
        "The Bowl Pool is optional. It opens December 7. Claim your seat before the first bowl kicks off; you can opt out only until then.",
        "Pick every bowl and College Football Playoff game against the spread, through the National Championship.",
        "Save your picks a few at a time if you like. Each game locks at its own kickoff.",
        "Lines lock at 8:00 AM on game day. A whole-number line moves half a point so no game can push.",
        "A win is one point. A game you did not pick is a loss.",
        "The tiebreaker is your guess of the total points both teams score in the National Championship. If players tie on wins, the closest guess wins, over or under. Skip the guess and you lose a tie to anyone who guessed.",
        "The Bowl Pool has its own standings and champion. It never counts in Pick'em or Survivor.",
      ] },
    ],
  },
  {
    part: "GOOD TO KNOW",
    articles: [
      { title: "Article VIII · When a game moves", clauses: [
        "If a game only moves to a new time, your pick stays and the game locks at its new kickoff.",
        "If a game is postponed or cancelled, your pick on it is cleared. Pick any other game still open that week.",
      ] },
      { title: "Article IX · Emails and reminders", clauses: [
        "Choose how much email you get in Notifications (Essentials, Regular or Full Card) and turn any single email on or off.",
        "Reminders go out Sunday at 11:00 AM and 3:00 PM and before the Sunday and Monday night games, and only if you still have a pick to make.",
        "The weekly recap arrives Tuesday morning.",
        "Add the pool to your phone's Home Screen and turn on notifications to get the same messages on your phone.",
      ] },
      { title: "Article X · The Commissioner", clauses: [
        "The Commissioner plays by the same rules as everyone else.",
        "The Commissioner can fix a wrong score, handle a postponed game or undo a forfeit, but can never make or change your pick.",
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
        <p className="mt-2 text-sm leading-5 text-(color:--themed-text-29)">Everything you need to know to play. Every time is Eastern.</p>
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
