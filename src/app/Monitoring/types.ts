/** Wire types for monitoring, mirroring io.keydra.monitoring.dto and io.keydra.engine. */

/**
 * One reading of a server's vital signs.
 *
 * <p>Every field is nullable because a store may not report it. A missing number is shown as
 * missing rather than as zero, which would read as "nothing is happening".
 */
export interface MetricsSample {
  at: string;
  memoryUsedBytes: number | null;
  memoryPeakBytes: number | null;
  /** Null means no ceiling was configured, not a ceiling of zero. */
  memoryMaxBytes: number | null;
  connectedClients: number | null;
  opsPerSecond: number | null;
  totalCommands: number | null;
  keyspaceHits: number | null;
  keyspaceMisses: number | null;
  keyCount: number | null;
  uptimeSeconds: number | null;
  evictedKeys: number | null;
  expiredKeys: number | null;
}

export interface MonitoringState {
  enabled: boolean;
  /**
   * True while an alert rule is keeping this target sampled, whoever else has stopped watching.
   *
   * <p>So a switch somebody turned off that is still on has a reason beside it rather than
   * looking broken.
   */
  heldByRule: boolean;
  intervalSeconds: number;
  /** Oldest first, which is the order a chart plots. */
  samples: MetricsSample[];
  /**
   * True when readings are also written somewhere that outlives the process.
   *
   * <p>What decides whether a window longer than the hour memory holds can be answered at all.
   */
  durable: boolean;
}

export interface SlowCommand {
  id: number;
  at: string;
  durationMicros: number;
  arguments: string[];
  client: string | null;
  clientName: string | null;
}

export interface ClientConnection {
  id: string;
  address: string;
  name: string | null;
  ageSeconds: number | null;
  idleSeconds: number | null;
  database: number | null;
  lastCommand: string | null;
}

export interface KeySize {
  key: string;
  type: string;
  bytes: number;
  elements: number | null;
  /** What is left of its life in milliseconds, or -1 when it has no expiry at all. */
  ttlMillis: number;
}

export interface BigKeysReport {
  /** How many keys were measured — the ranking means nothing without it. */
  sampled: number;
  totalBytes: number;
  largest: KeySize[];
}

/** Payload of a MetricsSample notification. */
export interface MetricsSamplePayload {
  connectionId: number;
  sample: MetricsSample;
}

/**
 * Hits as a fraction of lookups, or null when nothing has been looked up.
 *
 * <p>Zero hits and zero misses is not a ratio of zero, it is the absence of one; drawing 0% for an
 * idle server would be a lie about it.
 */
export const hitRatio = (sample: MetricsSample): number | null => {
  if (sample.keyspaceHits === null || sample.keyspaceMisses === null) {
    return null;
  }
  const lookups = sample.keyspaceHits + sample.keyspaceMisses;
  return lookups === 0 ? null : sample.keyspaceHits / lookups;
};

/** Where a window of readings came from. Mirrors io.keydra.monitoring.dto.MetricsHistory.Source. */
export const HistorySource = {
  /** The ring buffer: every reading taken, for as long as it has been kept. */
  Memory: 'MEMORY',
  /** A store that outlives the process, in buckets wide enough to draw. */
  Store: 'STORE',
  /** Nothing could answer: no store, and the window is older than memory. */
  None: 'NONE',
} as const;

export type HistorySource = (typeof HistorySource)[keyof typeof HistorySource];

/** Readings over a window, and where they were read from. */
export interface MetricsHistory {
  source: HistorySource;
  /** How wide each bucket is; the sampling interval when nothing was aggregated. */
  stepSeconds: number;
  samples: MetricsSample[];
}
