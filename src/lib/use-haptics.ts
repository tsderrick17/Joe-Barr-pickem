"use client";

import { useSyncExternalStore } from "react";
import { hapticsAvailable, subscribeVibration, vibrationOn } from "@/lib/haptics-client";

const neverChanges = () => () => undefined;
const noHapticsOnServer = () => "none" as const;
const onOnServer = () => true;

/** Which haptics this device has: "android", "iphone" or "none". Nothing on the server, so the first paint is the same everywhere. */
export function useHapticsKind() {
  return useSyncExternalStore(neverChanges, hapticsAvailable, noHapticsOnServer);
}

/** Whether this device's Vibration switch is on. */
export function useVibrationOn() {
  return useSyncExternalStore(subscribeVibration, vibrationOn, onOnServer);
}
