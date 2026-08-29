import { describe, expect, it } from 'vitest';
import { formatBytes, formatDuration, formatMicros, formatPercent } from '@app/Monitoring/format';
import { hitRatio } from '@app/Monitoring/types';
import type { MetricsSample } from '@app/Monitoring/types';

const sample = (over: Partial<MetricsSample>): MetricsSample => ({
  at: new Date(0).toISOString(),
  memoryUsedBytes: null,
  memoryPeakBytes: null,
  memoryMaxBytes: null,
  connectedClients: null,
  opsPerSecond: null,
  totalCommands: null,
  keyspaceHits: null,
  keyspaceMisses: null,
  keyCount: null,
  uptimeSeconds: null,
  evictedKeys: null,
  expiredKeys: null,
  ...over,
});

describe('hitRatio', () => {
  it('is the share of lookups that found something', () => {
    expect(hitRatio(sample({ keyspaceHits: 3, keyspaceMisses: 1 }))).toBe(0.75);
  });

  it('is absent when nothing has been looked up', () => {
    // Zero of zero is not a ratio of zero: drawing 0% for an idle server would be a lie.
    expect(hitRatio(sample({ keyspaceHits: 0, keyspaceMisses: 0 }))).toBeNull();
  });

  it('is absent when the server does not report the counters', () => {
    expect(hitRatio(sample({}))).toBeNull();
  });
});

describe('formatBytes', () => {
  it('keeps small numbers in bytes', () => {
    expect(formatBytes(512)).toBe('512 B');
  });

  it('steps up a unit at a time', () => {
    expect(formatBytes(2048)).toBe('2.0 KiB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MiB');
    expect(formatBytes(3 * 1024 * 1024 * 1024)).toBe('3.00 GiB');
  });
});

describe('formatMicros', () => {
  it('reports each duration at a scale a person reads', () => {
    // Slow-log entries span four orders of magnitude; one unit would hide the outliers.
    expect(formatMicros(250)).toBe('250 µs');
    expect(formatMicros(2500)).toBe('2.5 ms');
    expect(formatMicros(2_500_000)).toBe('2.50 s');
  });
});

describe('formatDuration', () => {
  it('uses the coarsest unit that still fits', () => {
    expect(formatDuration(45)).toBe('45s');
    expect(formatDuration(120)).toBe('2m');
    expect(formatDuration(7200)).toBe('2h');
    expect(formatDuration(200_000)).toBe('2d');
  });
});

describe('formatPercent', () => {
  it('renders a fraction as a percentage', () => {
    expect(formatPercent(0.756)).toBe('75.6%');
  });
});
