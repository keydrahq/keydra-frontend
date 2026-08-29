/** Wire types for security, mirroring io.keydra.security.dto. */

/** The three things a person can be to Keydra. Mirrors io.keydra.security.Roles. */
export const Role = {
  Viewer: 'viewer',
  Operator: 'operator',
  Admin: 'admin',
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export interface CurrentUser {
  name: string;
  roles: string[];
  /**
   * False when Keydra is not enforcing anything.
   *
   * <p>Shown plainly rather than hidden: an open instance presented as a secured one is how a
   * deployment ends up exposed by someone who believed it was not.
   */
  securityEnabled: boolean;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  action: string;
  connectionId: number | null;
  /** What was acted on — never what it was set to. */
  detail: string | null;
  succeeded: boolean;
}

export interface AclUser {
  username: string;
  enabled: boolean;
  rules: string[];
  keyPatterns: string[];
  channelPatterns: string[];
  commands: string;
  /** Whether any password is set; the hash itself never leaves the server. */
  hasPassword: boolean;
}
