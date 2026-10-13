import { bowlPoolLaunchAt } from "@/lib/bowl-pool.js";
import { seasonYearAt } from "@/lib/season";

/**
 * Which optional header tabs to show (NCAA Bowls, Commissioner), decided before the page is first drawn so the tabs never slide
 * sideways when the account answers (iPhone Safari left the active underline painted where a moved tab used to be). The tabs are
 * always in the page and usable at once; data-nav-bowls and data-nav-commissioner on <html> show or hide the optional ones.
 *
 * NAV_TABS_SCRIPT runs inline in <head>: it shows NCAA Bowls once Bowl season opens, and otherwise repeats what this device last
 * showed. When the account answers, rememberTabs() sets the real answer and keeps it for next time; signing out forgets it.
 */
const KEY = "pickem-nav-tabs";

export function bowlSeasonOpen(now = new Date()) {
  return now.getTime() >= Date.parse(bowlPoolLaunchAt(seasonYearAt(now)));
}

function apply({ bowls, commissioner }: { bowls: boolean; commissioner: boolean }) {
  const root = document.documentElement;
  if (bowls) root.dataset.navBowls = "1"; else delete root.dataset.navBowls;
  if (commissioner) root.dataset.navCommissioner = "1"; else delete root.dataset.navCommissioner;
}

export function rememberTabs(isCommissioner: boolean) {
  const tabs = { bowls: isCommissioner || bowlSeasonOpen(), commissioner: isCommissioner };
  apply(tabs);
  try { window.localStorage.setItem(KEY, JSON.stringify(tabs)); } catch { /* private mode: the tabs are still right for this visit */ }
}

export function forgetTabs() {
  apply({ bowls: bowlSeasonOpen(), commissioner: false });
  try { window.localStorage.removeItem(KEY); } catch { /* nothing remembered */ }
}

/** The inline script; `bowlLaunchMs` is when this season's Bowl Pool opens. */
export function navTabsScript(bowlLaunchMs: number) {
  return `try{var r=document.documentElement,t=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"{}");if(t.bowls||Date.now()>=${bowlLaunchMs})r.dataset.navBowls="1";if(t.commissioner)r.dataset.navCommissioner="1"}catch(e){}`;
}
