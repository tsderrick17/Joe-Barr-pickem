// @ts-check
import {
  derivePlayerAuthPassword,
  legacyPlayerAuthPassword,
  PLAYER_AUTH_CREDENTIAL_VERSION,
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
 *   updateAccount: (userId: string, attributes: { password: string, app_metadata: Record<string, unknown> }) => Promise<{ error: unknown | null }>,
 * }} options
 */
export async function authenticatePlayerPin({
  pin,
  serverSecret,
  signIn,
  updateAccount,
}) {
  const email = playerAuthEmail(pin);
  const hardenedPassword = derivePlayerAuthPassword(pin, serverSecret);
  let auth = await signIn({ email, password: hardenedPassword });

  if (!auth.error && auth.data.session) {
    return { auth, rotationFailed: false, migrated: false };
  }

  const legacy = await signIn({ email, password: legacyPlayerAuthPassword(pin) });
  if (!legacy.data.user) {
    return { auth: legacy, rotationFailed: false, migrated: false };
  }

  const { error: rotateError } = await updateAccount(legacy.data.user.id, {
    password: hardenedPassword,
    app_metadata: {
      ...(legacy.data.user.app_metadata ?? {}),
      pickem_credential_version: PLAYER_AUTH_CREDENTIAL_VERSION,
    },
  });

  if (rotateError) {
    return { auth: legacy, rotationFailed: true, migrated: false };
  }

  auth = await signIn({ email, password: hardenedPassword });
  return { auth, rotationFailed: false, migrated: Boolean(auth.data.session) };
}
