"use client";

import { useSyncExternalStore } from "react";
import { hapticsAvailable } from "@/lib/haptics-client";

const neverChanges = () => () => undefined;
const isIPhone = () => hapticsAvailable() === "iphone";
const notOnServer = () => false;
const stopEcho = (event: Event) => event.stopPropagation();

/**
 * The iPhone's tick for a button: an invisible label over the whole button with a hidden switch inside, so the finger's own tap flips the switch
 * (since iOS 26.5 an iPhone only ticks for a real finger, never for code). Put it last inside a `relative` button. The tap still reaches the button
 * once; the switch's own echo of the click is stopped before anything else sees it. Nothing is added on any other device.
 */
export function HapticTap() {
  const iphone = useSyncExternalStore(neverChanges, isIPhone, notOnServer);
  if (!iphone) return null;
  return <label aria-hidden="true" className="absolute inset-0 touch-manipulation [-webkit-tap-highlight-color:transparent]" data-haptic-tap="">
    <input className="invisible absolute m-0 size-px" ref={(element) => {
      element?.addEventListener("click", stopEcho);
      return () => element?.removeEventListener("click", stopEcho);
    }} type="checkbox" {...{ switch: "" }} />
  </label>;
}
