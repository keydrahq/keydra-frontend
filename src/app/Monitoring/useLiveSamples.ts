import { useContext, useEffect, useState } from 'react';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import type { MetricsSample, MetricsSamplePayload } from './types';

/**
 * How many readings the chart holds.
 *
 * <p>Matched to what the server retains, so scrolling back on the client cannot promise more
 * history than the server kept.
 */
export const MAX_SAMPLES = 720;

/**
 * Stands in for "no history yet".
 *
 * <p>A module-level constant rather than a fresh `[]` at each call site, because this value is
 * compared by identity below. A new empty array per render makes that comparison always true,
 * which sets state during every render — React stops that with "too many re-renders", and the
 * page renders nothing at all.
 */
const NO_SAMPLES: MetricsSample[] = [];

/**
 * Readings as they arrive, seeded with what the server already had.
 *
 * <p>Live over the hub rather than polled: the dashboard's whole point is that it updates without
 * the UI asking, which is the phase's acceptance criterion.
 */
export const useLiveSamples = (
  connectionId: number,
  history: MetricsSample[] | undefined,
): MetricsSample[] => {
  const { notifications } = useContext(ServiceContext);
  // Normalised once, to the shared constant, so "no history" has one identity.
  const initial = history ?? NO_SAMPLES;
  const [samples, setSamples] = useState<MetricsSample[]>(initial);
  const [seededFrom, setSeededFrom] = useState(initial);

  // A fresh page of history replaces what is held — starting monitoring, or switching
  // target, both arrive this way. Adjusted during render so the chart never paints one
  // target's history under another's heading.
  if (seededFrom !== initial) {
    setSeededFrom(initial);
    setSamples(initial);
  }

  useEffect(
    () =>
      notifications.subscribe<MetricsSamplePayload>(
        NotificationCategory.MetricsSample,
        ({ payload }) => {
          if (payload.connectionId !== connectionId) {
            return;
          }
          setSamples((current) => [...current, payload.sample].slice(-MAX_SAMPLES));
        },
      ),
    [connectionId, notifications],
  );

  return samples;
};
