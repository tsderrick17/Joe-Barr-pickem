"use client";

import { useEffect } from "react";
import { fetchWithSession } from "@/lib/auth-session";
import { badgeRefreshDue, PICKS_SAVED_EVENT } from "@/lib/app-badge.js";

type BadgeNavigator = Navigator & { setAppBadge?: (count: number) => Promise<void>; clearAppBadge?: () => Promise<void> };

/**
 * Keeps the number on the app icon right while the app is in use: picks still to make this week. It runs only in the app added to the Home Screen
 * (a browser tab has no icon), reads the number when the app opens, when you come back to it, and right after you save picks. A push notification
 * sets it too, so it is right even when the app is closed. Shows nothing.
 */
export default function AppBadge() {
  useEffect(() => {
    const badge = navigator as BadgeNavigator;
    const inApp = (navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (!inApp || !badge.setAppBadge) return;
    let lastRead = 0;
    let active = true;
    async function refresh() {
      lastRead = Date.now();
      try {
        const response = await fetchWithSession("/api/badge", { cache: "no-store" });
        if (!response.ok || !active) return;
        const { count } = await response.json() as { count: number };
        if (!Number.isInteger(count) || count < 0) return;
        if (count > 0) await badge.setAppBadge?.(count); else await badge.clearAppBadge?.();
      } catch {
        // Signed out or offline: leave the icon as it is.
      }
    }
    const onVisible = () => { if (document.visibilityState === "visible" && badgeRefreshDue(lastRead, Date.now())) void refresh(); };
    const onSaved = () => void refresh();
    void refresh();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(PICKS_SAVED_EVENT, onSaved);
    return () => { active = false; document.removeEventListener("visibilitychange", onVisible); window.removeEventListener(PICKS_SAVED_EVENT, onSaved); };
  }, []);
  return null;
}
