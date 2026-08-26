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

/** Keep player identity private and discard one confirmed browser-extension error. */
export function prepareBrowserSentryEvent(event: ErrorEvent): ErrorEvent | null {
  delete event.user;
  return eventMessages(event).some((message) => browserExtensionMessages.has(message))
    ? null
    : event;
}
