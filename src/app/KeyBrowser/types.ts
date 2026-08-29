/** Wire types for the key browser, mirroring io.keydra.keys.dto. */

export interface KeyEntry {
  key: string;
  type: string;
  /** Seconds until expiry; -1 when the key has none, -2 when it no longer exists. */
  ttl: number;
}

export const NO_EXPIRY = -1;
export const MISSING = -2;

export interface NamespaceNode {
  name: string;
  /** Full prefix including the delimiter — send this back to expand the node. */
  prefix: string;
  keyCount: number;
  hasChildren: boolean;
  /**
   * Whether the walk behind `keyCount` stopped at its sample limit, which makes the count a floor.
   *
   * <p>Every level of the tree is its own walk, so two levels are two samples of two different
   * populations. Drawn as plain numbers, a parent counted out of the first ten thousand keys of the
   * whole keyspace sat above a child counted out of the first ten thousand under it — and the child
   * showed the larger number. Both were true of their own sample; the pair was nonsense.
   */
  partial: boolean;
}

export interface KeyOperationResult {
  affected: number;
}

/** Value types a key can hold, used for the type filter. */
export const KEY_TYPES = ['string', 'list', 'set', 'zset', 'hash', 'stream'] as const;

export type KeyType = (typeof KEY_TYPES)[number];

/**
 * One key in an export file, mirroring io.keydra.keys.dto.ExportedKey.
 *
 * <p>The payload is the store's own serialisation, base64 on the wire. Nothing in the browser reads
 * it: it goes to a file and comes back unchanged.
 */
export interface ExportedKey {
  key: string;
  ttlMillis: number;
  payload: string;
}

/** What to export: named keys, or everything a glob matches. */
export interface ExportRequest {
  keys?: string[];
  match?: string;
  limit?: number;
}

/** What an import did, mirroring io.keydra.keys.dto.ImportResult. */
export interface ImportResult {
  restored: number;
  skipped: number;
  failed: number;
  /** What the store said about the first refusal; null when nothing failed. */
  reason: string | null;
}

/** What a migration is doing, mirroring io.keydra.keys.dto.MigrationJob. */
export interface MigrationJob {
  id: string;
  sourceConnectionId: number;
  targetConnectionId: number;
  match: string | null;
  /**
   * How many keys are expected to move, or null when nothing can say.
   *
   * <p>Known when the keys were named and when a whole database is moving; a glob has no answer
   * until the walk has finished, because finding out how many keys match one *is* the walk.
   */
  total: number | null;
  /** Keys found so far. Not a total: the walk is still going while the job runs. */
  scanned: number;
  migrated: number;
  skipped: number;
  failed: number;
  /**
   * Keys a script decided not to move.
   *
   * <p>Its own count rather than folded into the skipped ones, which mean something else: a key
   * already on the target was left alone, where a key a script turned down was never offered to it.
   * Without it these would fall into the gap between scanned and handled, which the dialog explains
   * as keys that expired while the walk ran — an explanation that would then be wrong.
   */
  dropped: number;
  deleted: number;
  reason: string | null;
  /**
   * Where the job is.
   *
   * <p>`INTERRUPTED` is what a migration ends as when the instance walking it went away and no
   * other instance could carry it on — an old row that never recorded what it had been asked to do.
   * The keys already written stay written, and "interrupted" and "never happened" call for opposite
   * decisions from whoever is deciding whether to run it again.
   */
  state: 'RUNNING' | 'DONE' | 'CANCELLED' | 'FAILED' | 'INTERRUPTED';
  startedAt: string;
  finishedAt: string | null;
  /** Who asked for it, as a name. Null on an instance with nobody signed in. */
  startedBy: string | null;
  /**
   * How many times another instance has picked this up after the one running it went away.
   *
   * <p>Nought for almost every job, and the sentence that explains a progress bar somebody watched
   * go back to the beginning: a resumed migration walks the keyspace again, so its counters are
   * this attempt's rather than the whole job's.
   */
  resumed: number;
}

/** What to move, where, and what to do about keys that are already there. */
export interface MigrateRequest {
  targetConnectionId: number;
  /** The keys that were ticked. When given, the pattern is not used. */
  keys?: string[];
  match?: string;
  /**
   * Only keys of this type, spelled as the store spells it.
   *
   * <p>Narrowed at the walk rather than after it, so keys of other types are never read. It earns
   * its place because a target need not support every type the source has — Garnet has no streams
   * at all, and "everything except the streams" is the difference between a migration that works
   * and one that reports failures nobody can act on.
   */
  type?: string;
  /** A prefix taken off each name before it is written on the other side. */
  stripPrefix?: string;
  /** A prefix put on each name before it is written. With `stripPrefix`, a rename. */
  addPrefix?: string;
  /**
   * A ceiling on how fast to move, or absent for as fast as the link allows.
   *
   * <p>A migration is usually run against a server somebody else is using, and the tool that fills
   * the link is also the tool that makes their application slow.
   */
  maxKeysPerSecond?: number;
  replace: boolean;
  deleteFromSource: boolean;
  /** The destination's name, where the destination asks to be named. */
  confirmTarget?: string;
  /** The source's name, where a move would empty it and it asks to be named. */
  confirmSource?: string;
}

/**
 * One database inside a target. Mirrors io.keydra.engine.Database.
 *
 * <p>The count is what makes the list worth showing: sixteen identical numbers say nothing about
 * where somebody's data actually is.
 */
export interface DatabaseSummary {
  index: number;
  keys: number;
  expires: number;
}

/**
 * Whether a target's changes are being heard, and whether it is saying them.
 *
 * <p>Two facts that look like one. A watch can be open on a server whose notifications are off, in
 * which case nothing will ever arrive on it — and a page saying "watching" while that is true is
 * the quiet lie this whole feature exists to end.
 */
export interface KeyspaceWatchState {
  connectionId: number;
  database: number;
  /** Whether this store announces its changes at all. False for one that changes silently. */
  supported: boolean;
  /** Whether the server is currently set to send them. */
  announcing: boolean;
  /** What the server's setting says now. */
  setting: string;
  /** What it would be set to if the offer were accepted — a union, never a replacement. */
  wouldBecome: string;
  /** Whether Keydra is listening right now. */
  watching: boolean;
  /** How many leases are holding the watch open on the instance that answered. */
  watchers: number;
  /** This caller's lease, to renew or give back. Null when none was taken. */
  leaseId: string | null;
  /** When the lease lapses if nobody renews it. */
  leaseExpiresAt: string | null;
}
