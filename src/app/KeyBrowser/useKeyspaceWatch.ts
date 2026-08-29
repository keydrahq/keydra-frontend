import { ServiceContext } from '@app/Shared/Services/Services';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { useContext, useEffect, useRef, useState } from 'react';
import { keysApi } from './api';
import type { KeyspaceWatchState } from './types';

/**
 * How often the lease is renewed.
 *
 * <p>Well inside the server's own two minutes, and deliberately not close to it. A tab that was
 * throttled in the background for half a minute should come back to a watch that is still open,
 * not to one that lapsed while nothing was wrong.
 */
const RENEW_EVERY = 45_000;

export const keyspaceWatchQueryKey = (connectionId: number, database?: number) =>
  ['keyspace-watch', connectionId, database ?? 0] as const;

/**
 * Holds a watch on a target's own changes for as long as this page is open.
 *
 * <p>A lease rather than a subscription the page owns. A browser can vanish — a closed laptop, a
 * lost network — and a watch belonging to a page that never says goodbye is a connection held open
 * on the server forever. So this takes a lease, renews it while the page is mounted, and gives it
 * back on the way out; one that is never given back lapses on its own.
 *
 * <p>What arrives when something changes does not come back through here. It goes out over the
 * notification hub as {@code KeysChanged}, which is what the key list and the database counts have
 * listened for since they were written — so the only thing this hook does is make that message
 * start telling the truth about changes Keydra did not make.
 */
/**
 * @param watching keys this page has open, which are always reported when they change however full
 *   the batch's sample was. A list on its own passes nothing; the detail panel passes the key it is
 *   showing.
 */
export const useKeyspaceWatch = (
  connectionId: number,
  database?: number,
  watching?: readonly string[],
): UseQueryResult<KeyspaceWatchState, Error> => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  const lease = useRef<string | null>(null);
  /*
   * Read from a ref inside the query rather than put in the key. What a lease is looking at changes
   * every time somebody opens a different key, and a query key that changed with it would release
   * and retake the lease on every click — which is the connection churn the lease exists to avoid.
   * The next renewal carries the new list, and until then the sample is what it always was.
   */
  const looking = useRef<readonly string[]>([]);

  const watch = useQuery({
    queryKey: keyspaceWatchQueryKey(connectionId, database),
    queryFn: async () => {
      const state = await keysApi.holdKeyspaceWatch(
        graphql,
        connectionId,
        database,
        lease.current,
        looking.current,
      );
      lease.current = state.leaseId;
      return state;
    },
    refetchInterval: RENEW_EVERY,
    // The renewal is the point, so it goes on happening in a tab nobody is looking at — a watch
    // that lapsed because somebody switched tabs would come back to a list that had quietly
    // stopped updating, which is the failure this is here to prevent.
    refetchIntervalInBackground: true,
    // A target that cannot be watched is not worth asking about again on every remount.
    staleTime: RENEW_EVERY,
  });

  /*
   * And say so now rather than at the next renewal. A lease is renewed every forty-five seconds,
   * which is the right cadence for "I am still here" and far too slow for "I am looking at this
   * one": a key opened would go unwatched for most of a minute, which is most of the time anybody
   * spends looking at it.
   */
  const looksLike = (watching ?? []).join('\u0000');
  const { refetch } = watch;
  useEffect(() => {
    looking.current = looksLike === '' ? [] : looksLike.split('\u0000');
    void refetch();
    // Keyed on what the list says rather than on the array, which a caller writing it inline
    // rebuilds on every render — the same reason `useHubRefresh` joins its categories.
  }, [refetch, looksLike]);

  /*
   * Giving the lease back, which is a courtesy rather than a requirement: the server drops a lease
   * nobody renews. Doing it anyway means a browser that closes tidily releases the connection now
   * instead of in two minutes, and a target nobody is browsing stops being subscribed to.
   *
   * Keyed on the identifiers rather than on the query, so that changing database releases the watch
   * on the one being left.
   */
  useEffect(() => {
    const held = lease;
    return () => {
      if (held.current) {
        void keysApi
          .releaseKeyspaceWatch(graphql, connectionId, database, held.current)
          .catch(() => undefined);
        held.current = null;
      }
      queryClient.removeQueries({ queryKey: keyspaceWatchQueryKey(connectionId, database) });
    };
  }, [graphql, queryClient, connectionId, database]);

  return watch;
};

/**
 * Asks the target to start announcing its changes.
 *
 * <p>A different act from watching: this changes a running server's configuration, so it is offered
 * only to somebody who may do that. What it writes is the union of what the setting already said
 * and what a watch needs — a server already announcing something goes on announcing it.
 */
export const useAnnounceKeyspaceChanges = (connectionId: number, database?: number) => {
  const { graphql } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => keysApi.announceKeyspaceChanges(graphql, connectionId, database),
    onSuccess: (state) =>
      queryClient.setQueryData(keyspaceWatchQueryKey(connectionId, database), state),
  });
};

/** What a KeysChanged envelope carries when the target is the one that said it. */
interface KeysChangedPayload {
  connectionId?: number;
  database?: number;
  /** "target" when the store announced it; absent when Keydra was the one that changed it. */
  source?: string;
  /** Some of the keys that changed, up to the server's sample limit. */
  keys?: string[];
  /** Whether there were more than the sample holds, so the list above is not the whole of it. */
  sampled?: boolean;
  /**
   * What happened to the keys somebody has open, which the sample is not allowed to answer for.
   *
   * <p>Key to the last event in the batch. An empty object means none of the watched keys moved,
   * and unlike an overflowed sample that is a fact rather than a silence.
   */
  watched?: Record<string, string>;
}

/**
 * The least time between two walks of the keyspace.
 *
 * <p>The server coalesces into a message every couple of seconds, which is the right cadence for
 * news and the wrong one for acting on it: a busy cache would have this page re-scanning the
 * keyspace every two seconds for as long as it stayed open, which is heavier than the polling this
 * replaces. So changes that arrive during a walk's shadow are folded into one walk at the end of
 * it. The list is at most this far behind, never further.
 */
const RESCAN_NOT_MORE_OFTEN_THAN = 5_000;

/**
 * Calls back when the target says something changed under what this page is showing.
 *
 * <p>Only what the target said. Keydra's own mutations already refresh what they changed where
 * they are made — the page knows it deleted something and does not need to be told — and acting on
 * both would do the work twice for one change.
 *
 * <p>A subscription rather than {@link useHubRefresh} because what has to happen is not one cache
 * invalidation: the key list is a stream with no cache entry at all, and the namespace tree beside
 * it is a query. The caller knows which of its own things went stale; this only says when.
 *
 * @param prefix the namespace this page is looking at, used to ignore changes somewhere else
 * @param isSearching whether a glob in the search box has replaced the prefix as what decides
 *   which keys are listed, in which case the prefix rules nothing out
 */
export const useRestartOnKeyspaceChange = (
  connectionId: number,
  database: number,
  prefix: string,
  isSearching: boolean,
  onChanged: () => void,
): void => {
  const { notifications } = useContext(ServiceContext);
  const lastRescan = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const rescan = () => {
      lastRescan.current = Date.now();
      pending.current = null;
      onChanged();
    };

    const stop = notifications.subscribe<KeysChangedPayload>(
      NotificationCategory.KeysChanged,
      (message) => {
        const payload = message.payload;
        if (payload?.source !== 'target') {
          return;
        }
        // A change in another database, or on another target, is somebody else's news. The hub
        // already keeps a viewer from hearing about targets they cannot see; this is the narrower
        // question of whether it is about what is on this screen.
        if (payload.connectionId !== connectionId || payload.database !== database) {
          return;
        }
        /*
         * And whether it is about the part of the keyspace being shown. Ruled out only when the
         * server sent the whole of what changed — an overflowed sample cannot say that the prefix
         * was absent from the part it dropped — and only when the prefix is what narrows this list.
         * A glob in the search box is not used for the same reason: a matcher written here that
         * disagreed with the server's would skip a refresh that was needed, and being wrong in that
         * direction is a list that lies.
         */
        if (prefix && !isSearching && payload.sampled === false && payload.keys) {
          if (!payload.keys.some((key) => key.startsWith(prefix))) {
            return;
          }
        }
        if (pending.current) {
          return;
        }
        const since = Date.now() - lastRescan.current;
        if (since >= RESCAN_NOT_MORE_OFTEN_THAN) {
          rescan();
        } else {
          pending.current = setTimeout(rescan, RESCAN_NOT_MORE_OFTEN_THAN - since);
        }
      },
    );

    return () => {
      stop();
      if (pending.current) {
        clearTimeout(pending.current);
        pending.current = null;
      }
    };
  }, [notifications, connectionId, database, prefix, isSearching, onChanged]);
};

/**
 * What has happened to one key since somebody last looked, or nothing.
 *
 * <p>Reported rather than acted on. A notification from a store is a hint — dropped when a
 * subscriber falls behind, never sent while nobody was listening — so this never carries a value
 * and never replaces one. What it says is that the key moved, and what is on the screen is always
 * something Keydra read.
 *
 * <p>Nothing is reloaded on its own. The value may be in a box somebody is typing in, and this hook
 * cannot tell a reader from an editor — the draft lives inside whichever editor the type selected.
 * Guessing is how somebody's work is lost to an event that was only ever advisory, so the answer is
 * a sentence and a button.
 */
export const useKeyChanged = (
  connectionId: number,
  database: number,
  key: string | undefined,
): { event: string | undefined; clear: () => void } => {
  const { notifications } = useContext(ServiceContext);
  const [event, setEvent] = useState<string | undefined>();

  // Cleared when the panel moves to another key, so a notice about the last one is never read as
  // being about this one.
  const [was, setWas] = useState(key);
  if (was !== key) {
    setWas(key);
    setEvent(undefined);
  }

  useEffect(() => {
    if (!key) {
      return undefined;
    }
    return notifications.subscribe<KeysChangedPayload>(
      NotificationCategory.KeysChanged,
      (message) => {
        const payload = message.payload;
        if (payload?.connectionId !== connectionId || payload.database !== database) {
          return;
        }
        const happened = payload.watched?.[key];
        if (happened) {
          setEvent(happened);
        }
      },
    );
  }, [notifications, connectionId, database, key]);

  return { event, clear: () => setEvent(undefined) };
};
