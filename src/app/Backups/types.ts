/** Mirrors io.keydra.backup.entity.DestinationKind. */
export const DestinationKind = {
  Local: 'LOCAL',
  S3: 'S3',
  AzureBlob: 'AZURE_BLOB',
  Gcs: 'GCS',
  Sftp: 'SFTP',
  Ftp: 'FTP',
  /** Anywhere else, named by an endpoint address. Write-only. */
  Custom: 'CUSTOM',
} as const;

export type DestinationKind = (typeof DestinationKind)[keyof typeof DestinationKind];

/** The kinds Keydra can also read back, which is what retention and restoring need. */
export const READABLE_KINDS: DestinationKind[] = [
  DestinationKind.Local,
  DestinationKind.S3,
  DestinationKind.AzureBlob,
  DestinationKind.Gcs,
  DestinationKind.Sftp,
  DestinationKind.Ftp,
];

export const isReadable = (kind: DestinationKind): boolean => READABLE_KINDS.includes(kind);

/**
 * The kinds a tunnel can reach.
 *
 * <p>A forwarded port reaches a host and a port. The public clouds are named by an address inside
 * a certificate, so forwarding one to a local port is a TLS failure rather than a connection —
 * which is why the form refuses the combination rather than letting it fail later.
 */
export const TUNNELLABLE_KINDS: DestinationKind[] = [
  DestinationKind.S3,
  DestinationKind.Sftp,
  DestinationKind.Ftp,
];

export const canTunnel = (kind: DestinationKind): boolean => TUNNELLABLE_KINDS.includes(kind);

/** A destination as the list shows it. No secret of any kind, ever. */
export interface DestinationSummary {
  id: number;
  name: string;
  kind: DestinationKind;
  enabled: boolean;
  location: string | null;
  path: string | null;
  port: number | null;
  endpoint: string | null;
  region: string | null;
  pathStyle: boolean;
  accessKey: string | null;
  /** Whether one is stored. The value is never sent back. */
  hasSecret: boolean;
  hasPrivateKey: boolean;
  tls: boolean;
  /** The jump host it is reached through, if any. */
  tunnelId: number | null;
  /** Whether backups sent here are encrypted. The passphrase itself never leaves. */
  encrypts: boolean;
  /**
   * The keys backups are encrypted to, when that is how it is done.
   *
   * <p>Returned, unlike every other secret near it, because these are the halves that only
   * encrypt. Empty when this destination does not encrypt to keys.
   */
  recipients: BackupRecipient[];
  /** One line saying where this points, for a list that has no room for the fields. */
  describedAs: string;
}

/** A destination to create or change. An absent secret keeps the stored one; an empty one clears it. */
export interface DestinationRequest {
  name: string;
  kind: DestinationKind;
  enabled?: boolean;
  location?: string | null;
  path?: string | null;
  port?: number | null;
  endpoint?: string | null;
  region?: string | null;
  pathStyle?: boolean;
  accessKey?: string | null;
  secretKey?: string;
  privateKey?: string;
  passphrase?: string;
  tls?: boolean;
  tunnelId?: number | null;
  /** Write-only, same rule as every other secret. Lose it and the backups are gone. */
  encryptionPassphrase?: string;
  /**
   * The keys to encrypt to. Keydra never holds the other half of any of them.
   *
   * <p>Absent leaves the stored list alone; empty clears it, which turns encryption off for the
   * next backup rather than making anything already written unreadable.
   */
  recipients?: BackupRecipient[] | null;
}

/**
 * One key a backup can be opened with.
 *
 * <p>The label is what makes a list usable: removing one means knowing which one, and the only
 * other thing distinguishing two keys is forty characters of base64.
 */
export interface BackupRecipient {
  label: string;
  publicKey: string;
}

/** A key pair, handed over once and stored nowhere. */
export interface BackupKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface DestinationCheck {
  reachable: boolean;
  message: string | null;
}

/** What a backup file says about itself, read only when one is asked about. */
export interface BackupHeader {
  keydra: number | null;
  connection: string | null;
  connectionId: number | null;
  takenAt: string | null;
  match: string | null;
}

export interface BackupSummary {
  name: string;
  size: number;
  modifiedAt: string | null;
  /** Read off the name, so a listing says so without fetching anything. */
  encrypted: boolean;
  header: BackupHeader | null;
}

export interface BackupTaken {
  name: string;
  keys: number;
  size: number;
  destination: string;
  /** What the retention removed, so a shrinking list is explained rather than noticed. */
  removed: string[];
}

export interface RestoreRequest {
  destinationId: number;
  name: string;
  replace: boolean;
  /** For a backup encrypted to a key. Used once and kept nowhere. */
  privateKey?: string;
}
