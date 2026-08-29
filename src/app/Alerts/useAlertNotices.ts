import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { alertsQueryKey } from './queries';
import { EventKind } from './types';
import type { AlertNotice } from './types';
import { readingOf } from './wording';

/**
 * A rule that fires says so, wherever somebody happens to be.
 *
 * <p>The whole point of the phase. Everything else Keydra does needs a person in front of it; this
 * is the one thing that goes looking for the person — and it works with the Alerts page closed,
 * because the socket has been open since the application started.
 *
 * <p>Both transitions arrive, unlike the schedules where only failures are broadcast. The second
 * one is the message that lets somebody stop worrying, and it is worth as much as the first.
 */
export const useAlertNotices = (): void => {
  const { t } = useTranslation();
  const { notifications } = useContext(ServiceContext);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      notifications.subscribe<AlertNotice>(NotificationCategory.AlertChanged, ({ payload }) => {
        const target = payload.connectionName ?? String(payload.connectionId ?? '');
        notify({
          title:
            payload.kind === EventKind.Fired
              ? t('Alerts.FIRED_NOTICE', { name: payload.ruleName, target })
              : t('Alerts.CLEARED_NOTICE', { name: payload.ruleName, target }),
          description: readingOf(payload, t),
          variant: payload.kind === EventKind.Fired ? 'danger' : 'success',
        });
        // The rule's state and the history have both just changed.
        void queryClient.invalidateQueries({ queryKey: alertsQueryKey });
      }),
    [notifications, notify, queryClient, t],
  );
};
