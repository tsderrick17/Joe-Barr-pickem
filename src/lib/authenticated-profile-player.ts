import type { NextRequest } from "next/server";
import { authenticateActivePlayer, type Access, type NamedPlayer, type PreferencesPlayer } from "@/lib/authenticate-active-player";

/**
 * The signed-in active player for the profile and chat routes, on the shared authentication result. The result
 * is an object, never null: test `.ok` (the old name, `authenticatedProfilePlayer`, returned a player or null).
 */
export function profilePlayerAccess(request: NextRequest, includePreferences: true): Promise<Access<PreferencesPlayer>>;
export function profilePlayerAccess(request: NextRequest, includePreferences?: false): Promise<Access<NamedPlayer>>;
export function profilePlayerAccess(request: NextRequest, includePreferences = false): Promise<Access<NamedPlayer | PreferencesPlayer>> {
  return includePreferences
    ? authenticateActivePlayer(request, { profile: "preferences" })
    : authenticateActivePlayer(request, { profile: "named" });
}
