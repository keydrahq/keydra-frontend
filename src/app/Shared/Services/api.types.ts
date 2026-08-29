/**
 * Wire types mirroring the backend's /api/v1 DTO records.
 *
 * Keep these in sync with io.keydra.* record definitions; the backend is the
 * source of truth and publishes an OpenAPI document at /api/openapi.
 */

/** Metadata captured when the server was built. */
export interface Build {
  timestamp: string;
  commit: string;
  javaVersion: string;
  quarkusVersion: string;
}

/**
 * Which Keydra answered, and whether it is the one doing the work that happens once.
 *
 * Absent for a caller who has not signed in: an instance id is usually a host or a pod name,
 * and the About endpoint answers the login page too.
 */
export interface InstanceDetails {
  id: string;
  /** Whether this instance currently holds the shared work. */
  leader: boolean;
  /** Which instance holds it, or null while nobody does. */
  chores: string | null;
}

/**
 * What this instance exports, and where.
 *
 * Absent for a caller who has not signed in, for the same reason the instance is.
 */
export interface ObservabilityDetails {
  metricsPath: string;
  traces: boolean;
  /** The collector's host, or null when nothing is collecting. */
  tracesTo: string | null;
  structuredLogs: boolean;
}

/** Response of GET /api/v1/about. */
export interface AboutResponse {
  name: string;
  version: string;
  build: Build;
  instance: InstanceDetails | null;
  observability: ObservabilityDetails | null;
}

/** Envelope broadcast over the notification hub WebSocket. */
export interface NotificationMessage<T = unknown> {
  category: string;
  payload: T;
  ts: string;
}

/**
 * Backing store a profile talks to.
 *
 * Redis and Valkey share RESP and are told apart by capability detection, not configuration;
 * a store with a different protocol gets its own entry here and its own backend engine.
 */
export const EngineType = {
  Resp: 'RESP',
  Aerospike: 'AEROSPIKE',
  Tikv: 'TIKV',
} as const;

export type EngineType = (typeof EngineType)[keyof typeof EngineType];

/**
 * Which server a profile expects to find. Mirrors io.keydra.connections.entity.ServerFlavor.
 *
 * <p>Distinct from the engine, which names a protocol: Redis and Valkey both speak RESP. This is
 * what the profile says to expect, and what the catalog draws until the target answers for itself.
 */
export const ServerFlavor = {
  Unknown: 'UNKNOWN',
  Redis: 'REDIS',
  Valkey: 'VALKEY',
  KeyDb: 'KEYDB',
  Dragonfly: 'DRAGONFLY',
  Garnet: 'GARNET',
  Aerospike: 'AEROSPIKE',
  Tikv: 'TIKV',
} as const;

export type ServerFlavor = (typeof ServerFlavor)[keyof typeof ServerFlavor];

/** Topology a connection profile points at. Mirrors io.keydra.connections.entity.ConnectionType. */
export const ConnectionType = {
  Standalone: 'STANDALONE',
  Cluster: 'CLUSTER',
  Sentinel: 'SENTINEL',
} as const;

export type ConnectionType = (typeof ConnectionType)[keyof typeof ConnectionType];

/** Lifecycle state tracked by the backend registry. */
export const ConnectionState = {
  Unknown: 'UNKNOWN',
  Connecting: 'CONNECTING',
  Up: 'UP',
  Down: 'DOWN',
} as const;

export type ConnectionState = (typeof ConnectionState)[keyof typeof ConnectionState];

/** Capabilities detected from the target's INFO server output. */
export interface ServerInfo {
  flavor: string;
  version: string | null;
  mode: string;
}

export interface ConnectionStatus {
  state: ConnectionState;
  message: string | null;
  server: ServerInfo | null;
  checkedAt: string | null;
}

/** Response of the /api/v1/connections endpoints. Carries no password by design. */
export interface ConnectionResponse {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string | null;
  hasPassword: boolean;
  tls: boolean;
  /**
   * The authority trusted for this target, as PEM, or null for the JVM's own store.
   *
   * <p>Returned, unlike the secrets near it, because a certificate authority's certificate is the
   * public half of the thing — showing it is how somebody checks the right one is configured.
   */
  tlsCaCert: string | null;
  tlsClientCert: string | null;
  /** Whether a client key is stored. The value never leaves the server. */
  hasClientKey: boolean;
  /** Whether that key is opened with a stored passphrase. The value never leaves the server. */
  hasClientKeyPassphrase: boolean;
  /**
   * Whether an operation that could empty this target has to name it first.
   *
   * <p>What the browser does with it is collect the name; the refusal is the server's, which is the
   * only place a confirmation can actually be enforced.
   */
  guarded: boolean;
  /**
   * Whether an operation that could empty this target waits for a second person.
   *
   * <p>Beside `guarded` rather than inside it. Naming a target answers which server this is;
   * this answers whether it should happen at all, and one does not settle the other.
   */
  requiresApproval: boolean;
  /**
   * Commands the console may run here that it refuses elsewhere.
   *
   * <p>Empty when this target refuses whatever the instance refuses, which is what a profile that
   * says nothing means.
   */
  consoleAllowed: string[];
  database: number;
  engine: EngineType;
  flavor: ServerFlavor;
  type: ConnectionType;
  sentinelMasterName: string | null;
  /**
   * Which Aerospike namespace this reads, and null for a RESP target.
   *
   * <p>What `database` is to a RESP store — except that an Aerospike namespace is named rather
   * than numbered, which is why it is beside that field instead of inside it.
   */
  namespace: string | null;
  notes: string | null;
  /**
   * The jump host this target is reached through, if any.
   *
   * <p>An id and not a name: whatever draws this already has the list of tunnels, because it
   * needs one to offer the choice.
   */
  tunnelId: number | null;
  status: ConnectionStatus;
}

/** Request body for create and update. A null password keeps the stored one. */
export interface ConnectionRequest {
  name: string;
  host: string;
  port: number;
  username: string | null;
  password: string | null;
  tls: boolean;
  /**
   * The certificates for this target, as PEM.
   *
   * <p>Null leaves what is stored alone; an empty string clears it. The key is write-only and
   * never comes back, which is why an edit form carries null for it and not the stored value.
   */
  tlsCaCert: string | null;
  tlsClientCert: string | null;
  tlsClientKey: string | null;
  tlsClientKeyPassphrase: string | null;
  guarded: boolean;
  requiresApproval: boolean;
  /** Null leaves the stored list alone; an empty array clears it. */
  consoleAllowed: string[] | null;
  database: number;
  engine: EngineType | null;
  flavor: ServerFlavor | null;
  type: ConnectionType;
  sentinelMasterName: string | null;
  /**
   * Which Aerospike namespace this reads, and null for a RESP target.
   *
   * <p>What `database` is to a RESP store — except that an Aerospike namespace is named rather
   * than numbered, which is why it is beside that field instead of inside it.
   */
  namespace: string | null;
  notes: string | null;
  tunnelId: number | null;
}

/** Categories broadcast by the backend notification hub. */
export const NotificationCategory = {
  ConnectionCreated: 'ConnectionCreated',
  ConnectionUpdated: 'ConnectionUpdated',
  ConnectionDeleted: 'ConnectionDeleted',
  ConnectionStatusChanged: 'ConnectionStatusChanged',
  KeysChanged: 'KeysChanged',
  ValueChanged: 'ValueChanged',
  ChannelMessage: 'ChannelMessage',
  SubscriptionChanged: 'SubscriptionChanged',
  MetricsSample: 'MetricsSample',
  MonitoringChanged: 'MonitoringChanged',
  MigrationProgress: 'MigrationProgress',
  /** Only the failures: a schedule that works is not news. */
  ScheduleFailed: 'ScheduleFailed',
  /** A scheduled job finished, whatever it did — for a table drawing a "last run" column. */
  ScheduleRan: 'ScheduleRan',
  /** A rule started firing, or stopped. Both, because the second one is the reassuring one. */
  AlertChanged: 'AlertChanged',
  /**
   * This session has been ended.
   *
   * <p>Sent only on the sockets of the session it names, so receiving it is the whole message —
   * there is nothing to compare it against, which is what lets the session cookie stay HttpOnly.
   */
  SessionEnded: 'SessionEnded',
  /**
   * A sign-in that worked but did not look like the ones before it.
   *
   * <p>Not a refusal — the password was right, which is exactly what a stolen password also is.
   * It names an account other than the reader's, so only somebody who may read the audit log is
   * shown it.
   */
  SignInFlagged: 'SignInFlagged',
  /** How far a purge has got, so a dialog waiting on one can say. */
  PurgeProgress: 'PurgeProgress',
  /** Somebody has asked for an operation that needs a second person. */
  ApprovalRequested: 'ApprovalRequested',
  /** A request was answered, withdrawn, expired, or finished running. */
  ApprovalChanged: 'ApprovalChanged',
} as const;

export type NotificationCategory = (typeof NotificationCategory)[keyof typeof NotificationCategory];
