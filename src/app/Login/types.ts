/** Wire types for signing in, mirroring io.keydra.authz.dto.AuthzDtos. */

/**
 * Whether there is anything to sign into, and whether anybody has.
 *
 * <p>Three states that look nothing alike: an instance with enforcement off has no sign-in at all;
 * one with enforcement on and no accounts needs its first administrator before it has one; the rest
 * is an ordinary login.
 */
export interface AuthState {
  securityEnabled: boolean;
  needsSetup: boolean;
  authenticated: boolean;
  username: string;
  /**
   * Signed in, and able to do nothing but pair an authenticator.
   *
   * <p>The server has already taken the roles away — every gated request answers 403 on its own —
   * so this is not what enforces the restriction. It is what lets the page say why, instead of
   * drawing an application in which nothing works.
   */
  mustEnrolSecondFactor: boolean;
}

/** What the caller may do, so the interface can stop offering what would be refused. */
export interface EffectivePermissions {
  username: string;
  securityEnabled: boolean;
  instance: string[];
  /** Keyed by connection id as a string, because JSON keys are strings. */
  connections: Record<string, string[]>;
}

/** A way in, as the login page sees it. Mirrors io.keydra.authz.dto.ProviderDtos. */
export interface SignInOption {
  key: string;
  displayName: string;
  kind: 'OIDC' | 'OAUTH2';
}
