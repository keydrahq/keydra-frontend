import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { connectionsQueryKey } from '@app/Connections/queries';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { ConnectionState, NotificationCategory } from '@app/Shared/Services/api.types';
import type { ConnectionResponse, ConnectionStatus } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';

interface StatusPayload {
  id: number;
  /** The profile's name, sent with the event so a listener need not have loaded the list. */
  name: string;
  status: ConnectionStatus;
  /**
   * What the target last settled at, or null when this is the first news of it.
   *
   * <p>Never 'CONNECTING': the server reports the last state the target actually reached, so a
   * re-check passing through "asking" is not mistaken for a target that went away and returned.
   */
  previousState: ConnectionState | null;
}

/**
 * Turns server-side events into notifications the user can see.
 *
 * <p>Only up and down are raised, and only when they are a change of mind. The backend broadcasts
 * every real status change, which includes the "checking now" step and the first time it hears
 * anything at all about a target — announcing those would bury the two transitions that matter, and
 * signing in would greet everybody with one success toast per target that was never down.
 *
 * <p>So a target coming up is worth saying only if it was down, and a target going down only if it
 * was up. Everything else is the badge's job, and the badge is updated from the same event either
 * way.
 *
 * <p>Each notification names its target. Two targets coming up at once are two events, and without
 * the name they read as the same one sent twice.
 */
export const useHubNotifications = (): void => {
  const { t } = useTranslation();
  const { notifications } = useContext(ServiceContext);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      notifications.subscribe<StatusPayload>(
        NotificationCategory.ConnectionStatusChanged,
        ({ payload }) => {
          // The event carries the name. The cache is consulted only for an event sent
          // before the server started including one.
          const known = queryClient.getQueryData<ConnectionResponse[]>(connectionsQueryKey);
          const name =
            payload.name ||
            known?.find((connection) => connection.id === payload.id)?.name ||
            t('Notifications.UNNAMED_TARGET', { id: payload.id });

          if (
            payload.status.state === ConnectionState.Up &&
            payload.previousState === ConnectionState.Down
          ) {
            notify({
              title: t('Notifications.CONNECTION_UP', { name }),
              description: payload.status.server
                ? `${payload.status.server.flavor} ${payload.status.server.version ?? ''}`.trim()
                : undefined,
              variant: 'success',
            });
          }
          if (
            payload.status.state === ConnectionState.Down &&
            payload.previousState === ConnectionState.Up
          ) {
            notify({
              title: t('Notifications.CONNECTION_DOWN', { name }),
              description: payload.status.message ?? undefined,
              variant: 'danger',
            });
          }
        },
      ),
    [notifications, notify, queryClient, t],
  );
};
