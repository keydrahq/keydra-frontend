import type { FC, ReactNode } from 'react';
import { useState } from 'react';
import {
  Masthead,
  MastheadBrand,
  MastheadContent,
  MastheadLogo,
  MastheadMain,
  MastheadToggle,
  Nav,
  NavList,
  NavItem,
  NotificationBadge,
  Page,
  PageSidebar,
  PageSidebarBody,
  PageToggleButton,
  Toolbar,
  ToolbarContent,
  ToolbarGroup,
  ToolbarItem,
} from '@patternfly/react-core';
import { BarsIcon } from '@patternfly/react-icons';
import { AppNotificationDrawer } from './AppNotificationDrawer';
import { LanguageMenu } from './LanguageMenu';
import { IdentityIndicator } from '@app/Security/IdentityIndicator';
import { SecurityBanner } from '@app/Security/SecurityBanner';
import { useNotifications } from '@app/Shared/Components/notificationStore';
import { useAlertNotices } from '@app/Alerts/useAlertNotices';
import { useSignInNotices } from '@app/Security/useSignInNotices';
import { useHubNotifications } from './useHubNotifications';
import { useHubSocket } from './useHubSocket';
import { useSessionEnded } from './useSessionEnded';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import type { NavigableRoute } from '@app/routes';
import { navigableRoutes } from '@app/routes';
import { useCurrentUser } from '@app/Security/queries';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { RouterLink } from '@app/Shared/Components/RouterLink';
import { Wordmark } from '@app/Shared/Components/Wordmark';
import { AppearanceMenu } from './AppearanceMenu';

export interface AppLayoutProps {
  children?: ReactNode;
}

/**
 * PatternFly page shell. The side navigation is derived from `routes.tsx`
 * rather than hand-written, so adding a route in a later phase adds its nav
 * entry automatically.
 */
export const AppLayout: FC<AppLayoutProps> = ({ children }) => {
  const { t } = useTranslation();
  const location = useLocation();
  const { unreadCount, markAllRead } = useNotifications();
  const user = useCurrentUser();
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  // Server-side events become notifications wherever the user happens to be.
  useHubSocket();
  useSessionEnded();
  useHubNotifications();
  // Here rather than on the Alerts page: a rule that fires while somebody is looking at a key
  // browser is exactly the case the whole feature exists for.
  useAlertNotices();

  // These pages are about Keydra itself, so the permission is asked without a target.
  const holds = usePermissionCheck();

  // A sign-in that did not look like the ones before it. Told only to somebody who may read
  // the audit log, because it names an account other than theirs.
  useSignInNotices(holds(Permission.AuditRead));

  /** Hidden unless the user may use it; an entry that leads to a refusal is not an offer. */
  const isPermitted = (route: NavigableRoute): boolean =>
    // Shown while the answer is unknown and while nothing is enforced: an entry that
    // flickers away after load is worse than one that leads to a refusal.
    !route.requiresPermission || holds(route.requiresPermission);

  const navEntry = (route: NavigableRoute): ReactNode => {
    const Icon = route.icon;
    return (
      <NavItem
        key={route.path}
        // PatternFly renders the anchor itself here, which is what puts the icon in its
        // own slot; a hand-built row inside the link would need laying out by hand.
        component={RouterLink}
        to={route.path}
        icon={Icon ? <Icon /> : undefined}
        isActive={location.pathname.startsWith(route.path)}
      >
        {t(route.label)}
      </NavItem>
    );
  };

  const masthead = (
    <Masthead>
      <MastheadMain>
        <MastheadToggle>
          <PageToggleButton
            variant="plain"
            aria-label={t('AppLayout.TOGGLE_NAVIGATION')}
            icon={<BarsIcon />}
          />
        </MastheadToggle>
        <MastheadBrand>
          <MastheadLogo component="span">
            {/* Drawn in the masthead's own ink rather than picked from two files by theme:
                the page is dark in more cases than "the dark scheme is on". */}
            <Wordmark />
          </MastheadLogo>
        </MastheadBrand>
      </MastheadMain>
      <MastheadContent>
        <Toolbar isStatic isFullHeight>
          <ToolbarContent>
            <ToolbarGroup align={{ default: 'alignEnd' }}>
              {/* Only when there is somebody to name. An empty toolbar item still takes its
                  width, which left a gap in the corner on every development instance. */}
              {user.data?.securityEnabled ? (
                <ToolbarItem>
                  <IdentityIndicator />
                </ToolbarItem>
              ) : null}
              <ToolbarItem>
                <NotificationBadge
                  variant={unreadCount > 0 ? 'unread' : 'read'}
                  count={unreadCount}
                  isExpanded={isDrawerOpen}
                  aria-label={t('AppLayout.NOTIFICATIONS')}
                  onClick={() => {
                    // Opening is reading: the badge must not still claim attention
                    // for something now on screen.
                    setDrawerOpen((open) => !open);
                    markAllRead();
                  }}
                />
              </ToolbarItem>
              <ToolbarItem>
                <LanguageMenu />
              </ToolbarItem>
              <ToolbarItem>
                <AppearanceMenu />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </MastheadContent>
    </Masthead>
  );

  const sidebar = (
    <PageSidebar>
      <PageSidebarBody>
        <Nav aria-label={t('AppLayout.GLOBAL_NAVIGATION')}>
          {/* One list, because there is one group of entries and a heading over the whole
              navigation names nothing. It is also the tree PatternFly asks for: a NavItem
              belongs to a NavList. NavGroup would supply its own list instead — which is
              why a NavList must never be nested inside one — and is what to reach for on
              the day these entries divide into two named sets. */}
          <NavList>{navigableRoutes().filter(isPermitted).map(navEntry)}</NavList>
        </Nav>
      </PageSidebarBody>
    </PageSidebar>
  );

  return (
    <Page
      masthead={masthead}
      sidebar={sidebar}
      isManagedSidebar
      mainContainerId="keydra-main"
      banner={<SecurityBanner />}
      // Sections marked isFilled grow to the bottom of the window. Without this the page
      // is only as tall as its content and the container's own white shows underneath the
      // content plane — a white band along the foot of every page.
      isContentFilled
      notificationDrawer={<AppNotificationDrawer onClose={() => setDrawerOpen(false)} />}
      isNotificationDrawerExpanded={isDrawerOpen}
    >
      {children}
    </Page>
  );
};
