"use client";

import { haptic, setVibration } from "@/lib/haptics-client";
import { useHapticsKind, useVibrationOn } from "@/lib/use-haptics";

/**
 * The Vibration switch on the Notifications page: whether taps on this phone give a tick or buzz. On by default, kept on this device, and only shown
 * on a phone that has haptics (a computer has nothing to turn off). On an iPhone it is the phone's own switch, so flipping it gives the system tick.
 */
export function VibrationSwitch() {
  const kind = useHapticsKind();
  const on = useVibrationOn();
  if (kind === "none") return null;
  return <section aria-labelledby="vibration-title" className="mt-8 border-y-2 border-(color:--themed-border-10) py-6" data-vibration={on ? "on" : "off"}>
    <h2 className="text-sm font-black tracking-[.14em]" id="vibration-title">TAP FEEL ON THIS PHONE</h2>
    <label className="mt-3 flex items-start gap-3 text-sm">
      <input checked={on} className={kind === "iphone" ? "mt-0.5 shrink-0" : "mt-1 size-4 accent-[#007e72]"} onChange={(event) => { setVibration(event.target.checked); if (event.target.checked) haptic("tick"); }} type="checkbox" {...(kind === "iphone" ? { switch: "" } : {})} />
      <span><strong className="block">Vibration</strong>A light tick or buzz when you pick a team, save your picks or pull to refresh. It is kept on this phone only.</span>
    </label>
  </section>;
}
