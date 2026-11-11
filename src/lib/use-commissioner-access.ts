"use client";

import { useEffect, useState } from "react";
import { fetchWithSession } from "@/lib/auth-session";

export type CommissionerAccess = "checking" | "allowed" | "denied";

/**
 * Whether the signed-in account is the Commissioner, for pages that are the Commissioner's tools (the rehearsal, the Workshop's Lab):
 * "allowed" only once the account has answered as the Commissioner. A signed-out visitor is sent to sign in by the header.
 */
export function useCommissionerAccess(): CommissionerAccess {
  const [access, setAccess] = useState<CommissionerAccess>("checking");
  useEffect(() => {
    let active = true;
    fetchWithSession("/api/profile")
      .then((response) => response.ok ? response.json() as Promise<{ isCommissioner?: boolean }> : Promise.reject(new Error("The account could not be read.")))
      .then((player) => { if (active) setAccess(player.isCommissioner ? "allowed" : "denied"); })
      .catch(() => { if (active) setAccess("denied"); });
    return () => { active = false; };
  }, []);
  return access;
}
