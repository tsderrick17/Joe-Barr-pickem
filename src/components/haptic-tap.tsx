"use client";

import { useHapticsKind, useVibrationOn } from "@/lib/use-haptics";

const stopEcho = (event: Event) => event.stopPropagation();

/**
 * The iPhone's tick for a button: an invisible label over the whole button with a hidden switch inside, so the finger's own tap flips the switch
 * (since iOS 26.5 an iPhone only ticks for a real finger, never for code). Put it last inside a `relative` button. The tap still reaches the button
 * once; the switch's own echo of the click is stopped before anything else sees it. It stays mounted through the tap even when the tap changes the
 * button (disables it, or remounts the content): the finger's switch flips only after the click has finished, so a layer that vanished with the
 * state would give no tick. A disabled button's layer lets taps through, so a button that cannot be used gives nothing. Nothing is added on any other device, or where the player turned
 * Vibration off (`always` is for the Feel test, which ticks regardless).
 */
export function HapticTap({ always = false }: { always?: boolean }) {
  const iphone = useHapticsKind() === "iphone";
  const wanted = useVibrationOn();
  if (!iphone || !(wanted || always)) return null;
  return <label aria-hidden="true" className="absolute inset-0 touch-manipulation [-webkit-tap-highlight-color:transparent] [button:disabled_&]:pointer-events-none" data-haptic-tap="">
    <input className="invisible absolute m-0 size-px" ref={(element) => {
      element?.addEventListener("click", stopEcho);
      return () => element?.removeEventListener("click", stopEcho);
    }} type="checkbox" {...{ switch: "" }} />
  </label>;
}
