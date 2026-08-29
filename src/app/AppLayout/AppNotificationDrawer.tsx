import type { FC } from 'react';
import {
  Button,
  Dropdown,
  DropdownItem,
  DropdownList,
  EmptyState,
  EmptyStateBody,
  MenuToggle,
  NotificationDrawer,
  NotificationDrawerBody,
  NotificationDrawerGroup,
  NotificationDrawerHeader,
  NotificationDrawerList,
  NotificationDrawerListItem,
  NotificationDrawerListItemBody,
  NotificationDrawerListItemHeader,
} from '@patternfly/react-core';
import { EllipsisVIcon } from '@patternfly/react-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import type { AppNotification } from '@app/Shared/Components/notificationStore';

export interface AppNotificationDrawerProps {
  onClose: () => void;
}

/**
 * The groups, in the order somebody scans them.
 *
 * <p>Problems first: a drawer is opened because something happened, and what went wrong is what
 * they came for. Information last, because it is the one nobody opened the drawer to read.
 */
const GROUPS = ['danger', 'warning', 'success', 'info'] as const;

/** How often the relative timestamps are refreshed while the drawer is open. */
const TICK_MS = 30_000;

/** Relative time, so "2 minutes ago" survives a page left open across midnight. */
const relative = (at: Date, now: number): string => {
  const seconds = Math.max(0, Math.round((now - at.getTime()) / 1000));
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${Math.floor(seconds / 3600)}h`;
};

/**
 * The record behind the toasts.
 *
 * <p>A toast that has faded is gone; this is where it can still be found. That matters most for the
 * events nobody was watching for — a target going down while the user was reading a value.
 */
export const AppNotificationDrawer: FC<AppNotificationDrawerProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { history, unreadCount, markAllRead, dismiss, clear } = useNotifications();
  const [isMenuOpen, setMenuOpen] = useState(false);
  // One clock for the whole list, ticking slowly: timestamps here are minute-grained,
  // so a per-second timer would re-render every item to change nothing.
  const [now, setNow] = useState(() => Date.now());
  /**
   * Which groups are open.
   *
   * <p>Decided once, when the drawer is opened, and then only by the reader. Groups holding
   * something unread start open and the rest start shut, which is the point of the grouping —
   * unless nothing at all is unread, in which case the drawer is being read as a history and a
   * wall of collapsed headers answers nothing.
   *
   * <p>Fixed at mount rather than derived from the unread count as it changes: otherwise pressing
   * "mark all as read" would collapse everything the reader was in the middle of looking at.
   */
  const [expanded, setExpanded] = useState<Partial<Record<(typeof GROUPS)[number], boolean>>>(
    () => {
      const nothingUnread = history.every((notification) => notification.isRead);
      return Object.fromEntries(
        GROUPS.map((group) => [
          group,
          nothingUnread ||
            history.some((notification) => notification.variant === group && !notification.isRead),
        ]),
      );
    },
  );

  const grouped = useMemo(() => {
    const byVariant = { danger: [], warning: [], success: [], info: [] } as Record<
      (typeof GROUPS)[number],
      AppNotification[]
    >;
    history.forEach((notification) => byVariant[notification.variant].push(notification));
    return byVariant;
  }, [history]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <NotificationDrawer>
      <NotificationDrawerHeader
        count={unreadCount}
        // PatternFly's default is the English word "unread"; the count beside it was the
        // only part of that line ever translated.
        unreadText={t('Notifications.UNREAD')}
        onClose={onClose}
        title={t('Notifications.TITLE')}
      >
        <Dropdown
          isOpen={isMenuOpen}
          onOpenChange={setMenuOpen}
          popperProps={{
            // Appended to the body so a menu opened near the bottom of a scrolling
            // card is not clipped by it, which is PatternFly's own guidance for this.
            position: 'right',
            preventOverflow: true,
            enableFlip: true,
            appendTo: () => document.body,
          }}
          toggle={(toggleRef) => (
            <MenuToggle
              ref={toggleRef}
              variant="plain"
              aria-label={t('Notifications.ACTIONS')}
              isExpanded={isMenuOpen}
              onClick={() => setMenuOpen((open) => !open)}
              icon={<EllipsisVIcon />}
            />
          )}
        >
          <DropdownList>
            <DropdownItem
              onClick={() => {
                markAllRead();
                setMenuOpen(false);
              }}
            >
              {t('Notifications.MARK_ALL_READ')}
            </DropdownItem>
            <DropdownItem
              onClick={() => {
                clear();
                setMenuOpen(false);
              }}
            >
              {t('Notifications.CLEAR_ALL')}
            </DropdownItem>
          </DropdownList>
        </Dropdown>
      </NotificationDrawerHeader>
      <NotificationDrawerBody>
        {history.length === 0 ? (
          <EmptyState titleText={t('Notifications.EMPTY_TITLE')} headingLevel="h3">
            <EmptyStateBody>{t('Notifications.EMPTY_BODY')}</EmptyStateBody>
          </EmptyState>
        ) : (
          /*
           * Grouped by what the notification is rather than listed flat: somebody opening
           * this drawer is nearly always looking for what went wrong, and a problem three
           * screens down a list of successes is a problem nobody finds. A group holding
           * something unread opens itself; the rest stay shut, because the point of the
           * grouping is that the quiet ones take one line each.
           */
          <>
            {GROUPS.filter((group) => grouped[group].length > 0).map((group) => {
              const items = grouped[group];
              const isOpen = expanded[group] ?? false;
              return (
                <NotificationDrawerGroup
                  key={group}
                  title={t(`Notifications.GROUP_${group}` as 'Notifications.GROUP_danger')}
                  // How many are in the group, which is what PatternFly's count means here.
                  // The unread figure belongs to the header above, where it already is —
                  // showing it again per group left a heading saying 0 above four items.
                  count={items.length}
                  isExpanded={isOpen}
                  onExpand={(_event, open) =>
                    setExpanded((current) => ({ ...current, [group]: open }))
                  }
                >
                  <NotificationDrawerList isHidden={!isOpen}>
                    {items.map((notification) => (
                      <NotificationDrawerListItem
                        key={notification.id}
                        variant={notification.variant}
                        isRead={notification.isRead}
                      >
                        <NotificationDrawerListItemHeader
                          variant={notification.variant}
                          title={notification.title}
                        >
                          <Button
                            variant="plain"
                            aria-label={t('Notifications.DISMISS')}
                            onClick={() => dismiss(notification.id)}
                          >
                            &times;
                          </Button>
                        </NotificationDrawerListItemHeader>
                        <NotificationDrawerListItemBody timestamp={relative(notification.at, now)}>
                          {notification.description}
                        </NotificationDrawerListItemBody>
                      </NotificationDrawerListItem>
                    ))}
                  </NotificationDrawerList>
                </NotificationDrawerGroup>
              );
            })}
          </>
        )}
      </NotificationDrawerBody>
    </NotificationDrawer>
  );
};
