"use client";

import Link from "next/link";
import { type CSSProperties, useState } from "react";

const steps = [
  { time: "Before kickoff", title: "Verify readiness", body: "Run Automation Preflight and the read-only checks. A red result identifies the exact setup item to resolve before game day.", href: "#automation-preflight", action: "Open readiness checks" },
  { time: "At line lock", title: "Confirm official lines", body: "Automation locks each due line. Use the manual check once only when the live map identifies a missed scheduled run.", href: "#official-spread-locks", action: "Open line locks" },
  { time: "After games", title: "Sync final scores", body: "The score worker begins after the three-hour eligibility window, grades both pools atomically, and respects provider backoff.", href: "#final-score-check", action: "Open score sync" },
  { time: "After grading", title: "Reconcile finals", body: "The read-only comparison checks saved finals against the provider and flags a real discrepancy without changing a result.", href: "#final-score-reconciliation", action: "Open reconciliation" },
  { time: "When held", title: "Resolve exceptions", body: "Only verified postponements, cancellations, no-contests, or missing grades should interrupt the normal path.", href: "#game-exceptions", action: "Open exceptions" },
];

export default function GameDayPlaybook() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const selected = steps[selectedIndex];

  return <section className="game-day-playbook border-b-2 border-zinc-900 py-8">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-xs font-black tracking-[0.16em] text-zinc-600">GAMEDAY OPERATIONS PLAYBOOK</p><h2 className="mt-1 font-serif text-3xl font-bold">Follow the safe path</h2><p className="mt-2 text-zinc-700">Tap a stage for the exact check. Scheduled automation remains the primary path.</p></div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-zinc-600">Ready → Lock → Grade → Verify → Resolve</p>
    </div>

    <ol className="commissioner-flow mt-7" aria-label="Gameday operating flow" style={{ "--commissioner-step-count": steps.length } as CSSProperties}>
      {steps.map((step, index) => <li className={`commissioner-flow-step ${index < selectedIndex ? "is-complete" : index === selectedIndex ? "is-active" : "is-waiting"}`} key={step.title}>
        <button aria-current={index === selectedIndex ? "step" : undefined} aria-pressed={index === selectedIndex} className="commissioner-flow-button" onClick={() => setSelectedIndex(index)} type="button">
          <span className="commissioner-flow-node" aria-hidden="true">{index < selectedIndex ? "✓" : index + 1}</span>
          <span className="commissioner-flow-copy"><span className="commissioner-flow-label">{step.title}</span><span className="commissioner-flow-state">{step.time}</span></span>
        </button>
      </li>)}
    </ol>

    <div className="commissioner-map-detail is-active mt-6">
      <div><p className="text-xs font-black tracking-[0.14em]">STEP {selectedIndex + 1} · {selected.time.toUpperCase()}</p><p className="mt-2 font-serif text-xl font-bold">{selected.title}</p><p className="mt-1 text-sm leading-5 text-zinc-700">{selected.body}</p></div>
      <div className="commissioner-map-next"><p className="text-xs font-black tracking-[0.14em]">OPEN THE MATCHING CHECK</p><Link className="mt-2 inline-block text-sm font-bold underline" href={selected.href}>{selected.action}</Link></div>
    </div>
  </section>;
}
