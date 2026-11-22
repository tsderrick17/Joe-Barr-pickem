/**
 * Day and night for the whole site, as the header's switch sets it: the page's data-theme, remembered on this device, and an event so
 * every other switch on screen (the header's) shows the same. The clubhouse's lamps flip it too.
 */
export function setSiteTheme(night) {
  const apply = () => { document.documentElement.dataset.theme = night ? "night" : "day"; };
  // The whole page crossfades from day to night in one smooth step, instead of each part changing colour at its own speed. Where the
  // browser cannot crossfade, or motion is turned down, it simply changes.
  const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (typeof document.startViewTransition === "function" && !still) document.startViewTransition(apply); else apply();
  try { window.localStorage.setItem("pickem-theme", night ? "night" : "day"); } catch { /* storage blocked: it holds for this visit */ }
  window.dispatchEvent(new Event("pickem-theme-change"));
}

export function toggleSiteTheme() {
  setSiteTheme(document.documentElement.dataset.theme !== "night");
}
