"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

// How long a tapped link may leave the page where it was before the page is loaded the old-fashioned way.
const STUCK_AFTER_MS = 4000;

/**
 * A safety net under every link. Next moves between pages by asking the server for the next page's data; if that never comes back (a page
 * left open across a deploy, a connection the phone put to sleep) the tap does nothing, forever, while buttons on the page keep working.
 * When a tapped link has not moved the page after a few seconds, this loads that page normally instead. A link that did move the page, or a
 * page the player has since left or come back from, is left alone.
 */
export default function StuckLinkGuard() {
  const pathname = usePathname();

  useEffect(() => {
    let waiting = 0;
    const cancel = () => window.clearTimeout(waiting);
    const onClick = (event: MouseEvent) => {
      // Next takes a tap over by cancelling the browser's own jump; a tap it left alone is already a normal page load.
      if (!event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const to = new URL(link.href, window.location.href);
      const from = window.location.href;
      if (to.origin !== window.location.origin || to.pathname + to.search === window.location.pathname + window.location.search) return;
      cancel();
      waiting = window.setTimeout(() => {
        if (window.location.href === from && document.visibilityState === "visible") window.location.assign(to.href);
      }, STUCK_AFTER_MS);
    };
    // On the window, after React's own handler on the document has had the tap.
    window.addEventListener("click", onClick);
    window.addEventListener("popstate", cancel);
    return () => {
      cancel();
      window.removeEventListener("click", onClick);
      window.removeEventListener("popstate", cancel);
    };
    // A new page (the path changed) means the tapped link worked: the effect starts over and drops the wait.
  }, [pathname]);

  return null;
}
