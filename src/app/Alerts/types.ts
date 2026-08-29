/** Wire types for the alert endpoints. Mirrors io.keydra.alerts.*. */

/** Mirrors io.keydra.alerts.entity.AlertMetric. */
export const AlertMetric = {
  MemoryUsedBytes: 'MEMORY_USED_BYTES',
  MemoryFillPercent: 'MEMORY_FILL_PERCENT',
  ConnectedClients: 'CONNECTED_CLIENTS',
  OpsPerSecond: 'OPS_PER_SECOND',
  HitRatioPercent: 'HIT_RATIO_PERCENT',
  KeyCount: 'KEY_COUNT',
  EvictedKeysPerMinute: 'EVICTED_KEYS_PER_MINUTE',
  ExpiredKeysPerMinute: 'EXPIRED_KEYS_PER_MINUTE',
  UptimeSeconds: 'UPTIME_SECONDS',
  NoAnswer: 'NO_ANSWER',
} as const;

export type AlertMetric = (typeof AlertMetric)[keyof typeof AlertMetric];

/** What a reading is, which decides how it is written out. */
export const MetricUnit = {
  Bytes: 'BYTES',
  Percent: 'PERCENT',
  Count: 'COUNT',
  PerSecond: 'PER_SECOND',
  PerMinute: 'PER_MINUTE',
  Seconds: 'SECONDS',
  /** A yes or a no rather than a quantity; no threshold worth asking for. */
  Condition: 'CONDITION',
} as const;

export type MetricUnit = (typeof MetricUnit)[keyof typeof MetricUnit];

export const Comparison = {
  Above: 'ABOVE',
  Below: 'BELOW',
} as const;

export type Comparison = (typeof Comparison)[keyof typeof Comparison];

/** Where a rule stands. Held in the backend's memory, so it starts at OK after a restart. */
export const AlertState = {
  Ok: 'OK',
  /** The condition holds, but not yet for as long as the rule asks. */
  Pending: 'PENDING',
  Firing: 'FIRING',
} as const;

export type AlertState = (typeof AlertState)[keyof typeof AlertState];

export const EventKind = {
  Fired: 'FIRED',
  Cleared: 'CLEARED',
} as const;

export type EventKind = (typeof EventKind)[keyof typeof EventKind];

/**
 * Where an alert can be sent.
 *
 * <p>Slack appears twice on purpose: its incoming webhooks are a URL, which `Webhook` posts to, and
 * `Slack` is the other way in — a bot token and a channel by name, so the channel can be changed
 * without issuing a new address.
 */
export const DeliveryKind = {
  Webhook: 'WEBHOOK',
  Email: 'EMAIL',
  Telegram: 'TELEGRAM',
  Slack: 'SLACK',
  WhatsApp: 'WHATSAPP',
} as const;

export type DeliveryKind = (typeof DeliveryKind)[keyof typeof DeliveryKind];

export const DeliveryOutcome = {
  None: 'NONE',
  Sending: 'SENDING',
  Sent: 'SENT',
  Failed: 'FAILED',
} as const;

export type DeliveryOutcome = (typeof DeliveryOutcome)[keyof typeof DeliveryOutcome];

/**
 * What a rule's threshold is measured against.
 *
 * Absolute is somebody's estimate of what the server ought to look like; a baseline is the
 * server's own record of what it did look like, which stays right through a capacity change
 * nobody remembered to re-tune for.
 */
export const AlertBasis = {
  Absolute: 'ABSOLUTE',
  Baseline: 'BASELINE',
} as const;

export type AlertBasis = (typeof AlertBasis)[keyof typeof AlertBasis];

/** A metric a rule can watch, as the backend publishes it. */
export interface AlertMetricInfo {
  name: AlertMetric;
  unit: MetricUnit;
  condition: boolean;
}

/** A rule, and where it currently stands. */
export interface AlertRuleSummary {
  id: number;
  name: string;
  connectionId: number;
  connectionName: string | null;
  metric: AlertMetric;
  unit: MetricUnit;
  comparison: Comparison;
  basis: AlertBasis;
  /** An amount for an absolute rule, and a percentage of the baseline for one against the past. */
  threshold: number;
  baselineWindowSeconds: number;
  baselineOffsetSeconds: number;
  /**
   * What the metric read over the window this rule compares against.
   *
   * Null for an absolute rule, and for one whose window cannot be answered yet — no readings
   * store, or nothing kept from that far back. Shown as missing rather than as zero.
   */
  baseline: number | null;
  forSeconds: number;
  enabled: boolean;
  /** Every place this rule announces itself; empty is the notification hub alone. */
  deliveryIds: number[];
  /** Their names, in the same order, for a row that has no room for ids. */
  deliveryNames: string[];
  createdBy: string | null;
  createdAt: string;
  state: AlertState;
  since: string | null;
  /** The last reading of this rule's metric, or null when the target could not answer it. */
  reading: number | null;
  readAt: string | null;
  /** Whether the target is actually being sampled, so a rule that sees nothing says so. */
  watching: boolean;
}

export interface AlertRuleRequest {
  name: string;
  connectionId: number;
  metric: AlertMetric;
  comparison?: Comparison;
  basis?: AlertBasis;
  threshold?: number;
  baselineWindowSeconds?: number;
  baselineOffsetSeconds?: number;
  forSeconds?: number;
  enabled?: boolean;
  deliveryIds?: number[] | null;
}

/**
 * The windows a rule can compare against, as sentences people already say.
 *
 * Offsets in seconds, and the window an hour wide in every case: a single reading from the past
 * is a spike or a trough as easily as it is normal.
 */
export const BASELINE_WINDOWS = [
  { offsetSeconds: 0, labelKey: 'Alerts.WINDOW_THIS_HOUR' },
  { offsetSeconds: 86400, labelKey: 'Alerts.WINDOW_YESTERDAY' },
  { offsetSeconds: 604800, labelKey: 'Alerts.WINDOW_LAST_WEEK' },
] as const;

/** A rule that started firing, or stopped. */
export interface AlertEventSummary {
  id: number;
  ruleId: number;
  ruleName: string;
  connectionId: number;
  connectionName: string | null;
  kind: EventKind;
  metric: AlertMetric;
  reading: number | null;
  threshold: number;
  at: string;
  deliveryName: string | null;
  deliveryOutcome: DeliveryOutcome;
  deliveryDetail: string | null;
}

/**
 * Somewhere alerts are sent.
 *
 * <p>No address here, only its host: a webhook URL carries its token in its path, so the API
 * treats it as the credential it is and says only whether one is stored.
 */
export interface AlertDeliverySummary {
  id: number;
  name: string;
  kind: DeliveryKind;
  enabled: boolean;
  urlHost: string | null;
  hasUrl: boolean;
  headerName: string | null;
  hasSecret: boolean;
  smtpHost: string | null;
  smtpPort: number | null;
  smtpTls: boolean;
  username: string | null;
  hasPassword: boolean;
  fromAddress: string | null;
  toAddresses: string | null;
  /** Whether a chat tool's token is stored. Never the token itself. */
  hasApiToken: boolean;
  /** The chat, channel or number a message goes to — not a secret, so it is shown. */
  recipient: string | null;
  /** WhatsApp only: the number id a message is sent from. */
  senderId: string | null;
  describedAs: string;
  usedByRules: number;
}

/** A delivery to create or change. An absent secret keeps the stored one; an empty one clears it. */
export interface AlertDeliveryRequest {
  name: string;
  kind: DeliveryKind;
  enabled?: boolean;
  url?: string;
  headerName?: string;
  headerValue?: string;
  smtpHost?: string;
  smtpPort?: number | null;
  smtpTls?: boolean;
  username?: string;
  password?: string;
  fromAddress?: string;
  toAddresses?: string;
  apiToken?: string;
  recipient?: string;
  senderId?: string;
}

export interface AlertDeliveryCheck {
  working: boolean;
  detail: string | null;
}

/** What the hub sends when a rule changes its mind. Mirrors io.keydra.alerts.dto.AlertNotice. */
export interface AlertNotice {
  ruleId: number | null;
  ruleName: string;
  connectionId: number | null;
  connectionName: string | null;
  kind: EventKind;
  metric: AlertMetric;
  comparison: Comparison;
  reading: number | null;
  threshold: number;
  at: string;
}
