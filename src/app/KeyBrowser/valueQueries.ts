import { useContext } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  UseInfiniteQueryResult,
  UseMutationResult,
  UseQueryResult,
} from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';
import { keysQueryKey } from './queries';
import { valuesApi } from './valueApi';
import type { MutationResult, ValueMutation, ValuePage } from './valueTypes';

/** One key's value, under its connection's subtree so a key mutation can drop both. */
export const valueQueryKey = (connectionId: number, key: string, encoding: string) =>
  [...keysQueryKey(connectionId), 'value', key, encoding] as const;

/** Where a collection read starts; the backend's ValueQuery.CURSOR_START. */
const CURSOR_START = '0';

/**
 * Reads a value, page by page.
 *
 * <p>An infinite query rather than a plain one because a value is not necessarily small: a hash
 * with a million fields arrives a page at a time, and the editor asks for the next page only when
 * the user scrolls to it. `cursor: null` means the value has been read to its end, which is what
 * stops the paging.
 */
export const useValue = (
  connectionId: number,
  key: string | undefined,
  encoding: string,
): UseInfiniteQueryResult<{ pages: ValuePage[] }, Error> => {
  const { api } = useContext(ServiceContext);
  return useInfiniteQuery({
    queryKey: valueQueryKey(connectionId, key ?? '', encoding),
    enabled: key !== undefined,
    initialPageParam: CURSOR_START,
    queryFn: ({ pageParam }) =>
      valuesApi.read(api, connectionId, {
        key: key as string,
        cursor: pageParam,
        encoding: encoding || undefined,
      }),
    getNextPageParam: (last) => last.cursor ?? undefined,
    // A value can change under us at any moment, so a page kept from a previous
    // visit would be presented as current when it is not.
    staleTime: 0,
    gcTime: 0,
  });
};

export const useEncodings = (connectionId: number): UseQueryResult<string[], Error> => {
  const { api } = useContext(ServiceContext);
  return useQuery({
    queryKey: [...keysQueryKey(connectionId), 'encodings'],
    queryFn: () => valuesApi.encodings(api, connectionId),
    // The decoder chain is fixed at build time; refetching it per key would be waste.
    staleTime: Infinity,
  });
};

/**
 * Applies one edit.
 *
 * <p>Invalidates the whole connection subtree rather than patching the cached page: an edit can
 * change a collection's length, its paging boundaries and the key's own metadata at once, and a
 * patched page would show a value the server does not hold.
 */
export const useMutateValue = (
  connectionId: number,
): UseMutationResult<MutationResult, Error, ValueMutation> => {
  const { api } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mutation: ValueMutation) => valuesApi.mutate(api, connectionId, mutation),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keysQueryKey(connectionId) }),
  });
};
