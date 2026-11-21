/**
 * Day and night for the whole site, as the header's switch sets it: the page's data-theme, remembered on this device, and an event so
 * every other switch on screen (the header's) shows the same. The clubhouse's lamps flip it too.
 */
export function setSiteTheme(night) {
  document.documentElement.dataset.theme = night ? "night" : "day";
  try { window.localStorage.setItem("pickem-theme", night ? "night" : "day"); } catch { /* storage blocked: it holds for this visit */ }
  window.dispatchEvent(new Event("pickem-theme-change"));
}

export function toggleSiteTheme() {
  setSiteTheme(document.documentElement.dataset.theme !== "night");
}
