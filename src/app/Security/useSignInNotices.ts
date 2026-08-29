import { useContext, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { anomalyLabel, countryLabel } from '@app/Shared/Components/signInLabels';
import { NotificationCategory } from '@app/Shared/Services/api.types';
import { ServiceContext } from '@app/Shared/Services/Services';
import { flaggedSignInsKey } from '@app/Settings/signInQueries';

/** What the hub sends when a sign-in is flagged. */
interface FlaggedSignIn {
  username: string;
  network: string | null;
  country: string | null;
  at: string;
  anomalies: string[];
}

/**
 * A sign-in worth looking at says so, wherever somebody happens to be.
 *
 * <p>The reason the checks are worth running at all. Nobody opens a sign-in page to see whether
 * anything has gone wrong; something has to come and say so, and the socket has been open since
 * the application started.
 *
 * <p>Shown only to somebody who may read the audit log, because it names an account other than
 * theirs. That is a decision about who is told rather than about who may look it up — the query
 * behind the page carries the same permission — and the two agree on purpose.
 *
 * @param mayRead whether this person may see other people's sign-ins
 */
export const useSignInNotices = (mayRead: boolean): void => {
  const { t } = useTranslation();
  const { notifications } = useContext(ServiceContext);
  const { notify } = useNotifications();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!mayRead) {
      return undefined;
    }
    return notifications.subscribe<FlaggedSignIn>(
      NotificationCategory.SignInFlagged,
      ({ payload }) => {
        const where =
          [countryLabel(payload.country), payload.network].filter(Boolean).join(' · ') ||
          t('SignIns.UNKNOWN_PLACE');
        notify({
          title: t('SignIns.FLAGGED_TOAST_TITLE'),
          description: t('SignIns.FLAGGED_TOAST_BODY', {
            username: payload.username,
            where,
            what: payload.anomalies.map((one) => anomalyLabel(t, one)).join(', '),
          }),
          // A warning rather than a danger. It is a correct password from an unfamiliar place,
          // which is a new laptop more often than it is anything else — and an alert drawn as a
          // catastrophe every time somebody travels is one people learn to dismiss.
          variant: 'warning',
        });
        void queryClient.invalidateQueries({ queryKey: flaggedSignInsKey });
      },
    );
  }, [mayRead, notifications, notify, queryClient, t]);
};
