import type { MetadataRoute } from "next";

/**
 * Lets the pool be added to a phone's home screen as an app: it opens full-screen at Standings with the football icon.
 * There is no offline mode on purpose; picks and grades must always be live.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Lead Pipe Locks",
    short_name: "Lead Pipe Locks",
    description: "Joe Barr Memorial Pick'em",
    // The app's identity; "/" is what browsers already worked out from start_url, so phones that installed it earlier keep the same app.
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4efe4",
    theme_color: "#171719",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Lets a browser tab on Android ask whether this app is already on the phone (navigator.getInstalledRelatedApps), so the
    // Add to Home Screen banner is not shown to someone who has it.
    related_applications: [{ platform: "webapp", url: "/manifest.webmanifest" }],
  };
}
