// @ts-check
import {
  derivePlayerAuthPassword,
  playerAuthEmail,
} from "./player-auth-credential.js";

/** @typedef {{ id: string, app_metadata?: Record<string, unknown> }} AuthUser */
/** @typedef {{ access_token: string, refresh_token: string }} AuthSession */
/** @typedef {{ data: { session: AuthSession | null, user: AuthUser | null }, error: unknown | null }} SignInResult */
/**
 * @param {{
 *   pin: string,
 *   serverSecret: string,
 *   signIn: (credentials: { email: string, password: string }) => Promise<SignInResult>,
 * }} options
 */
export async function authenticatePlayerPin({
  pin,
  serverSecret,
  signIn,
}) {
  const email = playerAuthEmail(pin);
  const hardenedPassword = derivePlayerAuthPassword(pin, serverSecret);
  const auth = await signIn({ email, password: hardenedPassword });
  return { auth };
}
