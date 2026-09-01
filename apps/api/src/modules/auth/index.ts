/**
 * The auth module's public surface.
 *
 * Other modules import from here and nowhere deeper (PLAN/01 §2.3 rule 1,
 * enforced by eslint-plugin-boundaries). Reaching into `session-service.ts`
 * directly is a lint error, not a style preference.
 */

export { registerAuthRoutes } from "./routes.ts";

export {
  attachSessionCookies,
  clearSessionCookies,
  requireActor,
  resolveActor,
  revokeAllSessions,
  revokeSession,
} from "./session-service.ts";

export { resetMfa } from "./mfa-service.ts";
export { toCurrentUser } from "./auth-service.ts";
