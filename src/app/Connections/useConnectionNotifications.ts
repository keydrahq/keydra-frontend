import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { connectionsQueryKey } from './queries';

/**
 * The categories that change what the connections list says.
 *
 * <p>Named rather than "everything the hub carries". A target being sampled every second is not a
 * change to the list, and invalidating on it refetched every profile once a second for a status
 * that had not moved.
 */
const RELEVANT = [
  NotificationCategory.ConnectionCreated,
  NotificationCategory.ConnectionUpdated,
  NotificationCategory.ConnectionDeleted,
  NotificationCategory.ConnectionStatusChanged,
];

/**
 * Keeps the connections list in step with server-side changes.
 *
 * <p>Called by {@link useConnections} rather than by pages, so anything reading the list is
 * subscribed by the act of reading it. Several components asking at once is not a problem: they
 * share one cache entry, and invalidating it twice still refetches once.
 */
export const useConnectionNotifications = (): void => {
  const { notifications } = useContext(ServiceContext);
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: connectionsQueryKey });
    };
    const unsubscribes = RELEVANT.map((category) => notifications.subscribe(category, invalidate));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [notifications, queryClient]);
};
