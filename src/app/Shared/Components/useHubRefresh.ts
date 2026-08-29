import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryKey } from '@tanstack/react-query';
import { ServiceContext } from '@app/Shared/Services/Services';

/**
 * Refetches a query when the server says the thing behind it changed.
 *
 * <p>This is what replaced a page full of timers. Every list that moves on its own was asking again
 * every fifteen seconds — the schedules, their runs, the alert rules, the migrations, a metrics
 * sample per target — which is a request per list per tab per quarter minute, for tables that
 * change a few times an hour. Most of those requests answered with exactly what the browser
 * already had.
 *
 * <p>The socket that makes this possible was already there and already open. Keydra broadcasts its
 * own state changes over one notification hub for the whole application, so the page does not have
 * to guess when to look: it is told, and asks once, when something actually happened.
 *
 * <p>Invalidate rather than patch. A broadcast says *that* something changed; working out what a
 * row should now say from a fragment of an event is how two representations of one thing drift
 * apart. The exception is a stream of progress for a job already on screen, which carries the whole
 * record and is applied directly — that one is in the migrations page, and it is the exception
 * because the event *is* the row.
 *
 * @param categories the hub categories worth reacting to
 * @param queryKey what to invalidate when one arrives — a prefix, as TanStack matches them
 */
export const useHubRefresh = (categories: string[], queryKey: QueryKey): void => {
  const { notifications } = useContext(ServiceContext);
  const queryClient = useQueryClient();
  // Joined so the effect keys on what the array says rather than on the array's identity, which a
  // caller writing it inline rebuilds on every render.
  const watched = categories.join('|');

  useEffect(() => {
    const unsubscribes = watched
      .split('|')
      .filter(Boolean)
      .map((category) =>
        notifications.subscribe(category, () => {
          void queryClient.invalidateQueries({ queryKey });
        }),
      );
    return () => unsubscribes.forEach((stop) => stop());
    // `queryKey` is an array a caller usually writes inline, so its contents rather than its
    // identity — the same reason `watched` is a string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications, queryClient, watched, JSON.stringify(queryKey)]);
};
