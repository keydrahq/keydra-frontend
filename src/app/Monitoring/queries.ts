import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import { monitoringApi } from './api';
import type {
  BigKeysReport,
  ClientConnection,
  MetricsHistory,
  MetricsSample,
  MonitoringState,
  SlowCommand,
} from './types';

export const monitoringQueryKey = (connectionId: number) => ['monitoring', connectionId] as const;

/**
 * One reading of a target's vital signs, for callers that want the numbers without starting a
 * sampler — the connection list draws a summary per card.
 *
 * <p>Refetched on an interval rather than pushed: these are a glance, not a chart, and a socket
 * per card would cost more than the numbers are worth. Disabled while the target is down, because
 * a reading from an unreachable server is an error, not a zero.
 */
export const useConnectionVitals = (
  connectionId: number,
  enabled: boolean,
): UseQueryResult<MetricsSample, Error> => {
  const { graphql } = useContext(ServiceContext);
  // A target being sampled broadcasts every reading it takes. Asking again every fifteen seconds
  // beside that was a second clock running against the same numbers.
  useHubRefresh(
    [NotificationCategory.MetricsSample, NotificationCategory.MonitoringChanged],
    ['monitoring', connectionId, 'sample'],
  );
  return useQuery({
    queryKey: ['monitoring', connectionId, 'sample'],
    queryFn: () => monitoringApi.sample(graphql, connectionId),
    enabled,
    // A stale reading is better than an empty card while the next one is in flight.
    placeholderData: (previous) => previous,
  });
};

export const useMonitoringState = (
  connectionId: number,
): UseQueryResult<MonitoringState, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: monitoringQueryKey(connectionId),
    queryFn: () => monitoringApi.state(graphql, connectionId),
  });
};

/**
 * A window of readings, from wherever can answer it.
 *
 * <p>Asked for as an absolute range rather than "the last day", so the answer does not shift under
 * a chart that is being looked at. Refetched slowly: a month of buckets does not change second by
 * second, and the live readings arrive over the socket anyway.
 */
export const useMetricsHistory = (
  connectionId: number,
  windowSeconds: number,
  enabled: boolean,
): UseQueryResult<MetricsHistory, Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    // Keyed by the window rather than by its ends: the ends move with the clock, and a key
    // that moves with the clock is a new cache entry every render rather than a refresh of
    // one. Reading the clock is the fetch's business, not the render's.
    queryKey: [...monitoringQueryKey(connectionId), 'history', windowSeconds],
    queryFn: () => {
      const to = new Date(Math.floor(Date.now() / 60_000) * 60_000);
      const from = new Date(to.getTime() - windowSeconds * 1000);
      return monitoringApi.history(
        graphql,
        connectionId,
        from.toISOString(),
        to.toISOString(),
        240,
      );
    },
    enabled,
    // A minute is a long window and the chart draws a long one; what makes it move is a new
    // reading, and a new reading says so.
  });
};

export const useStartMonitoring = (
  connectionId: number,
): UseMutationResult<MonitoringState, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => monitoringApi.start(graphql, connectionId),
    onSuccess: (state) => queryClient.setQueryData(monitoringQueryKey(connectionId), state),
  });
};

export const useStopMonitoring = (
  connectionId: number,
): UseMutationResult<boolean, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => monitoringApi.stop(graphql, connectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: monitoringQueryKey(connectionId) }),
  });
};

/**
 * The slow log.
 *
 * <p>Refetched on demand rather than on a timer: entries appear only when something was slow, and
 * polling a log that is usually unchanged is the kind of background traffic monitoring is supposed
 * to help someone avoid.
 */
export const useSlowCommands = (connectionId: number): UseQueryResult<SlowCommand[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...monitoringQueryKey(connectionId), 'slowlog'],
    queryFn: () => monitoringApi.slowlog(graphql, connectionId),
  });
};

export const useClearSlowCommands = (
  connectionId: number,
): UseMutationResult<boolean, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => monitoringApi.clearSlowlog(graphql, connectionId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...monitoringQueryKey(connectionId), 'slowlog'] }),
  });
};

export const useClients = (connectionId: number): UseQueryResult<ClientConnection[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...monitoringQueryKey(connectionId), 'clients'],
    queryFn: () => monitoringApi.clients(graphql, connectionId),
  });
};

/**
 * Disconnects one client.
 *
 * <p>Answers whether the store had a client with that id — false is not a failure, it is a client
 * that had already gone. The hook used to declare it returned nothing, which was not true of it and
 * threw the one piece of information the mutation carries away at the type level.
 */
export const useKillClient = (connectionId: number): UseMutationResult<boolean, Error, string> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => monitoringApi.killClient(graphql, connectionId, clientId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [...monitoringQueryKey(connectionId), 'clients'] }),
  });
};

/**
 * The largest keys in a sample.
 *
 * <p>Never fetched on mount: measuring costs a round trip per key, so it runs when someone asks
 * for it and not because they opened a page.
 */
export const useBigKeys = (
  connectionId: number,
): UseMutationResult<BigKeysReport, Error, { sample: number; top: number }> => {
  const { graphql } = useContext(ServiceContext);
  return useMutation({
    mutationFn: ({ sample, top }: { sample: number; top: number }) =>
      monitoringApi.bigKeys(graphql, connectionId, sample, top),
  });
};
