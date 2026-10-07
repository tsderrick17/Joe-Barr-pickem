/**
 * Shared checks for request bodies. A body is unknown input until proven otherwise: `await request.json()` can
 * be `null`, an array, a number, or an object whose fields have the wrong type, and a TypeScript annotation is
 * not a check. Routes read the body with `readJsonObject`, take each field through one of these helpers, and
 * answer 400 before reading or writing any pool data.
 */
export type JsonObject = Record<string, unknown>;

export function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The body as a plain object, or null when it is malformed JSON, `null`, an array, or any other non-object. */
export async function readJsonObject(request: Request): Promise<JsonObject | null> {
  try {
    const value: unknown = await request.json();
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

const MAX_ID_LENGTH = 128;

/** A database id: a non-empty string of sensible length with no stray whitespace. */
export function idValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_ID_LENGTH && value.trim() === value ? value : null;
}

/** A string no longer than `max` characters (empty allowed), else null. */
export function textValue(value: unknown, max: number): string | null {
  return typeof value === "string" && value.length <= max ? value : null;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export function integerValue(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Present-and-valid, absent (undefined or null), or invalid: callers need to tell the last two apart. */
export function optional<T>(value: unknown, check: (value: unknown) => T | null): { ok: true; value: T | undefined } | { ok: false } {
  if (value === undefined || value === null) return { ok: true, value: undefined };
  const checked = check(value);
  return checked === null ? { ok: false } : { ok: true, value: checked };
}
