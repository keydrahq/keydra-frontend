import type { FC } from 'react';
import { useState } from 'react';
import {
  Button,
  Divider,
  Dropdown,
  DropdownItem,
  DropdownList,
  Flex,
  FlexItem,
  Label,
  MenuToggle,
  Tooltip,
} from '@patternfly/react-core';
import { CatalogTile, CatalogTileBadge } from '@patternfly/react-catalog-view-extension';
import { EllipsisVIcon, LockIcon, NetworkIcon, ServerIcon } from '@patternfly/react-icons';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { formatBytes, formatCount, formatDuration } from '@app/Monitoring/format';
import { useConnectionVitals } from '@app/Monitoring/queries';
import { RouterLink } from '@app/Shared/Components/RouterLink';
import type { ConnectionResponse } from '@app/Shared/Services/api.types';
import { ConnectionState } from '@app/Shared/Services/api.types';
import type { NavigableRoute } from '@app/routes';
import { connectionHome, connectionPath, connectionRoutes } from '@app/routes';
import { Permission, usePermissionCheck } from '@app/Login/queries';
import { ConnectionStatusLabel } from './ConnectionStatusLabel';
import { serverLogo } from './serverLogo';
import { useSupports } from './capabilities';
import { Feature } from '@app/Topology/types';
import { connectionTypeKey } from './labels';
import { endpointOf } from './connectionUrl';
import { ServerFlavorLabel } from './ServerFlavorLabel';

export interface ConnectionTileProps {
  profile: ConnectionResponse;
  isTesting: boolean;
  onEdit: (profile: ConnectionResponse) => void;
  onDelete: (profile: ConnectionResponse) => void;
  onTest: (profile: ConnectionResponse) => void;
}

/**
 * One saved target as a catalog tile: what it is, how it is doing, and what can be done with it.
 *
 * <p>PatternFly's catalog tile rather than a card assembled by hand. A list of servers to pick from
 * is what a catalog is, and the component already knows how a tile is laid out — icon, title,
 * badges, a body and a footer — which is a set of decisions this file no longer has to make or
 * keep consistent with the next tile someone adds.
 */
export const ConnectionTile: FC<ConnectionTileProps> = ({
  profile,
  isTesting,
  onEdit,
  onDelete,
  onTest,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isMenuOpen, setMenuOpen] = useState(false);

  const isUp = profile.status.state === ConnectionState.Up;
  // What the target said it is, and what the profile expects when it has not said. A target
  // nobody has reached yet still belongs to a server somebody chose.
  const logo = serverLogo(profile.status.server?.flavor ?? profile.flavor.toLowerCase());
  const target = endpointOf(profile);

  // Live figures, so the catalog answers "how is the fleet doing" and not only "which
  // servers are configured". Asked for only while the target is answering.
  const vitals = useConnectionVitals(profile.id, isUp);

  const holds = usePermissionCheck();

  // The same question the target's own tab bar asks, asked here for the same reason: a shortcut
  // to a console on a store that has none is a button whose page is not there. One cached answer
  // per target, and it is the answer the page behind the button would get anyway.
  const supports = useSupports(profile.id);

  // Asked per target, which is the point: somebody may run a console on one server and not
  // on another, and a role name that summarises everything they hold anywhere cannot say so.
  const permitted = (route: NavigableRoute): boolean =>
    !route.requiresPermission || holds(route.requiresPermission, profile.id);

  const tools = connectionRoutes.filter(
    (route) => permitted(route) && supports(route.requiresFeature),
  );
  const buttons = tools.filter((route) => route.isPrimaryTool);
  const menuTools = tools.filter((route) => !route.isPrimaryTool);

  // Held on this target rather than in general: somebody may edit the profile of one server
  // and not another, and the menu should say so on each card rather than on none.
  const mayEdit = holds(Permission.ConnectionEdit, profile.id);
  const mayDelete = holds(Permission.ConnectionDelete, profile.id);

  /** One figure of the vitals line. A number the server did not report is a dash, never a zero. */
  const vital = (label: string, value: number | null | undefined, format: (n: number) => string) =>
    `${label} ${value === null || value === undefined ? '—' : format(value)}`;

  /*
   * A dash means "asked, and not answered yet". A store that keeps no statistics at all is never
   * going to answer, and four dashes on its tile say nothing four times — so the figures are left
   * off it entirely and the line is what the target is.
   */
  const reportsFigures = supports(Feature.Metrics);

  return (
    <CatalogTile
      id={`connection-${profile.id}`}
      featured={false}
      isFullHeight
      // The server's own mark when the target said what it runs, and a plain server glyph
      // when it did not: a fleet of a dozen targets is read by its logos long before anyone
      // gets to the version strings beside them. See src/assets/logos/README.md for where
      // each mark comes from.
      icon={
        logo ? (
          /*
           * On a plate, and the plate is why this is an `icon` rather than an `iconImg`.
           * These are the projects' own marks in the projects' own colours — Valkey's is a
           * navy that disappears against a dark page — and a mark is not ours to recolour.
           * A brand mark is drawn to sit on white, so it is given white to sit on, in every
           * theme; the alternative was a second copy of somebody else's logo with the ink
           * changed, which is the one thing their guidelines all agree about.
           */
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              inlineSize: '2.5rem',
              blockSize: '2.5rem',
              borderRadius: 'var(--pf-t--global--border--radius--small)',
              background: 'var(--pf-t--color--white)',
              // The same chip in both themes, and the hairline is what makes it the same:
              // without it the plate is white on a white card and the light theme looks as
              // though the marks are drawn plainly while the dark one puts them in boxes.
              border:
                'var(--pf-t--global--border--width--regular) solid var(--pf-t--global--border--color--default)',
            }}
          >
            <img
              src={logo}
              alt={profile.status.server?.flavor ?? ''}
              style={{ blockSize: '1.75rem', inlineSize: 'auto' }}
            />
          </span>
        ) : (
          <ServerIcon className="pf-v6-u-text-color-subtle" />
        )
      }
      title={profile.name}
      /*
       * Sized here rather than left to the extension's stylesheet, which asks for a token
       * PatternFly 6 does not define (--pf-t--global--FontSize--sm, since renamed to
       * --pf-t--global--font--size--sm). The rule is dropped and the endpoint is drawn as
       * large as the name above it.
       */
      vendor={<span className="pf-v6-u-font-size-sm">{target}</span>}
      badges={[
        <CatalogTileBadge key="status">
          <ConnectionStatusLabel status={profile.status} />
        </CatalogTileBadge>,
        <CatalogTileBadge key="flavor">
          <ServerFlavorLabel status={profile.status} />
        </CatalogTileBadge>,
        ...(profile.tunnelId !== null
          ? [
              <CatalogTileBadge key="tunnel">
                <Label isCompact variant="outline" icon={<NetworkIcon />}>
                  {t('Connections.TUNNEL')}
                </Label>
              </CatalogTileBadge>,
            ]
          : []),
        ...(profile.hasPassword
          ? [
              <CatalogTileBadge key="auth">
                <Label isCompact variant="outline" icon={<LockIcon />}>
                  {t('Connections.AUTHENTICATED')}
                </Label>
              </CatalogTileBadge>,
            ]
          : []),
      ]}
      /*
       * One line, which is all the tile gives a description that sits above a footer. What
       * a target is and how it is doing, in the order someone reads it.
       */
      description={[
        t(connectionTypeKey(profile.type)),
        ...(reportsFigures
          ? [
              vital(t('Connections.VITALS_KEYS'), vitals.data?.keyCount, formatCount),
              vital(t('Connections.VITALS_MEMORY'), vitals.data?.memoryUsedBytes, formatBytes),
              vital(t('Connections.VITALS_CLIENTS'), vitals.data?.connectedClients, formatCount),
              vital(t('Connections.VITALS_UPTIME'), vitals.data?.uptimeSeconds, formatDuration),
            ]
          : []),
      ].join(' · ')}
      // The tile itself opens the target; the footer's buttons open one of its tools.
      href={isUp ? connectionHome(profile.id) : ''}
      onClick={(event) => {
        event.preventDefault();
        if (isUp) {
          void navigate(connectionHome(profile.id));
        }
      }}
      footer={
        /* One row, and one that cannot wrap: labelled buttons plus a menu ran past the
           tile's width and dropped the menu onto a line of its own, which made every tile
           a different height. The tools are their icons here, named by their tooltips. */
        <Flex
          spaceItems={{ default: 'spaceItemsSm' }}
          flexWrap={{ default: 'nowrap' }}
          alignItems={{ default: 'alignItemsCenter' }}
        >
          {buttons.map((route) => {
            const Icon = route.icon;
            const label = t(route.label);
            return (
              <FlexItem key={route.path}>
                <Tooltip content={label}>
                  {/* A real link when it leads somewhere, a plain disabled button when it
                      does not: PatternFly styles a disabled non-button as disabled but
                      leaves its href live, so a link here would still navigate. */}
                  {isUp ? (
                    <Button
                      variant="secondary"
                      aria-label={label}
                      icon={Icon ? <Icon /> : undefined}
                      component={RouterLink}
                      href={connectionPath(route, profile.id)}
                      // The tile is clickable, so a click on a tool must not also open it.
                      onClick={(event) => event.stopPropagation()}
                    />
                  ) : (
                    <Button
                      variant="secondary"
                      aria-label={label}
                      icon={Icon ? <Icon /> : undefined}
                      isDisabled
                    />
                  )}
                </Tooltip>
              </FlexItem>
            );
          })}
          <FlexItem align={{ default: 'alignRight' }}>
            <Dropdown
              isOpen={isMenuOpen}
              onOpenChange={setMenuOpen}
              onSelect={() => setMenuOpen(false)}
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
                  /* Naming the profile keeps each tile's menu distinguishable to a screen
                     reader; "Kebab toggle" is identical on every tile. */
                  aria-label={t('Connections.ROW_ACTIONS_FOR', { name: profile.name })}
                  isExpanded={isMenuOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setMenuOpen((open) => !open);
                  }}
                  icon={<EllipsisVIcon />}
                />
              )}
            >
              <DropdownList>
                {menuTools.map((route) => (
                  <DropdownItem
                    key={route.path}
                    isDisabled={!isUp}
                    component={RouterLink}
                    href={connectionPath(route, profile.id)}
                  >
                    {t(route.label)}
                  </DropdownItem>
                ))}
                <Divider component="li" />
                <DropdownItem isDisabled={isTesting} onClick={() => onTest(profile)}>
                  {t('Connections.TEST')}
                </DropdownItem>
                {mayEdit && (
                  <DropdownItem onClick={() => onEdit(profile)}>
                    {t('Connections.EDIT')}
                  </DropdownItem>
                )}
                {mayDelete && (
                  <>
                    <Divider component="li" />
                    <DropdownItem isDanger onClick={() => onDelete(profile)}>
                      {t('Connections.DELETE')}
                    </DropdownItem>
                  </>
                )}
              </DropdownList>
            </Dropdown>
          </FlexItem>
        </Flex>
      }
    />
  );
};
