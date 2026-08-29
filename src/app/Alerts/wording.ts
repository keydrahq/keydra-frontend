import type { TFunction } from 'i18next';
import { AlertMetric, Comparison, MetricUnit } from './types';
import type { AlertNotice } from './types';

/**
 * A reading with its unit, at the scale a person reads it in.
 *
 * <p>The backend writes the same sentence for the message it sends outside, where there is no
 * interface to translate anything. This is the same rule applied to what goes on a screen — the two
 * agree about what a number means, and disagree only about which language says it.
 */
export const formatReading = (value: number | null | undefined, unit: MetricUnit): string => {
  if (value === null || value === undefined) {
    return '—';
  }
  switch (unit) {
    case MetricUnit.Bytes:
      return formatBytes(value);
    case MetricUnit.Percent:
      return `${round(value)}%`;
    case MetricUnit.Seconds:
      return `${round(value)}s`;
    case MetricUnit.PerSecond:
      return `${round(value)}/s`;
    case MetricUnit.PerMinute:
      return `${round(value)}/min`;
    case MetricUnit.Condition:
      return value > 0 ? '!' : '—';
    default:
      return round(value);
  }
};

/** The unit a metric reads in, without having to have fetched the metric list. */
export const unitOf = (metric: AlertMetric): MetricUnit => {
  switch (metric) {
    case AlertMetric.MemoryUsedBytes:
      return MetricUnit.Bytes;
    case AlertMetric.MemoryFillPercent:
    case AlertMetric.HitRatioPercent:
      return MetricUnit.Percent;
    case AlertMetric.OpsPerSecond:
      return MetricUnit.PerSecond;
    case AlertMetric.EvictedKeysPerMinute:
    case AlertMetric.ExpiredKeysPerMinute:
      return MetricUnit.PerMinute;
    case AlertMetric.UptimeSeconds:
      return MetricUnit.Seconds;
    case AlertMetric.NoAnswer:
      return MetricUnit.Condition;
    default:
      return MetricUnit.Count;
  }
};

/** What a notice was about, in one line, for the body of a toast. */
export const readingOf = (notice: AlertNotice, t: TFunction): string => {
  const unit = unitOf(notice.metric);
  if (unit === MetricUnit.Condition) {
    return t('Alerts.METRIC_NO_ANSWER');
  }
  return t('Alerts.READING_AGAINST', {
    reading: formatReading(notice.reading, unit),
    comparison: t(
      notice.comparison === Comparison.Above ? 'Alerts.ABOVE' : 'Alerts.BELOW',
    ).toLowerCase(),
    threshold: formatReading(notice.threshold, unit),
  });
};

const formatBytes = (value: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let scaled = value;
  let unit = 0;
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024;
    unit += 1;
  }
  return `${round(scaled)} ${units[unit]}`;
};

const round = (value: number): string =>
  Number.isInteger(value) ? String(value) : value.toFixed(1);
