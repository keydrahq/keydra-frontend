/** Formatting shared by the dashboard's cards, charts and tables. */

/** Bytes, at the largest unit that keeps the number readable. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) {
    return `${Math.round(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KiB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`;
};

/** A count, grouped by the reader's locale. */
export const formatCount = (value: number): string => value.toLocaleString();

/** A fraction as a percentage, to one decimal. */
export const formatPercent = (fraction: number): string => `${(fraction * 100).toFixed(1)}%`;

/**
 * Microseconds at a scale a person reads.
 *
 * <p>Slow-log durations span four orders of magnitude, and rendering them all in microseconds
 * makes the outliers no easier to spot than the noise.
 */
export const formatMicros = (micros: number): string => {
  if (micros < 1000) {
    return `${micros} µs`;
  }
  if (micros < 1_000_000) {
    return `${(micros / 1000).toFixed(1)} ms`;
  }
  return `${(micros / 1_000_000).toFixed(2)} s`;
};

/** A duration in seconds as days, hours or minutes — whichever is the coarsest that fits. */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }
  return `${Math.floor(seconds / 86400)}d`;
};
