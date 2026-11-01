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

/**
 * The inline script. The launch is worked out in the browser from the one rule in bowl-pool.js (which month, day and UTC time it falls on,
 * the same every year because December is always standard time) and the season year as seasonYearAt() counts it (Eastern time, new season
 * on August 1). The page is built once and served for months, so a launch time baked in at build would be last season's by next August.
 */
export function navTabsScript() {
  const launch = new Date(bowlPoolLaunchAt(seasonYearAt()));
  const rule = [launch.getUTCMonth(), launch.getUTCDate(), launch.getUTCHours(), launch.getUTCMinutes()];
  return `try{var r=document.documentElement,t=JSON.parse(localStorage.getItem(${JSON.stringify(KEY)})||"{}"),o=false;try{var p=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"numeric"}).formatToParts(Date.now()),y=0,m=0;p.forEach(function(x){if(x.type==="year")y=+x.value;if(x.type==="month")m=+x.value});if(y){if(m<8)y--;o=Date.now()>=Date.UTC(y,${rule[0]},${rule[1]},${rule[2]},${rule[3]})}}catch(e){}if(t.bowls||o)r.dataset.navBowls="1";if(t.commissioner)r.dataset.navCommissioner="1"}catch(e){}`;
}
