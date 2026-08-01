import Link from "next/link";

const runbook = [
  ["1. Before the first lock", "Open Season Readiness, then Automation Preflight. A red item means pause and resolve it before the pool reaches a deadline."],
  ["2. At the scheduled line lock", "Automation is primary. If its health check is late or failed, use Check official spread locks once. It is safe to re-run and records what it did."],
  ["3. At kickoff", "Do not publish or edit selections. The site reveals each game automatically at its own kickoff, leaving the full receipt in place for audit."],
  ["4. When a game is final", "Wait for the score window, then use score sync. It imports a completed score, grades ATS and Survivor separately, and only advances a settled period."],
  ["5. If a provider is late", "Keep the game pending. Do not estimate a score or replace an official line from memory. Refresh health and retry the relevant check. A final-score correction is intentionally an audited database workflow, never a casual page edit."],
  ["6. If a game is postponed or cancelled", "Open Game Exceptions, select the verified game, and confirm the status. Pending picks are voided, preserved in the audit trail, and the weekly handoff stays blocked until reviewed."],
];

const rules = [
  ["ATS grading", "The saved official line is permanent. A selected team that covers is a win; a push is recorded as a Pick’em loss."],
  ["Survivor", "One outright winner is required each active week. A tie is a loss. Teams may be used only once, and a missed required weekly pick is OUT."],
  ["Privacy", "Choices remain private until the selected game’s kickoff. After that, names and picks remain visible as the permanent public receipt."],
  ["Playoffs", "Eligibility is snapshotted at the start of each Eastern game day. Anyone who can still tie the leader at that point may pick that day; players already unable to tie are excluded and their later picks are not counted."],
  ["Season tie", "The site never invents a winner. A sole Pick’em leader is crowned automatically; a tied season lead is preserved for the commissioner to resolve under the published pool agreement before closeout."],
  ["Survivor finish", "When one active entry remains, Survivor crowns that player automatically, records the trophy history, stops Survivor reminders, and leaves the table available for audit."],
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
        <Link className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold hover:bg-[#fffaf0]" href="/archive">Open week archive</Link>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="font-serif text-2xl font-bold">Gameday runbook</h3>
          <ol className="mt-3 space-y-2">
            {runbook.map(([title, detail]) => <li className="border border-zinc-300 bg-white p-3" key={title}><p className="font-bold">{title}</p><p className="mt-1 text-sm leading-5 text-zinc-700">{detail}</p></li>)}
          </ol>
        </div>
        <div>
          <h3 className="font-serif text-2xl font-bold">Published pool rules</h3>
          <dl className="mt-3 space-y-2">
            {rules.map(([term, detail]) => <div className="border border-zinc-300 bg-white p-3" key={term}><dt className="font-bold">{term}</dt><dd className="mt-1 text-sm leading-5 text-zinc-700">{detail}</dd></div>)}
          </dl>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <article className="border border-zinc-400 bg-[#fffaf0] p-4"><h3 className="font-bold">Data-source contingency</h3><p className="mt-1 text-sm leading-5 text-zinc-700">Before lock, retry the official-line check. At or after lock, preserve the saved official line; never retroactively replace it. A late score remains pending until verified.</p></article>
        <article className="border border-zinc-400 bg-[#fffaf0] p-4"><h3 className="font-bold">Rare controls</h3><p className="mt-1 text-sm leading-5 text-zinc-700">Import is preview-first. Line locking is repeat-safe. Final-score reconciliation is read-only. A score correction requires the audited database workflow; disruption changes demand confirmation and write an audit record.</p></article>
        <article className="border border-zinc-400 bg-[#fffaf0] p-4"><h3 className="font-bold">Season closeout</h3><p className="mt-1 text-sm leading-5 text-zinc-700">Confirm every period is complete, review the final archive, resolve any shared Pick’em lead, verify trophy history, then create—not overwrite—the next season.</p></article>
      </div>
    </section>
  );
}
