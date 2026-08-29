import type { FC, ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, AlertActionCloseButton, AlertGroup } from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { NotificationStoreContext } from './notificationStore';
import type { AppNotification, NotificationStore } from './notificationStore';

/** How long a toast stays on screen before PatternFly retires it. */
const TOAST_TIMEOUT_MS = 6000;

/**
 * Raises transient toasts and keeps the history behind them.
 *
 * <p>Two lists rather than one: a toast is an interruption and must leave on its own, but the
 * record of what happened should not. Anything dismissed from the corner is still in the
 * notification drawer, which is the difference between telling someone and expecting them to have
 * been looking.
 */
export const NotificationProvider: FC<{ children?: ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const [history, setHistory] = useState<AppNotification[]>([]);
  const [toasts, setToasts] = useState<AppNotification[]>([]);
  // A counter, not a timestamp: two notifications raised in the same millisecond
  // would otherwise share an id and React would treat them as one.
  const nextId = useRef(0);

  const notify = useCallback<NotificationStore['notify']>(
    ({ title, description, variant = 'info' }) => {
      nextId.current += 1;
      const notification: AppNotification = {
        id: `keydra-notification-${nextId.current}`,
        title,
        description,
        variant,
        at: new Date(),
        isRead: false,
      };
      setHistory((current) => [notification, ...current]);
      setToasts((current) => [...current, notification]);
    },
    [],
  );

  const store = useMemo<NotificationStore>(
    () => ({
      history,
      unreadCount: history.filter((notification) => !notification.isRead).length,
      notify,
      markAllRead: () =>
        setHistory((current) => current.map((item) => ({ ...item, isRead: true }))),
      dismiss: (id) => setHistory((current) => current.filter((item) => item.id !== id)),
      clear: () => setHistory([]),
    }),
    [history, notify],
  );

  const retire = (id: string) => setToasts((current) => current.filter((item) => item.id !== id));

  return (
    <NotificationStoreContext.Provider value={store}>
      {children}
      <AlertGroup isToast isLiveRegion aria-label={t('Notifications.TOASTS')}>
        {toasts.map((toast) => (
          <Alert
            key={toast.id}
            variant={toast.variant}
            title={toast.title}
            timeout={TOAST_TIMEOUT_MS}
            onTimeout={() => retire(toast.id)}
            actionClose={
              <AlertActionCloseButton
                title={toast.title}
                aria-label={t('Notifications.DISMISS')}
                onClose={() => retire(toast.id)}
              />
            }
          >
            {toast.description}
          </Alert>
        ))}
      </AlertGroup>
    </NotificationStoreContext.Provider>
  );
};
