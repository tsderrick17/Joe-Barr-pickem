"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchWithSession, SessionUnavailableError } from "@/lib/auth-session";
import { needsYou, spokeStatus } from "@/lib/commissioner-wheel.js";

type Stage = { id: string; label: string; state: string; detail: string; next: string };
export type OperationsMap = {
  checkedAt: string;
  overall: "healthy" | "attention";
  headline: string;
  summary: string;
  openIncidentCount: number;
  providerCreditSnapshot?: { used: number; remaining: number; limit: number; reportedAt: string } | null;
  stages: Stage[];
};

type Status = {
  map: OperationsMap | null;
  failed: boolean;
  spokes: ReturnType<typeof spokeStatus>;
  needs: ReturnType<typeof needsYou>;
  refresh: () => void;
};

const StatusContext = createContext<Status | null>(null);

/**
 * Reads the live operations map once for the whole Commissioner area, so the wheel, the dial and the Needs you list agree and moving between
 * pages costs nothing. It is read again when the Commissioner comes back to the tab.
 */
export function CommissionerStatusProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<OperationsMap | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    void (async () => {
      try {
        const response = await fetchWithSession("/api/admin/operations-map");
        if (!response.ok) throw new Error("The operations map could not be read.");
        setMap(await response.json() as OperationsMap);
        setFailed(false);
      } catch (reason) {
        if (reason instanceof SessionUnavailableError) window.location.replace("/login");
        else setFailed(true);
      }
    })();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(refresh, 0);
    const again = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", again);
    return () => { window.clearTimeout(timer); document.removeEventListener("visibilitychange", again); };
  }, [refresh]);

  const value = useMemo(() => ({ map, failed, spokes: spokeStatus(map), needs: needsYou(map), refresh }), [map, failed, refresh]);
  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useCommissionerStatus() {
  const status = useContext(StatusContext);
  if (!status) throw new Error("useCommissionerStatus needs the CommissionerStatusProvider.");
  return status;
}
