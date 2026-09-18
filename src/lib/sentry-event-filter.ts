import type { ErrorEvent } from "@sentry/nextjs";

const browserExtensionMessages = new Set([
  "Invalid call to runtime.sendMessage(). Tab not found.",
]);

function eventMessages(event: ErrorEvent) {
  const exceptionMessages = event.exception?.values
    ?.map((exception) => exception.value)
    .filter((value): value is string => Boolean(value)) ?? [];
  return [event.message, ...exceptionMessages]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/^Error:\s*/, "").trim());
}

function routeFromEvent(event: ErrorEvent): string | null {
  if (event.transaction?.startsWith("/")) return event.transaction;
  const rawUrl = event.request?.url;
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).pathname;
  } catch {
    return null;
  }
}

/** Add low-cardinality, privacy-safe routing context without query strings or identities. */
export function prepareSentryEvent(event: ErrorEvent): ErrorEvent | null {
  delete event.user;
  const route = routeFromEvent(event);
  if (route) {
    event.tags = { ...event.tags, "app.route": route };
    event.tags["app.surface"] = route.startsWith("/admin") ? "admin" : "player";
  }
  return event;
}

/** Keep player identity private and discard one confirmed browser-extension error. */
export function prepareBrowserSentryEvent(event: ErrorEvent): ErrorEvent | null {
  if (eventMessages(event).some((message) => browserExtensionMessages.has(message))) {
    return null;
  }
  return prepareSentryEvent(event);
}
