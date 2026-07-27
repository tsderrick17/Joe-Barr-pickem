import Link from "next/link";

const steps = [
  { time: "Before kickoff", title: "Verify readiness", body: "Refresh Automation Health and run the read-only Integrity Rehearsal. Resolve any red result before picks lock.", href: "#integrity-rehearsal", action: "Open readiness checks" },
  { time: "At line lock", title: "Confirm official lines", body: "Automation locks due lines. The manual check is safe if a scheduled run needs confirmation or recovery.", href: "#official-spread-locks", action: "Open line locks" },
  { time: "After games finish", title: "Sync final scores", body: "Run the final-score check only after the three-hour eligibility window. It grades picks and performs a valid weekly handoff.", href: "#final-score-check", action: "Open score sync" },
  { time: "Any exception", title: "Resolve held games", body: "Review postponed, cancelled, or ungraded final games before treating a completed week as settled.", href: "#game-exceptions", action: "Open exceptions" },
];

export default function GameDayPlaybook() {
  return <section className="border-b-2 border-zinc-900 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="font-serif text-2xl font-bold">Game Day Playbook</h2><p className="mt-2 text-zinc-700">Use this order for manual verification. Scheduled automation remains the primary path.</p></div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-600">Readiness → Lock → Grade → Review</p>
    </div>
    <ol className="mt-5 grid gap-3 sm:grid-cols-2">
      {steps.map((step, index) => <li className="border border-zinc-400 bg-white p-4" key={step.title}>
        <p className="text-xs font-black tracking-[0.14em] text-zinc-600">{index + 1} · {step.time.toUpperCase()}</p>
        <h3 className="mt-1 font-serif text-xl font-bold">{step.title}</h3>
        <p className="mt-2 text-sm leading-5 text-zinc-700">{step.body}</p>
        <Link className="mt-3 inline-block text-sm font-bold underline" href={step.href}>{step.action}</Link>
      </li>)}
    </ol>
  </section>;
}
