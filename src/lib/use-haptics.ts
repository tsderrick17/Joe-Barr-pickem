"use client";

import { useSyncExternalStore } from "react";
import { hapticsAvailable } from "@/lib/haptics-client";

const neverChanges = () => () => undefined;
const noHapticsOnServer = () => "none" as const;

/** Which haptics this device has: "android", "iphone" or "none". Nothing on the server, so the first paint is the same everywhere. */
export function useHapticsKind() {
  return useSyncExternalStore(neverChanges, hapticsAvailable, noHapticsOnServer);
}
