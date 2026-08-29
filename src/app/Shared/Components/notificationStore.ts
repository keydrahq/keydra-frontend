import { createContext, useContext } from 'react';

export type NotificationVariant = 'success' | 'danger' | 'warning' | 'info';

export interface AppNotification {
  id: string;
  title: string;
  description?: string;
  variant: NotificationVariant;
  /** When it happened, for the drawer's relative timestamps. */
  at: Date;
  isRead: boolean;
}

export interface NotificationStore {
  /** Everything raised this session, newest first. */
  history: AppNotification[];
  unreadCount: number;
  notify: (notification: {
    title: string;
    description?: string;
    variant?: NotificationVariant;
  }) => void;
  markAllRead: () => void;
  dismiss: (id: string) => void;
  clear: () => void;
}

const noop = () => undefined;

/**
 * The store every part of the application reads notifications from.
 *
 * <p>Kept apart from the component that fills it because a module which exports both a component
 * and something else cannot be hot-reloaded on its own: React's fast refresh replaces the module,
 * and everything holding the old context loses it. The provider is a component; this is not.
 */
export const NotificationStoreContext = createContext<NotificationStore>({
  history: [],
  unreadCount: 0,
  notify: noop,
  markAllRead: noop,
  dismiss: noop,
  clear: noop,
});

export const useNotifications = (): NotificationStore => useContext(NotificationStoreContext);
