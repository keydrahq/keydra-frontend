import type { FC } from 'react';
import {
  Breadcrumb,
  BreadcrumbItem,
  Button,
  Content,
  Flex,
  FlexItem,
  PageBreadcrumb,
  PageSection,
  Tab,
  Tabs,
  TabsComponent,
  TabTitleIcon,
  TabTitleText,
  Title,
} from '@patternfly/react-core';
import { useTranslation } from 'react-i18next';
import { Link, Outlet, useLocation, useNavigate, useParams } from 'react-router';
import { formatBytes, formatCount, formatDuration } from '@app/Monitoring/format';
import { useConnectionVitals } from '@app/Monitoring/queries';
import { ConnectionState } from '@app/Shared/Services/api.types';
import type { NavigableRoute } from '@app/routes';
import { connectionPath, connectionRoutes } from '@app/routes';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { useTargetHolders } from '@app/Instances/queries';
import { ConnectionStatusLabel } from './ConnectionStatusLabel';
import { connectionTypeKey } from './labels';
import { endpointOf } from './connectionUrl';
import { ServerFlavorLabel } from './ServerFlavorLabel';
import { useSupports } from './capabilities';
import { useConnection, useTestConnection } from './queries';

/**
 * The page for one target: what it is, how it is doing, and tabs across the tools that work on it.
 *
 * <p>This is PatternFly's resource-detail anatomy — breadcrumb, a header naming the resource with
 * its status and actions, then tabs — and it replaces a second group in the side navigation. The
 * sidebar answers "where in the application am I"; it is the wrong place to answer "which view of
 * this one server am I looking at", and using it for both left the console with no page that was
 * about the server itself.
 *
 * <p>A layout route: the tools render into the outlet below the tabs, so switching tabs replaces
 * the body and leaves the header, the target's vital signs and the scroll position of the frame
 * alone.
 */
export const ConnectionDetail: FC = () => {
  const { t } = useTranslation();
  const { connectionId: idParam } = useParams();
  const connectionId = Number(idParam);
  const location = useLocation();
  const navigate = useNavigate();
  const profile = useConnection(connectionId);
  const test = useTestConnection();

  const isUp = profile?.status.state === ConnectionState.Up;
  const vitals = useConnectionVitals(connectionId, isUp);

  const holds = usePermissionCheck();

  /*
   * Which Keydras hold a client to this target. Only asked by somebody who may read the roster:
   * how work is spread across a fleet is a map of the installation, which is what `instance:read`
   * exists to gate.
   */
  const holders = useTargetHolders(connectionId, holds(Permission.InstanceRead));

  // Asked per target, which is the point: somebody may run a console on one server and not
  // on another, and a role name that summarises everything they hold anywhere cannot say so.
  const permitted = (route: NavigableRoute): boolean =>
    !route.requiresPermission || holds(route.requiresPermission, connectionId);

  // Two different questions, and a tool has to pass both. A permission is about the person; a
  // capability is about the store. Somebody may hold `console:run` on a target whose engine has no
  // command language, and offering them a console there is offering a tool that cannot work.
  const supports = useSupports(connectionId);
  const offered = (route: NavigableRoute): boolean =>
    permitted(route) && supports(route.requiresFeature);

  const tabs = connectionRoutes.filter(offered);
  const activePath =
    tabs.find((route) => location.pathname === connectionPath(route, connectionId))?.path ??
    tabs[0]?.path;

  /**
   * One line of context under the name: where the target is, and what it is holding.
   *
   * <p>Assembled rather than laid out in a grid because it is a sentence about the server, and the
   * figures that are missing simply drop out of it instead of leaving labelled holes.
   */
  const endpoint = profile ? endpointOf(profile) : '';
  const summary = [
    vitals.data?.keyCount != null
      ? t('Connections.VITALS_KEYS_VALUE', { value: formatCount(vitals.data.keyCount) })
      : null,
    vitals.data?.memoryUsedBytes != null ? formatBytes(vitals.data.memoryUsedBytes) : null,
    vitals.data?.connectedClients != null
      ? t('Connections.VITALS_CLIENTS_VALUE', { value: formatCount(vitals.data.connectedClients) })
      : null,
    vitals.data?.uptimeSeconds != null
      ? t('Connections.VITALS_UPTIME_VALUE', { value: formatDuration(vitals.data.uptimeSeconds) })
      : null,
    /*
     * Only where there is more than one holder. On the single instance almost every deployment
     * runs, "held by 1 instance" is a sentence that is true, useless, and on every target page —
     * and the fact worth surfacing is the other one: two Keydras are two pools against this server.
     */
    (holders.data?.length ?? 0) > 1
      ? t('Connections.HELD_BY', { count: holders.data?.length ?? 0 })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <PageBreadcrumb>
        <Breadcrumb>
          <BreadcrumbItem>
            <Link to="/connections">{t('Connections.TITLE')}</Link>
          </BreadcrumbItem>
          <BreadcrumbItem isActive>{profile?.name ?? `#${connectionId}`}</BreadcrumbItem>
        </Breadcrumb>
      </PageBreadcrumb>

      <PageSection>
        <Flex
          alignItems={{ default: 'alignItemsCenter' }}
          spaceItems={{ default: 'spaceItemsMd' }}
          flexWrap={{ default: 'nowrap' }}
        >
          <FlexItem grow={{ default: 'grow' }} className="keydra-page-header__text">
            <Flex
              alignItems={{ default: 'alignItemsCenter' }}
              spaceItems={{ default: 'spaceItemsSm' }}
              flexWrap={{ default: 'wrap' }}
            >
              <Title headingLevel="h1" size="xl">
                {profile?.name ?? `#${connectionId}`}
              </Title>
              {profile ? (
                <>
                  <ConnectionStatusLabel status={profile.status} />
                  <ServerFlavorLabel status={profile.status} />
                  <Content component="small">{t(connectionTypeKey(profile.type))}</Content>
                </>
              ) : null}
            </Flex>
            <Content component="small">
              <span className="pf-v6-u-font-family-monospace">{endpoint}</span>
              {summary ? ` · ${summary}` : null}
            </Content>
          </FlexItem>
          <FlexItem>
            <Button
              variant="secondary"
              isDisabled={test.isPending}
              onClick={() => test.mutate(connectionId)}
            >
              {t('Connections.TEST')}
            </Button>
          </FlexItem>
        </Flex>
      </PageSection>

      <PageSection type="tabs" hasShadowBottom>
        <Tabs
          activeKey={activePath ?? ''}
          component={TabsComponent.nav}
          usePageInsets
          aria-label={t('Connections.TOOLS')}
          onSelect={(event, key) => {
            // The tabs are real links so they can be opened in a new tab, which means an
            // ordinary click would otherwise reload the whole application.
            event.preventDefault();
            const route = tabs.find((candidate) => candidate.path === key);
            if (route) {
              void navigate(connectionPath(route, connectionId));
            }
          }}
        >
          {tabs.map((route) => {
            const Icon = route.icon;
            return (
              <Tab
                key={route.path}
                eventKey={route.path}
                href={connectionPath(route, connectionId)}
                title={
                  <>
                    {Icon ? (
                      <TabTitleIcon>
                        <Icon aria-hidden="true" />
                      </TabTitleIcon>
                    ) : null}
                    <TabTitleText>{t(route.label)}</TabTitleText>
                  </>
                }
              />
            );
          })}
        </Tabs>
      </PageSection>

      <Outlet />
    </>
  );
};
