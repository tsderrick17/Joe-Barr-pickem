const runbook = [
  ["1. Before the first lock", "Open Season Readiness, then Automation Preflight. A red item means pause and resolve it before the pool reaches a deadline."],
  ["2. At the scheduled line lock", "Automation is primary. If its health check is late or failed, use Check official spread locks once. It is safe to re-run and records what it did."],
  ["3. At kickoff", "Do not publish or edit selections. The site reveals each game automatically at its own kickoff, leaving the full receipt in place for audit."],
  ["4. When a game is final", "Wait for the score window, then use score sync. It imports a completed score, grades ATS and Survivor separately, and only advances a settled period."],
  ["5. If a provider is late", "Keep the game pending. Do not estimate a score or replace an official line from memory. Refresh health and retry the relevant check. A final-score correction is intentionally an audited database workflow, never a casual page edit."],
  ["6. If a game is moved, postponed, cancelled, or no contest", "Open Game Exceptions, select the verified game, and confirm the status. A rescheduled game keeps its existing pick but receives its new lock time; cancelled and no-contest selections follow the published settlement policy and remain in the audit trail."],
];

const constitution = [
  ["Article I · The competition", "Pick'em is an against-the-spread season contest organized by scoring period. Each period publishes its own game list and pick capacity; the saved period configuration, not an email or a commissioner memory, governs what can be submitted."],
  ["Article II · Pick submission", "A player may submit no more than the period's configured maximum and may select only a team in a listed game. Picks remain editable until that game's kickoff. A started game is sealed; later games stay open until their own kickoffs."],
  ["Article III · Lines and grading", "The official spread saved at line lock is the permanent grading line. A selected team that covers wins. A push is recorded as a Pick'em loss. Scores are imported only after verification; a pending or corrected score stays pending until the audited grading workflow accepts it."],
  ["Article IV · Public record", "Selections are private before the selected game's kickoff. At kickoff, that game's picks become public on the Slate and in any matching reveal receipt. Started-game receipts remain visible as the permanent record; future selections are never exposed early."],
  ["Article V · Disrupted games", "A postponement preserves existing picks and receives its new lock and kickoff timing. A cancellation or no contest follows the disruption workflow: affected selections are voided or settled according to the recorded status, remain in the audit trail, and never create an invented score."],
  ["Article VI · Survivor", "Survivor is a separate regular-season contest. Each active entry submits one outright team per scoring period, and a team may be used only once. The pick can be changed until that game's kickoff. A win advances the entry; a loss, tie, missed required pick, or invalidated contest eliminates it. Survivor ends with the regular season."],
  ["Article VII · Playoffs", "Playoff periods use their configured pick capacity. Eligibility is snapshotted at the start of each Eastern game day: a player who can no longer tie the leader is excluded from that day's scoring, and later picks do not restore eligibility."],
  ["Article VIII · Champions and ties", "The standings never invent a tiebreaker. Every player tied for the final Pick'em lead is a co-champion and receives the same permanent trophy-history record. When one active Survivor entry remains, the site crowns that player automatically and stops Survivor reminders."],
  ["Article IX · Continuity", "Completed periods and seasons remain intact. The annual season handoff occurs automatically on August 1 in Eastern time. Pick'em records contribute to the season and all-time Pick'em standings; Survivor results remain a separate record."],
];

export default function CommissionerHandbook() {
  return (
    <section className="border-b-2 border-zinc-900 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-zinc-600">COMMISSIONER REFERENCE</p>
          <h2 className="mt-1 font-serif text-3xl font-bold">Game day and season handbook</h2>
          <p className="mt-2 max-w-3xl text-zinc-700">The safe operating order, the rules the system enforces, and the few moments that require a commissioner decision.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-2xl font-bold">Gameday runbook</h3>
          <ol className="mt-3 space-y-2">
            {runbook.map(([title, detail]) => <li className="border border-zinc-300 bg-white p-3" key={title}><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-5 text-zinc-700">{detail}</p></li>)}
          </ol>
        </div>
        <div>
          <h3 className="font-serif text-2xl font-bold">Published pool constitution</h3>
          <p className="mt-2 text-sm leading-5 text-zinc-700">The public reference for what is submitted, when it becomes visible, how it is graded, and how the season is preserved.</p>
          <dl className="mt-3 space-y-2">
            {constitution.map(([term, detail]) => <div className="border border-zinc-300 bg-white p-3" key={term}><dt className="font-bold">{term}</dt><dd className="mt-1 text-sm leading-5 text-zinc-700">{detail}</dd></div>)}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="border border-zinc-400 bg-[#fffaf0] p-4"><h3 className="font-bold">Data-source contingency</h3><p className="mt-1 text-sm leading-5 text-zinc-700">Before lock, retry the official-line check. At or after lock, preserve the saved official line; never retroactively replace it. A late score remains pending until verified.</p></article>
        <article className="border border-zinc-400 bg-[#fffaf0] p-4"><h3 className="font-bold">Rare controls</h3><p className="mt-1 text-sm leading-5 text-zinc-700">Import is preview-first. Line locking is repeat-safe. Final-score reconciliation is read-only. A score correction requires the audited database workflow; disruption changes demand confirmation and write an audit record.</p></article>
        <article className="border border-zinc-400 bg-[#fffaf0] p-4"><h3 className="font-bold">Season closeout</h3><p className="mt-1 text-sm leading-5 text-zinc-700">Confirm every period is complete, review the final archive, verify every champion and co-champion history record, then create—not overwrite—the next season.</p></article>
      </div>
    </section>
  );
}
