import type { ApiService } from '@app/Shared/Services/Api.service';
import type { GraphQLService } from '@app/Shared/Services/GraphQL.service';
import type {
  ExportRequest,
  ExportedKey,
  ImportResult,
  KeyOperationResult,
  MigrateRequest,
  MigrationJob,
  KeyspaceWatchState,
  NamespaceNode,
} from './types';
import type { DatabaseSummary } from './types';

export interface ScanParams {
  match?: string;
  type?: string;
  count?: number;
  /** Which database to walk; absent means the one the profile opens in. */
  database?: number;
}

/**
 * Appends the database to a path when one was chosen.
 *
 * <p>Absent rather than zero when nothing was chosen: zero is a database, and sending it would
 * override a profile that opens somewhere else.
 */
const withDb = (path: string, database?: number): string =>
  database === undefined ? path : `${path}${path.includes('?') ? '&' : '?'}db=${database}`;

/**
 * Endpoint bindings for the key browser.
 *
 * <p>Listing is a stream rather than a call: the backend walks the keyspace with SCAN and emits
 * each key as it goes, so a target holding millions of keys shows its first results immediately
 * instead of after a complete walk. The URL is built here; consuming the stream is
 * {@link useKeyStream}'s job.
 */
export const keysApi = {
  streamUrl: (connectionId: number, params: ScanParams): string => {
    const query = new URLSearchParams();
    if (params.match) {
      query.set('match', params.match);
    }
    if (params.type) {
      query.set('type', params.type);
    }
    if (params.count) {
      query.set('count', String(params.count));
    }
    if (params.database !== undefined) {
      query.set('db', String(params.database));
    }
    const suffix = query.toString();
    return `/api/v1/connections/${connectionId}/keys${suffix ? `?${suffix}` : ''}`;
  },

  tree: (graphql: GraphQLService, connectionId: number, prefix: string, database?: number) =>
    graphql
      .query<{ namespaceTree: NamespaceNode[] }>(documents.tree, {
        connectionId,
        database: database ?? null,
        prefix,
      })
      .then((a) => a.namespaceTree),

  /**
   * Whether this target announces its changes, without asking it to start.
   *
   * <p>Read separately from taking a lease so a page can say what is true before anybody is
   * watching — a target whose notifications are off should say so on arrival, not after a
   * subscription has been opened that nothing will arrive on.
   */
  keyspaceWatch: (graphql: GraphQLService, connectionId: number, database?: number) =>
    graphql
      .query<{ keyspaceWatch: KeyspaceWatchState }>(documents.keyspaceWatch, {
        connectionId,
        database: database ?? 0,
      })
      .then((a) => a.keyspaceWatch),

  /** Takes a lease, or renews the one given. The same sentence either way: still looking. */
  holdKeyspaceWatch: (
    graphql: GraphQLService,
    connectionId: number,
    database?: number,
    lease?: string | null,
    /** Keys this lease is looking at, which the sample in a batch is not allowed to answer for. */
    keys?: readonly string[],
  ) =>
    graphql
      .query<{ holdKeyspaceWatch: KeyspaceWatchState }>(documents.holdKeyspaceWatch, {
        connectionId,
        database: database ?? 0,
        lease: lease ?? null,
        keys: keys && keys.length > 0 ? [...keys] : null,
      })
      .then((a) => a.holdKeyspaceWatch),

  /** Gives a lease back. The watch closes when it was the last one on that target. */
  releaseKeyspaceWatch: (
    graphql: GraphQLService,
    connectionId: number,
    database: number | undefined,
    lease: string,
  ) =>
    graphql
      .query<{ releaseKeyspaceWatch: boolean }>(documents.releaseKeyspaceWatch, {
        connectionId,
        database: database ?? 0,
        lease,
      })
      .then((a) => a.releaseKeyspaceWatch),

  /** Asks the target to start announcing. Changes a running server, and is gated accordingly. */
  announceKeyspaceChanges: (graphql: GraphQLService, connectionId: number, database?: number) =>
    graphql
      .query<{ announceKeyspaceChanges: KeyspaceWatchState }>(documents.announceKeyspaceChanges, {
        connectionId,
        database: database ?? 0,
      })
      .then((a) => a.announceKeyspaceChanges),

  /**
   * Exports keys as the store serialises them.
   *
   * <p>The one thing here still on the first surface, and deliberately: the server declares it as
   * a stream, walking the keyspace and emitting each key as it goes. Asking for it as one answer
   * would buffer a million keys to hand back a million keys.
   *
   * <p>Either an explicit list or a glob; the backend walks the keyspace for the second so the
   * browser never has to name a million keys to ask for them.
   */
  export: (api: ApiService, connectionId: number, request: ExportRequest, database?: number) =>
    api.doPost<ExportedKey[]>(
      withDb(`/connections/${connectionId}/keys/export`, database),
      request,
    ),

  import: (
    graphql: GraphQLService,
    connectionId: number,
    keys: ExportedKey[],
    replace: boolean,
    database?: number,
    confirmTarget?: string,
  ) =>
    graphql
      .query<{ importKeys: ImportResult }>(documents.import, {
        connectionId,
        keys: { keys, replace, database: database ?? null, confirmTarget: confirmTarget ?? null },
      })
      .then((a) => a.importKeys),

  /** Starts a migration and answers the job, before any keys have moved. */
  migrate: (graphql: GraphQLService, connectionId: number, request: MigrateRequest) =>
    graphql
      .query<{ startMigration: MigrationJob }>(documents.migrate, {
        connectionId,
        migration: request,
      })
      .then((a) => a.startMigration),

  cancelMigration: (graphql: GraphQLService, connectionId: number, jobId: string) =>
    graphql
      .query<{ cancelMigration: boolean }>(documents.cancelMigration, { connectionId, jobId })
      .then((a) => a.cancelMigration),

  remove: (
    graphql: GraphQLService,
    connectionId: number,
    keys: string[],
    database?: number,
    confirmTarget?: string,
  ) =>
    graphql
      .query<{ deleteKeys: KeyOperationResult }>(documents.remove, {
        connectionId,
        database: database ?? null,
        keys,
        // Null rather than absent when nothing was typed, so the server sees "they said nothing"
        // rather than a field the client forgot.
        confirmTarget: confirmTarget ?? null,
      })
      .then((a) => a.deleteKeys),

  /**
   * Deletes everything a glob matches.
   *
   * <p>A pattern rather than a list, because clearing a namespace of five thousand keys should not
   * mean sending five thousand names back to the server that already knows them.
   */
  purge: (
    graphql: GraphQLService,
    connectionId: number,
    match: string,
    database?: number,
    confirmTarget?: string,
  ) =>
    graphql
      .query<{ purgeKeys: KeyOperationResult }>(documents.purge, {
        connectionId,
        database: database ?? null,
        purge: { match, confirmTarget: confirmTarget ?? null },
      })
      .then((a) => a.purgeKeys),

  rename: (
    graphql: GraphQLService,
    connectionId: number,
    from: string,
    to: string,
    replace: boolean,
    database?: number,
  ) =>
    graphql
      .query<{ renameKey: KeyOperationResult }>(documents.rename, {
        connectionId,
        database: database ?? null,
        rename: { from, to, replace },
      })
      .then((a) => a.renameKey),

  copy: (
    graphql: GraphQLService,
    connectionId: number,
    from: string,
    to: string,
    replace: boolean,
    database?: number,
  ) =>
    graphql
      .query<{ copyKey: KeyOperationResult }>(documents.copy, {
        connectionId,
        database: database ?? null,
        copy: { from, to, replace },
      })
      .then((a) => a.copyKey),

  expire: (
    graphql: GraphQLService,
    connectionId: number,
    key: string,
    ttlSeconds: number | null,
    database?: number,
  ) =>
    graphql
      .query<{ expireKey: KeyOperationResult }>(documents.expire, {
        connectionId,
        database: database ?? null,
        expire: { key, ttlSeconds },
      })
      .then((a) => a.expireKey),

  /**
   * The databases this target holds, and how much is in each.
   *
   * <p>Every database the server is configured for, not only the ones holding something: a list
   * that hid the empty ones could not be used to move into one.
   */
  databases: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ databases: DatabaseSummary[] }>(documents.databases, { connectionId })
      .then((a) => a.databases),
};

/** What a key operation answers with, wherever it is asked. */
const RESULT_FIELDS = `
  affected
`;

/** What every keyspace-watch operation answers with, written once. */
const WATCH_FIELDS = `
  connectionId
  database
  supported
  announcing
  setting
  wouldBecome
  watching
  watchers
  leaseId
  leaseExpiresAt
`;

const documents = {
  keyspaceWatch: `
    query KeyspaceWatch($connectionId: BigInteger, $database: Int) {
      keyspaceWatch(connectionId: $connectionId, database: $database) {${WATCH_FIELDS}}
    }
  `,
  holdKeyspaceWatch: `
    mutation HoldKeyspaceWatch($connectionId: BigInteger, $database: Int, $lease: String, $keys: [String]) {
      holdKeyspaceWatch(connectionId: $connectionId, database: $database, lease: $lease, keys: $keys) {${WATCH_FIELDS}}
    }
  `,
  releaseKeyspaceWatch: `
    mutation ReleaseKeyspaceWatch($connectionId: BigInteger, $database: Int, $lease: String) {
      releaseKeyspaceWatch(connectionId: $connectionId, database: $database, lease: $lease)
    }
  `,
  announceKeyspaceChanges: `
    mutation AnnounceKeyspaceChanges($connectionId: BigInteger, $database: Int) {
      announceKeyspaceChanges(connectionId: $connectionId, database: $database) {${WATCH_FIELDS}}
    }
  `,
  tree: `
    query NamespaceTree($connectionId: BigInteger, $database: Int, $prefix: String) {
      namespaceTree(connectionId: $connectionId, database: $database, prefix: $prefix) {
        prefix
        name
        keyCount
        hasChildren
        partial
      }
    }
  `,
  import: `
    mutation ImportKeys($connectionId: BigInteger, $keys: ImportKeysRequestInput) {
      importKeys(connectionId: $connectionId, keys: $keys) {
        restored
        skipped
        failed
        reason
      }
    }
  `,
  migrate: `
    mutation StartMigration($connectionId: BigInteger, $migration: MigrateKeysRequestInput) {
      startMigration(connectionId: $connectionId, migration: $migration) {
        id
        state
        scanned
        migrated
        skipped
        dropped
        failed
        total
        startedAt
      }
    }
  `,
  cancelMigration: `
    mutation CancelMigration($connectionId: BigInteger, $jobId: String) {
      cancelMigration(connectionId: $connectionId, jobId: $jobId)
    }
  `,
  remove: `
    mutation DeleteKeys(
      $connectionId: BigInteger
      $database: Int
      $keys: [String]
      $confirmTarget: String
    ) {
      deleteKeys(
        connectionId: $connectionId
        database: $database
        keys: $keys
        confirmTarget: $confirmTarget
      ) {
        ${RESULT_FIELDS}
      }
    }
  `,
  purge: `
    mutation PurgeKeys($connectionId: BigInteger, $database: Int, $purge: PurgeKeysRequestInput) {
      purgeKeys(connectionId: $connectionId, database: $database, purge: $purge) {
        ${RESULT_FIELDS}
      }
    }
  `,
  rename: `
    mutation RenameKey($connectionId: BigInteger, $database: Int, $rename: RenameKeyRequestInput) {
      renameKey(connectionId: $connectionId, database: $database, rename: $rename) {
        ${RESULT_FIELDS}
      }
    }
  `,
  copy: `
    mutation CopyKey($connectionId: BigInteger, $database: Int, $copy: CopyKeyRequestInput) {
      copyKey(connectionId: $connectionId, database: $database, copy: $copy) {
        ${RESULT_FIELDS}
      }
    }
  `,
  expire: `
    mutation ExpireKey($connectionId: BigInteger, $database: Int, $expire: ExpireKeyRequestInput) {
      expireKey(connectionId: $connectionId, database: $database, expire: $expire) {
        ${RESULT_FIELDS}
      }
    }
  `,
  databases: `
    query Databases($connectionId: BigInteger) {
      databases(connectionId: $connectionId) {
        index
        keys
        expires
      }
    }
  `,
};
