import type { GraphQLService } from '@app/Shared/Services/GraphQL.service';
import type {
  BigKeysReport,
  ClientConnection,
  MetricsHistory,
  MetricsSample,
  MonitoringState,
  SlowCommand,
} from './types';

/**
 * The dashboard's questions, each named once.
 *
 * <p>Kept as a layer rather than folded into the hooks because the dashboard asks the same things
 * from several places — a card, a table, a chart — and a query written twice is a query that
 * eventually asks for different fields in the two places.
 */

const SAMPLE_FIELDS = `
  at
  memoryUsedBytes
  memoryPeakBytes
  memoryMaxBytes
  keyCount
  connectedClients
  opsPerSecond
  keyspaceHits
  keyspaceMisses
  expiredKeys
  evictedKeys
  totalCommands
  uptimeSeconds
`;

const STATE_FIELDS = `
  enabled
  intervalSeconds
  durable
  heldByRule
  samples {
    ${SAMPLE_FIELDS}
  }
`;

const documents = {
  state: `
    query Monitoring($connectionId: BigInteger) {
      monitoring(connectionId: $connectionId) {
        ${STATE_FIELDS}
      }
    }
  `,
  start: `
    mutation StartMonitoring($connectionId: BigInteger) {
      startMonitoring(connectionId: $connectionId) {
        ${STATE_FIELDS}
      }
    }
  `,
  stop: `
    mutation StopMonitoring($connectionId: BigInteger) {
      stopMonitoring(connectionId: $connectionId)
    }
  `,
  sample: `
    query MonitoringSample($connectionId: BigInteger) {
      monitoringSample(connectionId: $connectionId) {
        ${SAMPLE_FIELDS}
      }
    }
  `,
  history: `
    query MonitoringHistory(
      $connectionId: BigInteger
      $from: DateTime
      $to: DateTime
      $points: Int
    ) {
      monitoringHistory(connectionId: $connectionId, from: $from, to: $to, points: $points) {
        source
        stepSeconds
        samples {
          ${SAMPLE_FIELDS}
        }
      }
    }
  `,
  slowlog: `
    query SlowLog($connectionId: BigInteger, $limit: Int) {
      slowLog(connectionId: $connectionId, limit: $limit) {
        id
        at
        durationMicros
        arguments
        client
        clientName
      }
    }
  `,
  clearSlowlog: `
    mutation ClearSlowLog($connectionId: BigInteger) {
      clearSlowLog(connectionId: $connectionId)
    }
  `,
  clients: `
    query Clients($connectionId: BigInteger) {
      clients(connectionId: $connectionId) {
        id
        address
        name
        ageSeconds
        idleSeconds
        database
        lastCommand
      }
    }
  `,
  killClient: `
    mutation KillClient($connectionId: BigInteger, $clientId: String) {
      killClient(connectionId: $connectionId, clientId: $clientId)
    }
  `,
  bigKeys: `
    query BiggestKeys($connectionId: BigInteger, $sample: Int, $top: Int) {
      biggestKeys(connectionId: $connectionId, sample: $sample, top: $top) {
        sampled
        totalBytes
        largest {
          key
          type
          bytes
          elements
          ttlMillis
        }
      }
    }
  `,
};

export const monitoringApi = {
  state: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ monitoring: MonitoringState }>(documents.state, { connectionId })
      .then((a) => a.monitoring),

  start: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ startMonitoring: MonitoringState }>(documents.start, { connectionId })
      .then((a) => a.startMonitoring),

  stop: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ stopMonitoring: boolean }>(documents.stop, { connectionId })
      .then((a) => a.stopMonitoring),

  sample: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ monitoringSample: MetricsSample }>(documents.sample, { connectionId })
      .then((a) => a.monitoringSample),

  history: (
    graphql: GraphQLService,
    connectionId: number,
    from: string,
    to: string,
    points: number,
  ) =>
    graphql
      .query<{ monitoringHistory: MetricsHistory }>(documents.history, {
        connectionId,
        from,
        to,
        points,
      })
      .then((a) => a.monitoringHistory),

  slowlog: (graphql: GraphQLService, connectionId: number, limit = 50) =>
    graphql
      .query<{ slowLog: SlowCommand[] }>(documents.slowlog, { connectionId, limit })
      .then((a) => a.slowLog),

  clearSlowlog: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ clearSlowLog: boolean }>(documents.clearSlowlog, { connectionId })
      .then((a) => a.clearSlowLog),

  clients: (graphql: GraphQLService, connectionId: number) =>
    graphql
      .query<{ clients: ClientConnection[] }>(documents.clients, { connectionId })
      .then((a) => a.clients),

  killClient: (graphql: GraphQLService, connectionId: number, clientId: string) =>
    graphql
      .query<{ killClient: boolean }>(documents.killClient, { connectionId, clientId })
      .then((a) => a.killClient),

  bigKeys: (graphql: GraphQLService, connectionId: number, sample = 1000, top = 20) =>
    graphql
      .query<{ biggestKeys: BigKeysReport }>(documents.bigKeys, { connectionId, sample, top })
      .then((a) => a.biggestKeys),
};
