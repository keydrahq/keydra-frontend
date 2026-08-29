import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLiveSamples } from '@app/Monitoring/useLiveSamples';
import { NotificationService } from '@app/Shared/Services/Notification.service';
import { ServiceContext, defaultServices } from '@app/Shared/Services/Services';
import type { MetricsSample } from '@app/Monitoring/types';
import type { ReactNode } from 'react';

const reading = (ops: number): MetricsSample => ({
  at: new Date(ops * 1000).toISOString(),
  memoryUsedBytes: 1,
  memoryPeakBytes: null,
  memoryMaxBytes: null,
  connectedClients: null,
  opsPerSecond: ops,
  totalCommands: null,
  keyspaceHits: null,
  keyspaceMisses: null,
  keyCount: null,
  uptimeSeconds: null,
  evictedKeys: null,
  expiredKeys: null,
});

const setup = (history: MetricsSample[] | undefined) => {
  const notifications = new NotificationService('/api/v1/notifications');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ServiceContext.Provider value={{ ...defaultServices, notifications }}>
      {children}
    </ServiceContext.Provider>
  );
  const rendered = renderHook(
    ({ seed }: { seed: MetricsSample[] | undefined }) => useLiveSamples(1, seed),
    { wrapper, initialProps: { seed: history } },
  );
  return { ...rendered, notifications };
};

const deliver = (notifications: NotificationService, connectionId: number, ops: number) =>
  act(() =>
    notifications.dispatch(
      JSON.stringify({
        category: 'MetricsSample',
        payload: { connectionId, sample: reading(ops) },
        ts: new Date(0).toISOString(),
      }),
    ),
  );

describe('useLiveSamples', () => {
  it('survives history that has not loaded yet', () => {
    // A fresh [] per render would compare unequal every time and set state during render,
    // which React stops with "too many re-renders" — the page then shows nothing at all.
    const { result, rerender } = setup(undefined);
    rerender({ seed: undefined });
    rerender({ seed: undefined });

    expect(result.current).toEqual([]);
  });

  it('starts from the history it was given', () => {
    const { result } = setup([reading(1), reading(2)]);

    expect(result.current.map((sample) => sample.opsPerSecond)).toEqual([1, 2]);
  });

  it('appends readings that arrive on the hub', () => {
    const { result, notifications } = setup([reading(1)]);

    deliver(notifications, 1, 2);

    expect(result.current.map((sample) => sample.opsPerSecond)).toEqual([1, 2]);
  });

  it('ignores readings for another target', () => {
    const { result, notifications } = setup([reading(1)]);

    deliver(notifications, 99, 2);

    expect(result.current).toHaveLength(1);
  });

  it('replaces what it holds when fresh history arrives', () => {
    const { result, rerender } = setup(undefined);

    rerender({ seed: [reading(7)] });

    expect(result.current.map((sample) => sample.opsPerSecond)).toEqual([7]);
  });
});
