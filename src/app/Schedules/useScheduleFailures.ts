import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { schedulesQueryKey } from './queries';

/** What the hub sends when a run does not end well. */
interface FailurePayload {
  jobId: number;
  name: string;
  outcome: string;
  detail: string;
}

/**
 * A run that failed says so, wherever somebody happens to be.
 *
 * <p>Only the failures are broadcast — a schedule that works is not news, and one notification per
 * successful run every five minutes would bury the one that matters. This is the whole point of
 * moving a cron entry into Keydra: the first anybody hears of a broken schedule should not be the
 * empty cache it was supposed to be filling.
 */
export const useScheduleFailures = (): void => {
  const { t } = useTranslation();
  const { notifications } = useContext(ServiceContext);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  useEffect(
    () =>
      notifications.subscribe<FailurePayload>(
        NotificationCategory.ScheduleFailed,
        ({ payload }) => {
          notify({
            title: t('Schedules.FAILED_NOTICE', { name: payload.name }),
            description: payload.detail || undefined,
            // Refused is not a failure: nothing went wrong, and the fix is a grant rather
            // than an investigation.
            variant: payload.outcome === 'REFUSED' ? 'warning' : 'danger',
          });
          // The row's outcome column has just changed, and so has its history.
          void queryClient.invalidateQueries({ queryKey: schedulesQueryKey });
        },
      ),
    [notifications, notify, queryClient, t],
  );
};
