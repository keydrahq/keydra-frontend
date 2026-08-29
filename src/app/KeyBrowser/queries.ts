import { useContext } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult, UseQueryResult } from '@tanstack/react-query';
import { useHubRefresh } from '@app/Shared/Components/useHubRefresh';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { keysApi } from './api';
import type {
  DatabaseSummary,
  ExportRequest,
  ExportedKey,
  ImportResult,
  KeyOperationResult,
} from './types';

/**
 * What identifies a cached keyspace.
 *
 * <p>The database is part of it: db 0 and db 3 of one target are different keyspaces, and a cache
 * that could not tell them apart would show one under the other's heading.
 */
export const keysQueryKey = (connectionId: number, database?: number) =>
  ['keys', connectionId, database ?? 'default'] as const;

export const databasesQueryKey = (connectionId: number) => ['databases', connectionId] as const;

/**
 * The databases a target holds, with how many keys are in each.
 *
 * <p>Refreshed when keys change, which is what the count is for and what it was not doing: the
 * number beside the database was read once when the browser opened and then sat there while
 * somebody added and deleted keys in front of it. The hub is what says they changed — so this
 * also picks up what somebody else did, which polling the count on our own mutations would not.
 */
export const useDatabases = (connectionId: number): UseQueryResult<DatabaseSummary[], Error> => {
  const { graphql } = useContext(ServiceContext);
  useHubRefresh(
    [NotificationCategory.KeysChanged, NotificationCategory.ValueChanged],
    databasesQueryKey(connectionId),
  );
  return useQuery({
    queryKey: databasesQueryKey(connectionId),
    queryFn: () => keysApi.databases(graphql, connectionId),
  });
};

/** What a delete is asked for: the keys, and the target's name where the target asks for it. */
export interface DeleteKeysAsked {
  keys: string[];
  confirmTarget?: string;
}

export const useDeleteKeys = (
  connectionId: number,
  database?: number,
): UseMutationResult<KeyOperationResult, Error, DeleteKeysAsked> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (asked: DeleteKeysAsked) =>
      keysApi.remove(graphql, connectionId, asked.keys, database, asked.confirmTarget),
    // Namespace counts change with the keys, so the tree is stale too.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) }),
  });
};

/** What a purge is asked for: the glob, and the target's name where the target asks for it. */
export interface PurgeAsked {
  match: string;
  confirmTarget?: string;
}

export const usePurgeKeys = (
  connectionId: number,
  database?: number,
): UseMutationResult<KeyOperationResult, Error, PurgeAsked> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (asked: PurgeAsked) =>
      keysApi.purge(graphql, connectionId, asked.match, database, asked.confirmTarget),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) }),
  });
};

export const useRenameKey = (
  connectionId: number,
  database?: number,
): UseMutationResult<KeyOperationResult, Error, { from: string; to: string; replace: boolean }> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to, replace }: { from: string; to: string; replace: boolean }) =>
      keysApi.rename(graphql, connectionId, from, to, replace, database),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) }),
  });
};

export const useCopyKey = (
  connectionId: number,
  database?: number,
): UseMutationResult<KeyOperationResult, Error, { from: string; to: string; replace: boolean }> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ from, to, replace }: { from: string; to: string; replace: boolean }) =>
      keysApi.copy(graphql, connectionId, from, to, replace, database),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) }),
  });
};

export const useExpireKey = (
  connectionId: number,
  database?: number,
): UseMutationResult<KeyOperationResult, Error, { key: string; ttlSeconds: number | null }> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, ttlSeconds }: { key: string; ttlSeconds: number | null }) =>
      keysApi.expire(graphql, connectionId, key, ttlSeconds, database),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) }),
  });
};

/**
 * Exports keys and hands back what the server serialised.
 *
 * <p>A mutation rather than a query: it is a request the user makes once, with a body, and caching
 * a snapshot of a keyspace under a query key would only serve it again when it is already stale.
 */
export const useExportKeys = (
  connectionId: number,
  database?: number,
): UseMutationResult<ExportedKey[], Error, ExportRequest> => {
  const { api } = useContext(ServiceContext);
  return useMutation({
    mutationFn: (request: ExportRequest) => keysApi.export(api, connectionId, request, database),
  });
};

/** What an import is asked for, with the target's name where the target asks for it. */
export interface ImportAsked {
  keys: ExportedKey[];
  replace: boolean;
  confirmTarget?: string;
}

export const useImportKeys = (
  connectionId: number,
  database?: number,
): UseMutationResult<ImportResult, Error, ImportAsked> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keys, replace, confirmTarget }: ImportAsked) =>
      keysApi.import(graphql, connectionId, keys, replace, database, confirmTarget),
    // The keyspace has changed, so whatever the browser is showing is now behind it.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId, database) }),
  });
};
