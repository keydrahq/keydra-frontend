import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { consoleApi } from './api';
import type { AskableCommand, HistoryEntry } from './types';

export const consoleQueryKey = (connectionId: number) => ['console', connectionId] as const;

export const useCommandHistory = (connectionId: number): UseQueryResult<HistoryEntry[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...consoleQueryKey(connectionId), 'history'],
    queryFn: () => consoleApi.history(graphql, connectionId),
  });
};

export const useClearHistory = (connectionId: number): UseMutationResult<boolean, Error, void> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => consoleApi.clearHistory(graphql, connectionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: consoleQueryKey(connectionId) }),
  });
};

/**
 * Commands this target will refuse.
 *
 * <p>Fetched so the console can say why a command will not run before spending a round trip on
 * being told. Per target since phase 58: a profile can allow a command that the instance refuses,
 * so what this answers is about the server on the other end rather than about this Keydra.
 *
 * <p>Which is also why it is no longer fetched once and kept forever. It is a property of a
 * profile, and a profile is edited — so this listens for that and asks again, rather than greying
 * out a command somebody has just been allowed to run.
 */
export const useDeniedCommands = (connectionId: number): UseQueryResult<string[], Error> => {
  const { graphql } = useContext(ServiceContext);
  useHubRefresh(
    [NotificationCategory.ConnectionUpdated],
    [...consoleQueryKey(connectionId), 'denied'],
  );
  return useQuery({
    queryKey: [...consoleQueryKey(connectionId), 'denied'],
    queryFn: () => consoleApi.deniedCommands(graphql, connectionId),
    staleTime: Infinity,
  });
};

/**
 * The commands a target can be allowed to run.
 *
 * <p>A constant of the build rather than of the installation, so it is fetched once and kept. Used
 * by the connection form, which is why it lives here beside the console's own queries rather than
 * in the connections feature: what may be allowed is the console's business, and the form is only
 * where somebody says it.
 */
export const useAskableCommands = (): UseQueryResult<AskableCommand[], Error> => {
  const { graphql } = useContext(ServiceContext);
  return useQuery({
    queryKey: ['console', 'askable'],
    queryFn: () => consoleApi.askableCommands(graphql),
    staleTime: Infinity,
  });
};
