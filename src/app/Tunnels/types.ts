/** A jump host as the list shows it. No secret of any kind, ever. */
export interface TunnelSummary {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  /** Whether one is stored. The value is never sent back. */
  hasPassword: boolean;
  hasPrivateKey: boolean;
  /** Whether a host key is pinned. False is the loud one. */
  verifiesHostKey: boolean;
  hostKeyFingerprint: string | null;
  describedAs: string;
  /** How many targets and destinations reach through it. */
  usedBy: number;
}

/** A tunnel to create or change. An absent secret keeps the stored one; an empty one clears it. */
export interface TunnelRequest {
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
  hostKeyFingerprint?: string | null;
}

export interface TunnelCheck {
  reachable: boolean;
  message: string | null;
  /** The key it presented, so pinning it is a copy and a save. */
  fingerprint: string | null;
}
