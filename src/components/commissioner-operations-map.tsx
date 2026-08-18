"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";

type StageState = "complete" | "active" | "waiting" | "attention";
type Stage = { id: string; label: string; state: StageState; detail: string; next: string };
type OperationsMap = {
  checkedAt: string;
  overall: "healthy" | "attention";
  headline: string;
  summary: string;
  currentStageId: string;
  openIncidentCount: number;
  providerAllowance?: number | null;
  stages: Stage[];
};

const stateLabel: Record<StageState, string> = {
  complete: "Complete",
  active: "In progress",
  waiting: "Waiting",
  attention: "Needs attention",
};

async function loadOperationsMap() {
  const response = await fetchWithSession("/api/admin/operations-map");
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error ?? "The live operations map could not be loaded.");
  return payload as OperationsMap;
}

export default function CommissionerOperationsMap() {
  const [map, setMap] = useState<OperationsMap | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const result = await loadOperationsMap();
      setMap(result);
      setSelectedId((current) => current && result.stages.some((stage) => stage.id === current) ? current : result.currentStageId);
    } catch (reason) {
      if (reason instanceof SessionUnavailableError) window.location.replace("/login");
      else setError(reason instanceof Error ? reason.message : "The live operations map could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selected = useMemo(
    () => map?.stages.find((stage) => stage.id === selectedId) ?? map?.stages[0] ?? null,
    [map, selectedId],
  );

  return (
    <section className="commissioner-map border-b-2 border-zinc-900 py-8" aria-labelledby="operations-map-title">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-zinc-600">LIVE OPERATIONS MAP</p>
          <h2 className="mt-1 font-serif text-3xl font-bold" id="operations-map-title">Where the pool stands</h2>
          <p className="mt-2 max-w-2xl text-zinc-700">Follow the active path. If something stops, the first red stage explains the hold and the next safe move.</p>
        </div>
        <button className="border border-zinc-900 bg-white px-4 py-2 text-sm font-bold disabled:opacity-40" disabled={loading} onClick={() => void refresh()} type="button">
          {loading ? "Checking…" : "Refresh map"}
        </button>
      </div>

      {error ? <p className="mt-5 border-l-4 border-red-700 bg-red-50 p-4 font-semibold text-red-900">{error}</p> : null}
      {!map && loading ? <div className="mt-6 h-40 animate-pulse bg-zinc-200" aria-label="Loading live operations map" /> : null}

      {map ? <>
        <div className={`commissioner-map-banner mt-6 ${map.overall === "attention" ? "is-attention" : "is-healthy"}`}>
          <div>
            <p className="text-xs font-black tracking-[0.14em]">{map.overall === "attention" ? "ACTION NEEDED" : "RUNNING NORMALLY"}</p>
            <p className="mt-1 font-serif text-2xl font-bold">{map.headline}</p>
            <p className="mt-1 text-sm leading-5">{map.summary}</p>
          </div>
          <div className="commissioner-map-pulse" aria-hidden="true"><span /></div>
        </div>

        <ol className="commissioner-flow mt-8" aria-label="Current pool operations flow">
          {map.stages.map((stage, index) => {
            const selectedStage = selected?.id === stage.id;
            const current = map.currentStageId === stage.id;
            return <li className={`commissioner-flow-step is-${stage.state}`} key={stage.id}>
              <button aria-current={current ? "step" : undefined} aria-pressed={selectedStage} className="commissioner-flow-button" onClick={() => setSelectedId(stage.id)} type="button">
                <span className="commissioner-flow-node" aria-hidden="true">{stage.state === "complete" ? "✓" : stage.state === "attention" ? "!" : index + 1}</span>
                <span className="commissioner-flow-copy">
                  <span className="commissioner-flow-label">{stage.label}</span>
                  <span className="commissioner-flow-state">{stateLabel[stage.state]}</span>
                </span>
              </button>
            </li>;
          })}
        </ol>

        {selected ? <div className={`commissioner-map-detail mt-7 is-${selected.state}`} aria-live="polite">
          <div>
            <p className="text-xs font-black tracking-[0.14em]">{stateLabel[selected.state].toUpperCase()} · {selected.label.toUpperCase()}</p>
            <p className="mt-2 font-serif text-xl font-bold">{selected.detail}</p>
          </div>
          <div className="commissioner-map-next">
            <p className="text-xs font-black tracking-[0.14em]">WHAT HAPPENS NEXT</p>
            <p className="mt-1 text-sm leading-5">{selected.next}</p>
          </div>
        </div> : null}

        <div className="mt-4 flex flex-wrap justify-between gap-3 text-xs text-zinc-600">
          <p>Checked {new Date(map.checkedAt).toLocaleString("en-US", { timeZone: "America/New_York", timeZoneName: "short" })}</p>
          <p>{map.openIncidentCount ? `${map.openIncidentCount} open watchdog incident${map.openIncidentCount === 1 ? "" : "s"}` : "Watchdog is quiet"}{map.providerAllowance !== null && map.providerAllowance !== undefined ? ` · ${map.providerAllowance} provider credits` : ""}</p>
        </div>
      </> : null}
    </section>
  );
}
