import { http, HttpResponse } from 'msw';
import type {
  AboutResponse,
  ConnectionRequest,
  ConnectionResponse,
} from '@app/Shared/Services/api.types';
import {
  ConnectionState,
  ConnectionType,
  EngineType,
  ServerFlavor,
} from '@app/Shared/Services/api.types';

/** Fixture matching the backend's AboutResponse record. */
export const aboutFixture: AboutResponse = {
  name: 'Keydra',
  version: '0.0.1-SNAPSHOT',
  build: {
    timestamp: '2026-01-01T00:00:00Z',
    commit: 'mockcommit',
    javaVersion: '21',
    quarkusVersion: '3.33.3.1',
  },
  instance: {
    id: 'keydra-mock',
    leader: true,
    chores: 'keydra-mock',
  },
  observability: {
    metricsPath: '/q/metrics',
    traces: false,
    tracesTo: null,
    structuredLogs: false,
  },
};

/** Two profiles matching the local podman targets, one up and one down. */
/**
 * The one running Keydra the mock stands for, holding a little of everything.
 *
 * <p>Shared by the health answer and the roster so the two cannot drift: a page saying an instance
 * watches two targets and a target page saying nobody holds it would be a mock teaching a bug.
 */
export const instanceFixture = {
  id: 'keydra-mock',
  version: '0.0.1-SNAPSHOT',
  commit: 'abc1234',
  startedAt: '2026-08-24T00:00:00Z',
  lastSeenAt: '2026-08-24T00:05:00Z',
  leader: true,
  self: true,
  published: 0,
  received: 0,
  commands: 0,
  sockets: 3,
  streams: 1,
  jobs: 0,
  watching: [1, 2],
  draining: false,
  present: true,
};

/**
 * One that stopped without shutting down.
 *
 * <p>Here because the roster is the only record of it: an instance that stops cleanly takes its
 * own row with it, so anything still listed and not answering is the case worth drawing.
 */
export const stoppedInstanceFixture = {
  ...instanceFixture,
  id: 'keydra-gone',
  leader: false,
  self: false,
  sockets: 0,
  streams: 0,
  jobs: 0,
  watching: [],
  present: false,
};

/** The fixtures reach their targets directly; a tunnel is the exception, not the shape. */
const NO_TUNNEL = {
  tunnelId: null,
} as const;

export const connectionFixtures: ConnectionResponse[] = [
  {
    id: 1,
    name: 'local-redis',
    host: 'localhost',
    port: 6379,
    username: null,
    hasPassword: false,
    tlsCaCert: null,
    tlsClientCert: null,
    hasClientKey: false,
    hasClientKeyPassphrase: false,
    consoleAllowed: [],
    guarded: false,
    requiresApproval: false,
    tls: false,
    database: 0,
    engine: EngineType.Resp,
    flavor: ServerFlavor.Unknown,
    type: ConnectionType.Standalone,
    sentinelMasterName: null,
    namespace: null,
    notes: null,
    ...NO_TUNNEL,
    status: {
      state: ConnectionState.Up,
      message: null,
      server: { flavor: 'redis', version: '8.10.0', mode: 'standalone' },
      checkedAt: '2026-01-01T00:00:00Z',
    },
  },
  {
    id: 2,
    name: 'local-valkey',
    host: 'localhost',
    port: 6380,
    username: null,
    hasPassword: true,
    tlsCaCert: null,
    tlsClientCert: null,
    hasClientKey: false,
    hasClientKeyPassphrase: false,
    consoleAllowed: [],
    guarded: false,
    requiresApproval: false,
    tls: false,
    database: 0,
    engine: EngineType.Resp,
    flavor: ServerFlavor.Unknown,
    type: ConnectionType.Standalone,
    sentinelMasterName: null,
    namespace: null,
    notes: 'password protected',
    ...NO_TUNNEL,
    status: {
      state: ConnectionState.Down,
      message: 'Connection refused: localhost/127.0.0.1:6380',
      server: null,
      checkedAt: '2026-01-01T00:00:00Z',
    },
  },
];

/** In-memory store so the mocked UI behaves like a real CRUD backend. */
let connections: ConnectionResponse[] = [...connectionFixtures];
let nextId = 3;

export const resetMockConnections = (): void => {
  connections = [...connectionFixtures];
  nextId = 3;
};

const toResponse = (
  id: number,
  body: ConnectionRequest,
  hasPassword: boolean,
): ConnectionResponse => ({
  id,
  name: body.name,
  host: body.host,
  port: body.port,
  username: body.username,
  hasPassword,
  tls: body.tls,
  tlsCaCert: body.tlsCaCert ?? null,
  tlsClientCert: body.tlsClientCert ?? null,
  hasClientKey: Boolean(body.tlsClientKey),
  hasClientKeyPassphrase: Boolean(body.tlsClientKeyPassphrase),
  consoleAllowed: body.consoleAllowed ?? [],
  guarded: Boolean(body.guarded),
  requiresApproval: Boolean(body.requiresApproval),
  database: body.database,
  engine: body.engine ?? EngineType.Resp,
  flavor: body.flavor ?? ServerFlavor.Unknown,
  type: body.type,
  sentinelMasterName: body.sentinelMasterName,
  namespace: body.namespace ?? null,
  notes: body.notes,
  tunnelId: body.tunnelId ?? null,
  status: { state: ConnectionState.Unknown, message: null, server: null, checkedAt: null },
});

/** Keys for the browser tests, shaped like a real namespaced keyspace. */
export const keyFixtures = [
  { key: 'user:1:profile', type: 'hash', ttl: -1 },
  { key: 'user:2:profile', type: 'hash', ttl: -1 },
  { key: 'session:abc', type: 'string', ttl: 30 },
  { key: 'cache:page:home', type: 'string', ttl: 3600 },
  // One of every remaining shape, so the editor for each is reachable from a browser
  // opened against the mocks — and so a test can drive it the way somebody would.
  { key: 'queue:jobs', type: 'list', ttl: -1 },
  { key: 'tags:post:1', type: 'set', ttl: -1 },
  { key: 'leaderboard:global', type: 'zset', ttl: -1 },
  { key: 'events:signup', type: 'stream', ttl: -1 },
];

let keys = [...keyFixtures];

/** Whether the mock server is sampling, mirroring the real opt-in. */
let monitoring = false;

/** A short run of readings, enough for a chart to have a shape. */
const mockSamples = () =>
  Array.from({ length: 12 }, (_unused, index) => ({
    at: new Date(index * 5000).toISOString(),
    memoryUsedBytes: 1_000_000 + index * 25_000,
    memoryPeakBytes: 2_000_000,
    memoryMaxBytes: null,
    connectedClients: 3,
    opsPerSecond: 100 + index * 5,
    totalCommands: 10_000 + index * 500,
    keyspaceHits: 900 + index * 10,
    keyspaceMisses: 100,
    keyCount: 4,
    uptimeSeconds: 3600 + index * 5,
    evictedKeys: 0,
    expiredKeys: 2,
  }));

/** The one subscription the mock server holds, mirroring the real one-per-target rule. */
let subscription: {
  connectionId: number;
  channels: string[];
  patterns: string[];
  since: string;
  messagesReceived: number;
} | null = null;

export const resetMockKeys = (): void => {
  keys = [...keyFixtures];
  subscription = null;
  monitoring = false;
};

/**
 * The keys the mock server currently holds.
 *
 * <p>The streaming scan cannot go through MSW — it cannot hold a response open — so the test
 * double replays this instead. Reading the live list rather than the fixtures is what lets a test
 * see the result of a delete, rename or copy it just performed.
 */
export const currentMockKeys = (): typeof keyFixtures => keys;

/** Applies the same glob semantics the server would, so filter tests are meaningful. */
const matches = (key: string, glob: string | null): boolean => {
  if (!glob) {
    return true;
  }
  const pattern = new RegExp(
    `^${glob
      .split('*')
      .map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('.*')}$`,
  );
  return pattern.test(key);
};

/** One migration, answered by both surfaces so a test can move between them. */
const migrationFixture = {
  id: 'job-1',
  sourceConnectionId: 1,
  targetConnectionId: 2,
  match: 'session:*',
  total: null,
  scanned: 120,
  migrated: 90,
  skipped: 4,
  dropped: 0,
  failed: 0,
  deleted: 0,
  reason: null,
  state: 'RUNNING',
  startedAt: '2026-08-21T09:00:00Z',
  finishedAt: null,
  startedBy: 'admin',
  resumed: 0,
};

const keyspaceReportFixture = {
  sampled: 8,
  keysInDatabase: 8,
  bytesSampled: 4_200,
  namespaces: [
    { prefix: 'user', keys: 2, bytes: 2_000, neverExpires: 2 },
    { prefix: 'cache', keys: 1, bytes: 1_200, neverExpires: 0 },
    { prefix: 'session', keys: 1, bytes: 500, neverExpires: 0 },
    { prefix: 'queue', keys: 1, bytes: 500, neverExpires: 1 },
  ],
  types: [
    { type: 'hash', keys: 2, bytes: 2_000 },
    { type: 'string', keys: 2, bytes: 1_700 },
    { type: 'list', keys: 1, bytes: 500 },
  ],
  expiry: [
    { band: 'never', keys: 6, bytes: 3_000 },
    { band: 'hour', keys: 1, bytes: 500 },
    { band: 'day', keys: 1, bytes: 700 },
    { band: 'week', keys: 0, bytes: 0 },
    { band: 'longer', keys: 0, bytes: 0 },
  ],
  largest: [
    { key: 'user:1:profile', type: 'hash', bytes: 1_200, elements: 4, ttlMillis: -1 },
    {
      key: 'cache:page:home',
      type: 'string',
      bytes: 1_200,
      elements: null,
      ttlMillis: 3_600_000,
    },
  ],
};

/**
 * What the instance asks of whoever signs in.
 *
 * <p>Nothing required, with two accounts that have not enrolled — which is the state the sign-in
 * tab has something to say about, and the one a test flipping the switch starts from.
 */
export const signInPolicyFixture = {
  secondFactorRequired: false,
  changedAt: null,
  changedBy: null,
  accountsOwingAFactor: 2,
};

export const sessionFixtures = [
  {
    id: 'session-here',
    current: true,
    issuedAt: '2026-08-22T08:00:00Z',
    lastSeenAt: '2026-08-22T09:30:00Z',
    expiresAt: '2026-08-22T16:00:00Z',
    userAgent:
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
    network: '10.0.4.0',
  },
  {
    id: 'session-elsewhere',
    current: false,
    issuedAt: '2026-08-21T19:00:00Z',
    lastSeenAt: '2026-08-21T21:15:00Z',
    expiresAt: '2026-08-22T03:00:00Z',
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    network: '203.0.113.0',
  },
];

const providerFixtures = [
  {
    id: 1,
    key: 'keycloak',
    displayName: 'Company Keycloak',
    kind: 'OIDC',
    enabled: true,
    sortOrder: 0,
    issuer: 'https://sso.example/realms/company',
    clientId: 'keydra',
    hasClientSecret: true,
    scopes: 'openid profile email',
    authorizationEndpoint: 'https://sso.example/realms/company/protocol/openid-connect/auth',
    tokenEndpoint: 'https://sso.example/realms/company/protocol/openid-connect/token',
    userInfoEndpoint: 'https://sso.example/realms/company/protocol/openid-connect/userinfo',
    endpointsDiscovered: true,
    subjectClaim: 'sub',
    usernameClaim: 'preferred_username',
    emailClaim: 'email',
    nameClaim: 'name',
    groupsClaim: 'groups',
    autoCreateUsers: true,
    redirectUri: 'http://localhost:9000/api/v1/auth/providers/keycloak/callback',
    groupMappings: [{ id: 1, claimValue: 'platform-team', groupId: 1, groupName: 'platform' }],
  },
];

const alertEventFixtures = [
  {
    id: 5,
    ruleId: 1,
    ruleName: 'Memory filling up',
    connectionId: 1,
    connectionName: 'Local Redis',
    kind: 'FIRED',
    metric: 'MEMORY_FILL_PERCENT',
    reading: 91.5,
    // What it was measured against rather than the setting: this rule is written as a share of
    // last week, and 87.5 is what 140% of that week came to.
    threshold: 87.5,
    at: new Date(120_000).toISOString(),
    deliveryName: 'On-call channel',
    deliveryOutcome: 'SENT',
    deliveryDetail: 'HTTP 200',
  },
];

const alertMetricFixtures = [
  { name: 'MEMORY_FILL_PERCENT', unit: 'PERCENT', condition: false },
  { name: 'MEMORY_USED_BYTES', unit: 'BYTES', condition: false },
  { name: 'NO_ANSWER', unit: 'CONDITION', condition: true },
];

const alertDeliveryFixtures = [
  {
    id: 1,
    name: 'On-call channel',
    kind: 'WEBHOOK',
    enabled: true,
    urlHost: 'hooks.slack.com',
    hasUrl: true,
    headerName: null,
    hasSecret: false,
    smtpHost: null,
    smtpPort: null,
    smtpTls: true,
    username: null,
    hasPassword: false,
    fromAddress: null,
    toAddresses: null,
    hasApiToken: false,
    recipient: null,
    senderId: null,
    describedAs: 'hooks.slack.com',
    usedByRules: 1,
  },
  {
    id: 2,
    name: 'Ops chat',
    kind: 'TELEGRAM',
    enabled: true,
    urlHost: null,
    hasUrl: false,
    headerName: null,
    hasSecret: false,
    smtpHost: null,
    smtpPort: null,
    smtpTls: true,
    username: null,
    hasPassword: false,
    fromAddress: null,
    toAddresses: null,
    hasApiToken: true,
    recipient: '-1001234567890',
    senderId: null,
    describedAs: 'chat -1001234567890',
    usedByRules: 0,
  },
];

const alertRuleFixtures = [
  {
    id: 1,
    name: 'Memory filling up',
    connectionId: 1,
    connectionName: 'Local Redis',
    metric: 'MEMORY_FILL_PERCENT',
    unit: 'PERCENT',
    comparison: 'ABOVE',
    basis: 'BASELINE',
    threshold: 140,
    baselineWindowSeconds: 3600,
    baselineOffsetSeconds: 604800,
    baseline: 62.5,
    forSeconds: 300,
    enabled: true,
    deliveryIds: [1],
    deliveryNames: ['On-call channel'],
    createdBy: 'ada',
    createdAt: new Date(0).toISOString(),
    state: 'FIRING',
    since: new Date(60_000).toISOString(),
    reading: 91.5,
    readAt: new Date(120_000).toISOString(),
    watching: true,
  },
  {
    id: 2,
    name: 'Unreachable',
    connectionId: 2,
    connectionName: 'Local Valkey',
    metric: 'NO_ANSWER',
    unit: 'CONDITION',
    comparison: 'ABOVE',
    basis: 'ABSOLUTE',
    threshold: 0,
    baselineWindowSeconds: 3600,
    baselineOffsetSeconds: 0,
    baseline: null,
    forSeconds: 60,
    enabled: true,
    deliveryIds: [],
    deliveryNames: [],
    createdBy: 'ada',
    createdAt: new Date(0).toISOString(),
    state: 'OK',
    since: new Date(60_000).toISOString(),
    reading: 0,
    readAt: new Date(120_000).toISOString(),
    watching: true,
  },
];

const aclUserFixtures = [
  {
    username: 'default',
    enabled: true,
    rules: ['on', 'nopass', '~*', '&*', '+@all'],
    keyPatterns: ['~*'],
    channelPatterns: ['&*'],
    commands: '+@all',
    hasPassword: false,
  },
  {
    username: 'reader',
    enabled: true,
    rules: ['on', '#hash', '~cache:*', '+@read'],
    keyPatterns: ['~cache:*'],
    channelPatterns: [],
    commands: '+@read',
    hasPassword: true,
  },
];

/**
 * One target's topology.
 *
 * <p>Connection 2 stands in for a clustered target so the topology view has something to draw;
 * everything else is a single server, which is the ordinary case.
 */
const topologyFixture = (connectionId: number) =>
  connectionId === 2
    ? {
        server: { flavor: 'valkey', version: '9.1.1', mode: 'cluster' },
        capabilities: {
          features: [
            'copyKey',
            'renameKey',
            'expiry',
            'measureMemory',
            'slowLog',
            'clientList',
            'streams',
            'pubSub',
            'cluster',
            'metrics',
            'console',
            'commandStream',
            'accessControl',
            'transfer',
            'admin',
            'topology',
          ],
          detected: true,
        },
        nodes: [
          {
            id: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            address: '127.0.0.1:7001',
            role: 'primary',
            isSelf: true,
            primaryId: null,
            slots: [{ from: 0, to: 5460 }],
            linkState: 'connected',
            flags: ['myself', 'master'],
            migrations: [],
          },
          {
            id: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            address: '127.0.0.1:7002',
            role: 'primary',
            isSelf: false,
            primaryId: null,
            slots: [{ from: 5461, to: 16383 }],
            linkState: 'connected',
            flags: ['master'],
            migrations: [],
          },
          // One shard has a replica and the other does not, which is the difference the
          // graph exists to show.
          {
            id: 'cccccccccccccccccccccccccccccccccccccccc',
            address: '127.0.0.1:7101',
            role: 'replica',
            isSelf: false,
            primaryId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            slots: [],
            linkState: 'connected',
            flags: ['slave'],
            migrations: [],
          },
        ],
        health: {
          state: 'ok',
          serving: true,
          slotsAssigned: 16384,
          slotsOk: 16384,
          slotsPfail: 0,
          slotsFail: 0,
          knownNodes: 3,
          size: 2,
          currentEpoch: 6,
        },
        sentinelMasters: [],
      }
    : {
        server: { flavor: 'redis', version: '8.10.0', mode: 'standalone' },
        capabilities: {
          features: [
            'copyKey',
            'renameKey',
            'expiry',
            'measureMemory',
            'slowLog',
            'clientList',
            'streams',
            'pubSub',
            'metrics',
            'console',
            'commandStream',
            'accessControl',
            'transfer',
            'admin',
            'topology',
          ],
          detected: true,
        },
        nodes: [],
        sentinelMasters: [],
        // A standalone server is not a cluster and has no verdict on itself to give.
        health: null,
      };

const auditFixtures = [
  {
    id: 2,
    at: new Date(60_000).toISOString(),
    actor: 'ada',
    action: 'key.delete',
    connectionId: 1,
    detail: null,
    succeeded: true,
  },
  {
    id: 1,
    at: new Date(0).toISOString(),
    actor: 'oscar',
    action: 'value.mutate',
    connectionId: 1,
    detail: null,
    succeeded: false,
  },
];

const auditActionFixtures = ['connection.delete', 'key.delete', 'value.mutate'];

const slowCommandFixtures = [
  {
    id: 1,
    at: new Date(0).toISOString(),
    durationMicros: 250000,
    arguments: ['KEYS', '*'],
    client: '127.0.0.1:6379',
    clientName: null,
  },
];

const clientFixtures = [
  {
    id: '42',
    address: '127.0.0.1:52310',
    name: null,
    ageSeconds: 120,
    idleSeconds: 0,
    database: 0,
    lastCommand: 'info',
  },
];

const biggestKeysFixture = {
  sampled: 1000,
  totalBytes: 5_000_000,
  largest: [
    { key: 'cache:page:home', type: 'string', bytes: 2_000_000, elements: null },
    { key: 'user:1:profile', type: 'hash', bytes: 1_000, elements: 4 },
  ],
};

/**
 * One level of the namespace tree, grouped the way the server groups it.
 *
 * <p>`partial` is always false here: the mock holds a handful of keys and walks all of them, so
 * every count it reports is a total. On a real target it is usually true, and the tree draws the
 * count as a floor when it is — which is a thing worth knowing when reading these tests, because
 * they only ever exercise the other branch.
 */
const namespaceLevel = (prefix: string) => {
  const tallies = new Map<string, { count: number; hasChildren: boolean }>();
  for (const entry of keys) {
    if (!entry.key.startsWith(prefix)) {
      continue;
    }
    const cut = entry.key.indexOf(':', prefix.length);
    if (cut <= prefix.length) {
      continue;
    }
    const segment = entry.key.slice(prefix.length, cut);
    const tally = tallies.get(segment) ?? { count: 0, hasChildren: false };
    tally.count += 1;
    tally.hasChildren ||= entry.key.indexOf(':', cut + 1) > 0;
    tallies.set(segment, tally);
  }
  return [...tallies.entries()].map(([name, tally]) => ({
    name,
    prefix: `${prefix}${name}:`,
    keyCount: tally.count,
    hasChildren: tally.hasChildren,
    partial: false,
  }));
};

/**
 * The name of the operation a document declares.
 *
 * <p>Matched by name rather than by which field names happen to appear in the text, which is what
 * this used to do. Two operations that read the same thing share field names, so "does the document
 * mention migrations" answered for one query as readily as for another — and the wrong fixture came
 * back looking like a real answer rather than like a missing mock.
 */
const operationNameOf = (document: string): string =>
  /(?:query|mutation)\s+([A-Za-z][A-Za-z0-9_]*)/.exec(document)?.[1] ?? 'anonymous';

/** What a mocked operation answers, given whatever variables the page sent with it. */
export type MockOperation = (variables: Record<string, unknown>) => unknown;

/** The two names every page that offers a target to choose from asks for alongside its own data. */
const targetChoices = () => connections.map(({ id, name }) => ({ id, name }));

/**
 * The GraphQL surface.
 *
 * <p>One handler answering by operation name rather than a handler per query: what MSW is standing
 * in for is one endpoint, and a mock that pretended otherwise would be describing a server that
 * does not exist.
 *
 * <p>Whole fixtures rather than only the fields a query names. Field selection is the server's job,
 * and testing it here would be testing MSW; what these tests are about is the page asking the right
 * question and drawing what comes back.
 *
 * <p>The same fixtures the REST handlers serve, referenced rather than copied. These are two doors
 * into one house, and a mock where a target created through one door did not appear behind the
 * other would pass tests the application would fail.
 *
 * <p>An operation with no entry here answers with an error naming it, which is the one thing a
 * missing mock must not do quietly: a page whose query silently resolved to nothing looks like a
 * page with nothing to show.
 */
/** One target's watch state, which four operations answer with the same shape. */
const keyspaceWatch = (variables: Record<string, unknown>) => ({
  connectionId: Number(variables.connectionId ?? 1),
  database: Number(variables.database ?? 0),
  supported: true,
  announcing: true,
  setting: 'AE',
  wouldBecome: 'AE',
  watching: true,
  watchers: 1,
  leaseId: null,
  leaseExpiresAt: null,
});

const graphqlOperations: Record<string, MockOperation> = {
  // --- Connections ----------------------------------------------------------
  Connections: () => ({ connections }),

  CreateConnection: (variables) => {
    const body = variables.connection as ConnectionRequest;
    if (connections.some((profile) => profile.name === body.name)) {
      // The server refuses rather than making a second profile with the same name, and the form
      // has to show that rather than closing as though it had worked.
      throw new Error(`A connection profile named '${body.name}' already exists`);
    }
    const created = toResponse(nextId++, body, Boolean(body.password));
    connections = [...connections, created];
    return { createConnection: created };
  },

  UpdateConnection: (variables) => {
    const id = Number(variables.id);
    const body = variables.connection as ConnectionRequest;
    const existing = connections.find((profile) => profile.id === id);
    const hasPassword =
      body.password === null ? Boolean(existing?.hasPassword) : body.password !== '';
    const fresh = toResponse(id, body, hasPassword);
    // A profile keeps whatever its last probe said; one that somehow has no row to update keeps
    // the unknown status a new profile starts with, which is what "nobody has reached it" means.
    const updated = { ...fresh, status: existing?.status ?? fresh.status };
    connections = connections.map((profile) => (profile.id === id ? updated : profile));
    return { updateConnection: updated };
  },

  DeleteConnection: (variables) => {
    const id = Number(variables.id);
    connections = connections.filter((profile) => profile.id !== id);
    return { deleteConnection: true };
  },

  CheckConnection: (variables) => {
    const id = Number(variables.id);
    const status = {
      state: ConnectionState.Up,
      message: null,
      server: { flavor: 'redis', version: '8.10.0', mode: 'standalone' },
      checkedAt: new Date(0).toISOString(),
    };
    connections = connections.map((profile) =>
      profile.id === id ? { ...profile, status } : profile,
    );
    return { checkConnection: status };
  },

  // --- One target's own pages -----------------------------------------------
  Topology: (variables) => ({ topology: topologyFixture(Number(variables.connectionId)) }),
  /*
   * Everything, which is what a target that could not be asked is assumed to have. A mock that
   * withheld capabilities would hide tabs from every test that opens a target, which is a lot of
   * tests failing for a reason none of them is about.
   */
  Capabilities: (variables) => ({
    capabilities: topologyFixture(Number(variables.connectionId)).capabilities,
  }),
  AclUsers: () => ({ aclUsers: aclUserFixtures }),
  KeyspaceReport: () => ({ keyspaceReport: keyspaceReportFixture }),

  // --- Whole-instance pages -------------------------------------------------
  MySessions: () => ({ mySessions: sessionFixtures, mySessionCount: sessionFixtures.length }),
  IdentityProviders: () => ({ identityProviders: providerFixtures }),

  AlertsPage: () => ({
    alertRules: alertRuleFixtures,
    alertMetrics: alertMetricFixtures,
    alertDeliveries: alertDeliveryFixtures,
    connections: targetChoices(),
  }),

  /*
   * A page of jobs, in the shape a cursor-paged field answers: a count, the rows, and where the
   * page ends. Each row names the targets it is between rather than carrying their ids — a job is
   * between two servers, and neither of them is a number to the person reading the table.
   */
  MigrationsPage: () => ({
    migrations: {
      totalCount: 1,
      running: migrationFixture.state === 'RUNNING' ? 1 : 0,
      nodes: [
        {
          ...migrationFixture,
          source: { id: 1, name: 'local-redis' },
          target: { id: 2, name: 'local-valkey' },
        },
      ],
      pageInfo: { endCursor: null, hasNextPage: false, hasPreviousPage: false },
    },
  }),

  // --- Who is asking ---------------------------------------------------------
  /*
   * A development instance, which is the case where nothing is enforced. The UI has to say so
   * rather than look secured — an application that draws a locked door where there is none teaches
   * people to distrust the lock everywhere else.
   */
  AuthState: () => ({
    authState: {
      securityEnabled: false,
      needsSetup: false,
      authenticated: true,
      username: 'anonymous',
      mustEnrolSecondFactor: false,
    },
  }),
  SignInPolicy: () => ({ signInPolicy: signInPolicyFixture }),
  RequireSecondFactor: (variables) => ({
    requireSecondFactor: {
      ...signInPolicyFixture,
      secondFactorRequired: Boolean(variables.required),
    },
  }),
  SignInOptions: () => ({ signInOptions: [] }),
  Me: () => ({
    me: { name: 'anonymous', roles: ['viewer', 'operator', 'admin'], securityEnabled: false },
    effectivePermissions: {
      username: 'anonymous',
      securityEnabled: false,
      instance: [],
      targets: [],
    },
  }),

  // --- The key browser -------------------------------------------------------
  NamespaceTree: (variables) => ({
    namespaceTree: namespaceLevel(String(variables.prefix ?? '')),
  }),
  /*
   * What the console refuses, and what a target could be allowed. Two lists rather than one
   * because they answer different questions: the first is about this target and the second is a
   * constant of the build, which is why only the first takes a connection.
   */
  DeniedCommands: () => ({
    deniedCommands: ['flushall', 'flushdb', 'keys', 'monitor', 'shutdown', 'subscribe'],
  }),
  AskableCommands: () => ({
    askableCommands: [
      { command: 'flushall', reason: 'blocks-the-server' },
      { command: 'flushdb', reason: 'blocks-the-server' },
      { command: 'keys', reason: 'blocks-the-server' },
      { command: 'shutdown', reason: 'changes-the-server' },
      { command: 'acl', reason: 'creates-an-identity' },
      { command: 'eval', reason: 'runs-code' },
      { command: 'config', reason: 'writes-a-file' },
    ],
  }),

  /*
   * The keyspace watch, announcing by default. A mock target that says its changes are silent
   * would put a bar across the top of the key browser in every screenshot and every story, for a
   * state the mock cannot get out of — there is no server behind it to change a setting on.
   */
  KeyspaceWatch: (variables) => ({ keyspaceWatch: keyspaceWatch(variables) }),
  HoldKeyspaceWatch: (variables) => ({
    holdKeyspaceWatch: { ...keyspaceWatch(variables), leaseId: 'mock-lease' },
  }),
  ReleaseKeyspaceWatch: () => ({ releaseKeyspaceWatch: true }),
  AnnounceKeyspaceChanges: (variables) => ({
    announceKeyspaceChanges: { ...keyspaceWatch(variables), announcing: true, setting: 'AE' },
  }),
  Databases: () => ({
    databases: Array.from({ length: 16 }, (_unused, index) => ({
      index,
      keys: index === 0 ? keys.length : index === 3 ? 3 : 0,
      expires: 0,
    })),
  }),
  DeleteKeys: (variables) => {
    const wanted = (variables.keys ?? []) as string[];
    const before = keys.length;
    keys = keys.filter((entry) => !wanted.includes(entry.key));
    return { deleteKeys: { affected: before - keys.length } };
  },
  RenameKey: (variables) => {
    // The request is one argument, not three: `rename: { from, to, replace }`. Reading the
    // variables flat found undefined everywhere and quietly renamed nothing.
    const { from, to, replace } = variables.rename as {
      from: string;
      to: string;
      replace: boolean;
    };
    const exists = keys.some((entry) => entry.key === to);
    if (exists && !replace) {
      // RENAMENX refuses rather than overwriting.
      return { renameKey: { affected: 0 } };
    }
    keys = keys
      .filter((entry) => !(exists && entry.key === to))
      .map((entry) => (entry.key === from ? { ...entry, key: to } : entry));
    return { renameKey: { affected: 1 } };
  },
  CopyKey: (variables) => {
    const { from, to, replace } = variables.copy as {
      from: string;
      to: string;
      replace: boolean;
    };
    const source = keys.find((entry) => entry.key === from);
    const exists = keys.some((entry) => entry.key === to);
    if (!source || (exists && !replace)) {
      return { copyKey: { affected: 0 } };
    }
    keys = keys.filter((entry) => entry.key !== to).concat({ ...source, key: to });
    return { copyKey: { affected: 1 } };
  },
  ExpireKey: (variables) => {
    const { key, ttlSeconds } = variables.expire as { key: string; ttlSeconds: number | null };
    keys = keys.map((entry) => (entry.key === key ? { ...entry, ttl: ttlSeconds ?? -1 } : entry));
    return { expireKey: { affected: 1 } };
  },
  ImportKeys: (variables) => {
    // What was actually sent, not a number: the button says how many keys it will import, and a
    // mock that answered something else would let that promise drift from what happens.
    const request = (variables.keys ?? {}) as { keys?: unknown[] };
    return {
      importKeys: {
        restored: request.keys?.length ?? 0,
        skipped: 0,
        failed: 0,
        reason: null,
      },
    };
  },

  // --- Monitoring ------------------------------------------------------------
  Monitoring: () => ({
    monitoring: {
      enabled: monitoring,
      intervalSeconds: 5,
      samples: monitoring ? mockSamples() : [],
    },
  }),
  StartMonitoring: () => {
    monitoring = true;
    return { startMonitoring: { enabled: true, intervalSeconds: 5, samples: mockSamples() } };
  },
  StopMonitoring: () => {
    monitoring = false;
    return { stopMonitoring: true };
  },
  MonitoringSample: () => ({ monitoringSample: mockSamples().at(-1) }),
  SlowLog: () => ({ slowLog: slowCommandFixtures }),
  ClearSlowLog: () => ({ clearSlowLog: true }),
  Clients: () => ({ clients: clientFixtures }),
  KillClient: (variables) => ({ killClient: String(variables.clientId) === '42' }),
  BiggestKeys: () => ({ biggestKeys: biggestKeysFixture }),

  // --- Pub/Sub ---------------------------------------------------------------
  PubSubSubscription: () => ({ subscription }),
  Subscribe: (variables) => {
    const body = (variables.subscription ?? variables) as {
      channels?: string[];
      patterns?: string[];
    };
    subscription = {
      connectionId: Number(variables.connectionId ?? 1),
      channels: body.channels ?? [],
      patterns: body.patterns ?? [],
      since: new Date(0).toISOString(),
      messagesReceived: 0,
    };
    return { subscribe: subscription };
  },
  Unsubscribe: () => {
    subscription = null;
    return { unsubscribe: true };
  },
  Publish: () => ({ publish: { receivers: 1 } }),

  // --- Whole-instance pages --------------------------------------------------
  /*
   * A reading only from the targets that answered. A profile nobody can reach has nothing to
   * report, and reporting a zero for it would put it into every total as a server holding no keys
   * and using no memory — which is a different claim from "we do not know".
   */
  Fleet: () => ({
    fleet: connections.map((profile) => ({
      connectionId: profile.id,
      sample: profile.status.state === ConnectionState.Up ? mockSamples().at(-1) : null,
    })),
  }),
  Attention: () => ({
    alertRules: alertRuleFixtures,
    scheduleRuns: [],
    migrations: { nodes: [migrationFixture] },
  }),
  AccessPage: () => ({
    accounts: [],
    groups: [],
    serverGroups: [],
    roles: [],
    grants: [],
    permissionCatalogue: [],
  }),
  Tunnels: () => ({ tunnels: [] }),

  /*
   * A key pair, which the server generates and shows the private half of exactly once. The mock
   * answers with a fixed pair: nothing in the browser checks that it is a real X25519 key, and a
   * test about the list of recipients should not depend on one.
   */
  GenerateBackupKeyPair: () => ({
    generateBackupKeyPair: {
      publicKey: 'keydra-pk1:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      privateKey: 'keydra-sk1:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB',
    },
  }),
  CreateBackupDestination: () => ({ createBackupDestination: { id: 1 } }),
  SetAclUser: () => ({ setAclUser: true }),

  /*
   * The whole log, filtered here rather than by the page. Which is the point of the assertion in
   * the test above it: the server does the narrowing, and a page that held the log to filter it
   * would be a page that had to hold the log.
   */
  AuditPage: (variables) => {
    const actor = variables.actor as string | undefined;
    const action = variables.action as string | undefined;
    const nodes = auditFixtures.filter(
      (entry) => (!actor || entry.actor.includes(actor)) && (!action || entry.action === action),
    );
    return {
      auditLog: {
        totalCount: nodes.length,
        nodes,
        pageInfo: { endCursor: null, hasNextPage: false, hasPreviousPage: false },
      },
      auditActions: auditActionFixtures,
    };
  },
  ScheduleRuns: () => ({ scheduleRuns: [] }),
  AlertEvents: () => ({ alertEvents: alertEventFixtures }),
};

/**
 * The one GraphQL endpoint, with some operations answered differently.
 *
 * <p>Exported because a test that wants one page in an unusual state — nothing to show, a refusal —
 * has to say so for one operation without silencing the rest. Handing `server.use` a second
 * `/graphql` handler would do exactly that: MSW gives the newest handler the whole endpoint, so
 * every other question the page asks on the way would go unanswered, and the page under test would
 * fail for a reason nobody wrote down.
 *
 * <p>An override returning `null` stands for an operation the server refuses, which is what an
 * empty answer and a refusal look like to a page — different things, and a test should be able to
 * ask for either.
 */
/**
 * A refusal the server would have given a code.
 *
 * <p>Thrown from a mock operation. The plain `Error` a mock throws becomes an errors array with a
 * message and nothing else, which is right for the refusals that only have a sentence; this one is
 * for the refusals a page branches on.
 */
export class GraphQLRefusal extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'GraphQLRefusal';
    this.code = code;
  }
}

export const graphqlWith = (overrides: Record<string, MockOperation | null>) =>
  http.post('/graphql', async ({ request }) => {
    const body = (await request.json()) as {
      query: string;
      variables?: Record<string, unknown>;
    };
    const name = operationNameOf(body.query ?? '');
    // `in` rather than a nullish fallback: an override set to null means this operation is
    // refused, and reading that as "no override" would quietly hand back the default answer —
    // which is the one thing a test asking for a refusal must not get.
    const answer = name in overrides ? overrides[name] : graphqlOperations[name];
    if (!answer) {
      // Said out loud as well as answered. A component turns a GraphQL error into its own error
      // view, so a missing mock reaches a test as "the page did not draw what I expected" — which
      // is indistinguishable from the bug the test was written to catch.
      if (!(name in overrides)) {
        console.error(`[mock] no GraphQL operation named ${name}`);
      }
      return HttpResponse.json({
        errors: [{ message: `Nothing in the mock answers the operation ${name}` }],
      });
    }
    try {
      return HttpResponse.json({ data: answer(body.variables ?? {}) });
    } catch (refusal) {
      // What the server does when an operation is not allowed to happen: an errors array, which
      // the client turns back into a thrown GraphQLError. A mock that answered with data anyway
      // would let a form close on a request the real server would have refused.
      //
      // With the code where the server puts it. Every answer on that surface is 200, so the code
      // is the only thing separating one refusal from another — and a mock that could not carry
      // one could not express the difference the pages actually branch on.
      const code = (refusal as GraphQLRefusal).code;
      return HttpResponse.json({
        errors: [
          {
            message: (refusal as Error).message,
            ...(code ? { extensions: { code } } : {}),
          },
        ],
      });
    }
  });

/** What a page about operations waiting for a second person has to be able to draw. */
const approvalFixtures = [
  {
    id: 1,
    kind: 'PURGE_KEYS',
    state: 'PENDING',
    connectionId: 1,
    connectionName: 'local-redis',
    secondConnectionId: null,
    secondConnectionName: null,
    summary: 'Delete every key matching session:*',
    particulars: [],
    requestedBy: 'someone-else',
    requestedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    decidedBy: null,
    decidedAt: null,
    detail: null,
    mine: false,
    canDecide: true,
  },
  {
    id: 2,
    kind: 'MIGRATE_KEYS',
    state: 'PENDING',
    connectionId: 1,
    connectionName: 'local-redis',
    secondConnectionId: 2,
    secondConnectionName: 'local-valkey',
    summary: 'Move every key matching orders:*, keeping what is there',
    particulars: ['At most 500 keys per second'],
    requestedBy: 'you',
    requestedAt: '2026-01-01T00:00:00Z',
    expiresAt: '2026-01-02T00:00:00Z',
    decidedBy: null,
    decidedAt: null,
    detail: null,
    mine: true,
    canDecide: false,
  },
];

export const handlers = [
  /*
   * Preferences, as an instance with no accounts answers them: nothing, and nowhere to keep it.
   * That is the mock's honest position — MSW stands in for a server, not for a signed-in person —
   * and it is also the path every page took before phase 37, so the browser's own copy applies.
   */
  /*
   * A second factor, as an instance without one answers: off, no codes. The mock stands in for a
   * server rather than for a person who has paired an authenticator, and the pairing flow is what
   * the backend test exercises end to end.
   */
  http.get('/api/v1/auth/second-factor', () =>
    HttpResponse.json({ enabled: false, recoveryCodesLeft: 0 }),
  ),

  /*
   * Beginning a pairing and proving it. Here because the wall an instance that requires a factor
   * puts in front of an account with none is a page rather than a card, and a page is a thing a
   * test renders. The secret is not a real one and does not have to be: nothing in the browser
   * checks it, and what the QR code encodes is drawn from it rather than verified against it.
   */
  http.post('/api/v1/auth/second-factor', () =>
    HttpResponse.json({
      secret: 'JBSWY3DPEHPK3PXP',
      uri: 'otpauth://totp/keydra:ada?secret=JBSWY3DPEHPK3PXP&issuer=keydra',
    }),
  ),
  http.post('/api/v1/auth/second-factor/confirm', () =>
    HttpResponse.json({ codes: ['aaaa-bbbb', 'cccc-dddd'] }),
  ),

  /*
   * One instance, leading, with everything it rests on reachable — the ordinary single-instance
   * deployment, which is what a mock should stand in for. The interesting cases (a second
   * instance, a dependency that is not answering) are the ones a real deployment produces.
   *
   * <p>It is holding something rather than nothing, so the workload column has values to draw and
   * an expanded row has targets in it. The ids are the ones the connections fixture uses.
   */
  http.get('/api/v1/instances', () =>
    HttpResponse.json({
      instances: [instanceFixture, stoppedInstanceFixture],
      dependencies: [
        {
          id: 'database',
          name: 'Database',
          kind: 'PostgreSQL',
          configured: true,
          reachable: true,
          count: 1,
          healthy: 1,
          detail: null,
          note: null,
          reached: null,
        },
        {
          id: 'shared-store',
          name: 'Shared store',
          kind: 'in-process',
          configured: false,
          reachable: true,
          count: 0,
          healthy: 0,
          detail: null,
          note: 'shared-store-local',
          reached: null,
        },
        {
          id: 'targets',
          name: 'Targets',
          kind: 'Redis, Valkey, Aerospike, TiKV…',
          configured: true,
          reachable: false,
          count: 4,
          healthy: 3,
          detail: null,
          note: null,
          reached: null,
        },
        /*
         * The one group that carries an answer to "does it actually work". Two destinations, one
         * of which did not answer when they were last asked — which is the reading this page
         * exists for and the one a fixture of all-green would never show.
         */
        {
          id: 'backup-destinations',
          name: 'Backup destinations',
          kind: 'object store or file',
          configured: true,
          reachable: false,
          count: 2,
          healthy: 2,
          // The "1 of 2 answering" line is composed from `reached` now, not sent as a sentence.
          detail: null,
          note: null,
          reached: { at: '2026-08-24T00:04:00Z', asked: 2, answering: 1 },
        },
      ],
      /* Somebody is doing the chores, which is the ordinary case and the one worth defaulting
         to: a mock that shipped the alarm on would make every page that renders this look
         broken. */
      choresStoppedSince: null,
      /* Nothing contradictory, which is what an ordinary deployment looks like. */
      deployment: [],
    }),
  ),

  /*
   * What started and stopped answering. Changes rather than answers, so two rows are a realistic
   * fixture rather than a thin one: something broke and came back, which is the shape the page is
   * for reading.
   */
  http.get('/api/v1/instances/reachability/history', () =>
    HttpResponse.json([
      {
        kind: 'backup-destination',
        subjectId: 1,
        name: 'nightly-s3',
        at: '2026-08-24T03:20:00Z',
        ok: true,
        detail: null,
      },
      {
        kind: 'backup-destination',
        subjectId: 1,
        name: 'nightly-s3',
        at: '2026-08-24T02:10:00Z',
        ok: false,
        detail: 'The credentials were refused',
      },
    ]),
  ),

  /* Asking everything now. 200 because the fixture has no clock to be too soon for. */
  http.post('/api/v1/instances/reachability', () => new HttpResponse(null, { status: 200 })),

  /* The roster without the probes, which is what a target page asks for. */
  http.get('/api/v1/instances/roster', () => HttpResponse.json([instanceFixture])),

  /*
   * Taking an instance out of service and putting it back. Both answer 204 and change nothing:
   * what a drain does happens on the instance's next beat, and the mock has no beat — so a handler
   * that flipped the fixture would be inventing a timeline the real thing does not have.
   */
  http.post('/api/v1/instances/:id/drain', () => new HttpResponse(null, { status: 204 })),
  http.delete('/api/v1/instances/:id/drain', () => new HttpResponse(null, { status: 204 })),

  /* Which destinations hear about Keydra itself. None by default, which is the real default. */
  http.get('/api/v1/alert-deliveries/instance-notices', () => HttpResponse.json([])),
  http.put('/api/v1/alert-deliveries/instance-notices', async ({ request }) =>
    HttpResponse.json(await request.json()),
  ),

  http.get('/api/v1/preferences', () => HttpResponse.json({ preferences: {}, stored: false })),
  http.post('/api/v1/preferences', () => HttpResponse.json(false)),

  http.get('/api/v1/about', () => HttpResponse.json(aboutFixture)),

  http.get('/api/v1/connections', () => HttpResponse.json(connections)),

  http.post('/api/v1/connections', async ({ request }) => {
    const body = (await request.json()) as ConnectionRequest;
    if (connections.some((c) => c.name === body.name)) {
      return HttpResponse.json(
        { message: `A connection profile named '${body.name}' already exists` },
        { status: 409 },
      );
    }
    const created = toResponse(nextId++, body, Boolean(body.password));
    connections = [...connections, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put('/api/v1/connections/:id', async ({ params, request }) => {
    const id = Number(params.id);
    const existing = connections.find((c) => c.id === id);
    if (!existing) {
      return HttpResponse.json({ message: `No connection profile with id ${id}` }, { status: 404 });
    }
    const body = (await request.json()) as ConnectionRequest;
    const hasPassword = body.password === null ? existing.hasPassword : body.password !== '';
    const updated = { ...toResponse(id, body, hasPassword), status: existing.status };
    connections = connections.map((c) => (c.id === id ? updated : c));
    return HttpResponse.json(updated);
  }),

  http.delete('/api/v1/connections/:id', ({ params }) => {
    const id = Number(params.id);
    if (!connections.some((c) => c.id === id)) {
      return HttpResponse.json({ message: `No connection profile with id ${id}` }, { status: 404 });
    }
    connections = connections.filter((c) => c.id !== id);
    return new HttpResponse(null, { status: 204 });
  }),

  // Server-sent events: one `data:` line per key, terminated by a blank line.
  http.get('/api/v1/connections/:id/keys', ({ request }) => {
    const url = new URL(request.url);
    const match = url.searchParams.get('match');
    const type = url.searchParams.get('type');
    const body = keys
      .filter((entry) => matches(entry.key, match))
      .filter((entry) => !type || entry.type === type)
      .map((entry) => `data: ${JSON.stringify(entry)}\n\n`)
      .join('');
    return new HttpResponse(body, { headers: { 'Content-Type': 'text/event-stream' } });
  }),

  /** Sixteen databases, with the fixtures in the first and a little in another. */
  /** Every migration, whichever target started it. */
  /** Where the mocked keyspace's memory went. */
  http.get('/api/v1/connections/:id/analysis/keyspace', () =>
    HttpResponse.json(keyspaceReportFixture),
  ),

  http.get('/api/v1/migrations', () => HttpResponse.json([migrationFixture])),

  /*
   * The GraphQL surface (phase 23).
   *
   * One handler that answers by operation name rather than a handler per query: what MSW is
   * standing in for is one endpoint, and a mock that pretended otherwise would be describing a
   * server that does not exist.
   *
   * It returns whole fixtures rather than only the fields a query names. Field selection is the
   * server's job and testing it here would be testing MSW; what these tests are about is the page
   * asking the right question and drawing what comes back.
   */
  graphqlWith({}),

  http.get('/api/v1/connections/:id/databases', () =>
    HttpResponse.json(
      Array.from({ length: 16 }, (_unused, index) => ({
        index,
        keys: index === 0 ? keys.length : index === 3 ? 3 : 0,
        expires: 0,
      })),
    ),
  ),

  http.get('/api/v1/connections/:id/keys/tree', ({ request }) =>
    HttpResponse.json(namespaceLevel(new URL(request.url).searchParams.get('prefix') ?? '')),
  ),

  // Export hands back the store's serialisation; the mock server has none, so it answers
  // with a placeholder payload of the right shape. Nothing in the browser reads it.
  http.post('/api/v1/connections/:id/keys/export', async ({ request }) => {
    const body = (await request.json()) as { keys?: string[]; match?: string };
    const wanted = body.keys?.length
      ? keys.filter((entry) => body.keys?.includes(entry.key))
      : keys;
    return HttpResponse.json(
      wanted.map((entry) => ({
        key: entry.key,
        ttlMillis: entry.ttl > 0 ? entry.ttl * 1000 : 0,
        payload: 'ZHVtbXk=',
      })),
    );
  }),

  http.post('/api/v1/connections/:id/keys/import', async ({ request }) => {
    const body = (await request.json()) as { keys: { key: string }[] };
    return HttpResponse.json({ restored: body.keys.length, skipped: 0, failed: 0, reason: null });
  }),

  http.post('/api/v1/connections/:id/keys/delete', async ({ request }) => {
    const body = (await request.json()) as { keys: string[] };
    const before = keys.length;
    keys = keys.filter((entry) => !body.keys.includes(entry.key));
    return HttpResponse.json({ affected: before - keys.length });
  }),

  http.post('/api/v1/connections/:id/keys/rename', async ({ request }) => {
    const body = (await request.json()) as { from: string; to: string; replace: boolean };
    const exists = keys.some((entry) => entry.key === body.to);
    if (exists && !body.replace) {
      // RENAMENX refuses rather than overwriting.
      return HttpResponse.json({ affected: 0 });
    }
    keys = keys
      .filter((entry) => !(exists && entry.key === body.to))
      .map((entry) => (entry.key === body.from ? { ...entry, key: body.to } : entry));
    return HttpResponse.json({ affected: 1 });
  }),

  http.post('/api/v1/connections/:id/keys/copy', async ({ request }) => {
    const body = (await request.json()) as { from: string; to: string; replace: boolean };
    const source = keys.find((entry) => entry.key === body.from);
    const exists = keys.some((entry) => entry.key === body.to);
    if (!source || (exists && !body.replace)) {
      // COPY refuses rather than overwriting, the same way RENAMENX does.
      return HttpResponse.json({ affected: 0 });
    }
    keys = keys.filter((entry) => entry.key !== body.to).concat({ ...source, key: body.to });
    return HttpResponse.json({ affected: 1 });
  }),

  http.post('/api/v1/connections/:id/keys/expire', async ({ request }) => {
    const body = (await request.json()) as { key: string; ttlSeconds: number | null };
    keys = keys.map((entry) =>
      entry.key === body.key ? { ...entry, ttl: body.ttlSeconds ?? -1 } : entry,
    );
    return HttpResponse.json({ affected: 1 });
  }),

  http.post('/api/v1/connections/:id/test', ({ params }) => {
    const id = Number(params.id);
    const existing = connections.find((c) => c.id === id);
    if (!existing) {
      return HttpResponse.json({ message: `No connection profile with id ${id}` }, { status: 404 });
    }
    const status = {
      state: ConnectionState.Up,
      message: null,
      server: { flavor: 'redis', version: '8.10.0', mode: 'standalone' },
      checkedAt: new Date(0).toISOString(),
    };
    connections = connections.map((c) => (c.id === id ? { ...c, status } : c));
    return HttpResponse.json(status);
  }),

  // --- Values ---------------------------------------------------------------

  /** One stand-in value per type, so every editor can be developed without a server. */
  http.get('/api/v1/connections/:id/value', ({ request }) => {
    const key = new URL(request.url).searchParams.get('key') ?? '';
    const entry = keys.find((candidate) => candidate.key === key);
    if (!entry) {
      return HttpResponse.json({ message: `No key named ${key}` }, { status: 404 });
    }

    const text = (value: string, encoding = 'plain') => ({
      text: value,
      encoding,
      size: value.length,
      truncated: false,
    });

    switch (entry.type) {
      case 'hash':
        return HttpResponse.json({
          type: 'hash',
          cursor: null,
          total: 2,
          fields: [
            { name: 'name', value: text('alice') },
            { name: 'city', value: text('izmir') },
          ],
        });
      case 'list':
        return HttpResponse.json({
          type: 'list',
          cursor: null,
          total: 2,
          elements: [
            { index: 0, value: text('first') },
            { index: 1, value: text('second') },
          ],
        });
      case 'set':
        return HttpResponse.json({
          type: 'set',
          cursor: null,
          total: 2,
          members: [text('redis'), text('valkey')],
        });
      case 'zset':
        return HttpResponse.json({
          type: 'zset',
          cursor: null,
          total: 2,
          members: [
            { value: text('alice'), score: 10 },
            { value: text('bob'), score: 20 },
          ],
        });
      case 'stream':
        return HttpResponse.json({
          type: 'stream',
          cursor: null,
          total: 1,
          entries: [{ id: '1-0', fields: [{ name: 'kind', value: text('created') }] }],
        });
      default:
        return HttpResponse.json({
          type: 'string',
          cursor: null,
          total: null,
          value: text('hello'),
        });
    }
  }),

  http.get('/api/v1/connections/:id/value/encodings', () =>
    HttpResponse.json(['plain', 'json', 'hex', 'base64', 'gzip', 'msgpack']),
  ),

  http.post('/api/v1/connections/:id/value', () => HttpResponse.json({ affected: 1 })),

  // --- Console -------------------------------------------------------------

  http.get('/api/v1/connections/:id/console/history', () =>
    HttpResponse.json([
      { id: 2, line: 'GET user:1:profile', executedAt: new Date(0).toISOString() },
      { id: 1, line: 'DBSIZE', executedAt: new Date(0).toISOString() },
    ]),
  ),

  http.delete(
    '/api/v1/connections/:id/console/history',
    () => new HttpResponse(null, { status: 204 }),
  ),

  http.get('/api/v1/connections/:id/console/denied-commands', () =>
    HttpResponse.json(['flushall', 'flushdb', 'keys', 'monitor', 'shutdown', 'subscribe']),
  ),

  // --- Pub/Sub -------------------------------------------------------------

  http.get('/api/v1/connections/:id/pubsub/subscription', () =>
    subscription
      ? HttpResponse.json(subscription)
      : HttpResponse.json({ message: 'Nothing subscribed' }, { status: 404 }),
  ),

  http.post('/api/v1/connections/:id/pubsub/subscription', async ({ params, request }) => {
    const body = (await request.json()) as { channels: string[]; patterns: string[] };
    subscription = {
      connectionId: Number(params.id),
      channels: body.channels ?? [],
      patterns: body.patterns ?? [],
      since: new Date(0).toISOString(),
      messagesReceived: 0,
    };
    return HttpResponse.json(subscription);
  }),

  http.delete('/api/v1/connections/:id/pubsub/subscription', () => {
    if (!subscription) {
      return new HttpResponse(null, { status: 404 });
    }
    subscription = null;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/v1/connections/:id/pubsub/publish', () => HttpResponse.json({ receivers: 1 })),

  http.get('/api/v1/subscriptions', () => HttpResponse.json(subscription ? [subscription] : [])),

  // --- Monitoring ----------------------------------------------------------

  http.get('/api/v1/connections/:id/monitoring', () =>
    HttpResponse.json({
      enabled: monitoring,
      intervalSeconds: 5,
      samples: monitoring ? mockSamples() : [],
    }),
  ),

  http.post('/api/v1/connections/:id/monitoring', () => {
    monitoring = true;
    return HttpResponse.json({ enabled: true, intervalSeconds: 5, samples: mockSamples() });
  }),

  http.delete('/api/v1/connections/:id/monitoring', () => {
    if (!monitoring) {
      return new HttpResponse(null, { status: 404 });
    }
    monitoring = false;
    return new HttpResponse(null, { status: 204 });
  }),

  // One reading on demand, which is what the connection cards ask for. Independent of
  // whether the mock server is sampling, exactly like the real endpoint.
  http.get('/api/v1/connections/:id/monitoring/sample', () =>
    HttpResponse.json(mockSamples().at(-1)),
  ),

  http.get('/api/v1/connections/:id/monitoring/info', () =>
    HttpResponse.json({ server: { redis_version: '8.10.0' }, memory: { used_memory: '1048576' } }),
  ),

  http.get('/api/v1/connections/:id/monitoring/slowlog', () =>
    HttpResponse.json(slowCommandFixtures),
  ),

  http.delete(
    '/api/v1/connections/:id/monitoring/slowlog',
    () => new HttpResponse(null, { status: 204 }),
  ),

  http.get('/api/v1/connections/:id/monitoring/clients', () => HttpResponse.json(clientFixtures)),

  http.delete('/api/v1/connections/:id/monitoring/clients/:clientId', ({ params }) =>
    params.clientId === '42'
      ? new HttpResponse(null, { status: 204 })
      : new HttpResponse(null, { status: 404 }),
  ),

  http.get('/api/v1/connections/:id/monitoring/big-keys', () =>
    HttpResponse.json(biggestKeysFixture),
  ),

  // --- Topology ------------------------------------------------------------

  http.get('/api/v1/connections/:id/topology', ({ params }) =>
    HttpResponse.json(topologyFixture(Number(params.id))),
  ),

  // --- Signing in and access ------------------------------------------------

  http.get('/api/v1/auth/state', () =>
    // A development instance: nothing enforced, so there is nothing to sign into and the
    // login page never appears.
    HttpResponse.json({
      securityEnabled: false,
      needsSetup: false,
      authenticated: true,
      username: 'anonymous',
    }),
  ),

  http.get('/api/v1/auth/permissions', () =>
    HttpResponse.json({
      username: 'anonymous',
      securityEnabled: false,
      instance: [],
      connections: {},
    }),
  ),

  http.post('/api/v1/auth/login', () => new HttpResponse(null, { status: 200 })),

  http.get('/api/v1/auth/providers', () => HttpResponse.json([])),

  // Two browsers signed in, one of them the one reading the page.
  http.get('/api/v1/auth/sessions', () => HttpResponse.json(sessionFixtures)),
  http.delete('/api/v1/auth/sessions/:id', () => new HttpResponse(null, { status: 204 })),
  http.delete('/api/v1/auth/sessions', () => HttpResponse.json(1)),

  // A link that is still good, so the page can be developed without making one.
  http.get('/api/v1/invitations/:token', ({ params }) =>
    HttpResponse.json({
      usable: params.token !== 'spent',
      refusal: params.token === 'spent' ? 'USED' : null,
      username: 'newcomer',
      displayName: null,
      purpose: 'INVITATION',
    }),
  ),
  http.post('/api/v1/invitations/forgotten', () => new HttpResponse(null, { status: 202 })),
  http.post('/api/v1/invitations/for-user/:id', () =>
    HttpResponse.json({
      mailed: true,
      address: 'newcomer@example.com',
      link: 'http://localhost:9000/invitation/a-token',
    }),
  ),
  http.post('/api/v1/invitations/:token', () =>
    HttpResponse.json({
      usable: true,
      refusal: null,
      username: 'newcomer',
      displayName: null,
      purpose: 'INVITATION',
    }),
  ),

  http.get('/api/v1/authz/providers', () => HttpResponse.json(providerFixtures)),

  http.get('/api/v1/authz/users', () =>
    HttpResponse.json([
      {
        id: 1,
        username: 'ada',
        displayName: 'Ada Lovelace',
        email: 'ada@example.com',
        provider: 'local',
        enabled: true,
        hasPassword: true,
        lastSeenAt: new Date(0).toISOString(),
        groups: ['platform'],
      },
      {
        id: 2,
        username: 'deniz',
        displayName: null,
        email: null,
        provider: 'local',
        enabled: true,
        hasPassword: true,
        lastSeenAt: null,
        groups: [],
      },
    ]),
  ),

  http.get('/api/v1/authz/groups', () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'platform',
        description: 'Runs the servers',
        managedBy: null,
        memberUsers: ['ada'],
        memberGroups: [],
      },
    ]),
  ),

  http.get('/api/v1/authz/server-groups', () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'production',
        description: null,
        parentId: null,
        connectionIds: [1],
      },
    ]),
  ),

  http.get('/api/v1/authz/roles', () =>
    HttpResponse.json([
      {
        id: 1,
        name: 'viewer',
        description: 'Built in; cannot be edited',
        builtIn: true,
        permissions: ['KEYS_READ', 'VALUES_READ'],
      },
      {
        id: 3,
        name: 'admin',
        description: 'Built in; cannot be edited',
        builtIn: true,
        permissions: ['KEYS_READ', 'USERS_MANAGE'],
      },
    ]),
  ),

  http.get('/api/v1/authz/roles/permissions', () =>
    HttpResponse.json([
      { name: 'KEYS_READ', id: 'keys:read', level: 'CONNECTION' },
      { name: 'USERS_MANAGE', id: 'users:manage', level: 'INSTANCE' },
    ]),
  ),

  http.get('/api/v1/authz/grants', () =>
    HttpResponse.json([
      {
        id: 1,
        subjectType: 'GROUP',
        subjectId: 1,
        subjectName: 'platform',
        scopeType: 'SERVER_GROUP',
        scopeId: 1,
        scopeName: 'production',
        roleId: 1,
        roleName: 'viewer',
        grantedAt: new Date(0).toISOString(),
        grantedBy: 'ada',
      },
    ]),
  ),

  // --- Security ------------------------------------------------------------

  http.get('/api/v1/security/me', () =>
    // The mock server stands in for a development instance, which is the case where
    // nothing is enforced. The UI has to say so rather than look secured.
    HttpResponse.json({
      name: 'anonymous',
      roles: ['viewer', 'operator', 'admin'],
      securityEnabled: false,
    }),
  ),

  http.get('/api/v1/security/audit', () => HttpResponse.json(auditFixtures)),

  http.get('/api/v1/security/audit/actions', () => HttpResponse.json(auditActionFixtures)),

  // --- Alerts ---------------------------------------------------------------
  //
  // One rule per state, because the state column is the reason the page exists: quiet with a
  // reading, and firing with the reading it fired on.
  http.get('/api/v1/alerts', () => HttpResponse.json(alertRuleFixtures)),

  http.get('/api/v1/alerts/metrics', () => HttpResponse.json(alertMetricFixtures)),

  http.get('/api/v1/alerts/events', () => HttpResponse.json(alertEventFixtures)),

  // No address, only its host: a webhook URL is a credential, so the API never returns one.
  http.get('/api/v1/alert-deliveries', () => HttpResponse.json(alertDeliveryFixtures)),

  http.get('/api/v1/connections/:id/acl', () => HttpResponse.json(aclUserFixtures)),

  http.put('/api/v1/connections/:id/acl', () => new HttpResponse(null, { status: 204 })),

  http.delete(
    '/api/v1/connections/:id/acl/:username',
    () => new HttpResponse(null, { status: 204 }),
  ),

  /*
   * Two requests waiting on somebody, because the page's whole subject is the difference between
   * them: one this caller can answer, and one they asked for themselves and therefore cannot.
   * A mock with only the first would let the row that says "yours" go untested, and that row is
   * the feature explaining itself.
   */
  http.get('/api/v1/approvals', () => HttpResponse.json(approvalFixtures)),

  http.post('/api/v1/approvals/:id/approve', ({ params }) =>
    HttpResponse.json({
      ...approvalFixtures[0],
      id: Number(params.id),
      state: 'RUNNING',
      decidedBy: 'someone-else',
      decidedAt: '2026-01-01T01:00:00Z',
      canDecide: false,
    }),
  ),

  http.post('/api/v1/approvals/:id/decline', ({ params }) =>
    HttpResponse.json({
      ...approvalFixtures[0],
      id: Number(params.id),
      state: 'DECLINED',
      decidedBy: 'someone-else',
      decidedAt: '2026-01-01T01:00:00Z',
      canDecide: false,
    }),
  ),

  http.delete('/api/v1/approvals/:id', ({ params }) =>
    HttpResponse.json({ ...approvalFixtures[1], id: Number(params.id), state: 'WITHDRAWN' }),
  ),
];
