import type { ComponentType } from 'react';
import type { TranslationKey } from '@i18n/keys';
import {
  BellIcon,
  BroadcastTowerIcon,
  ChartPieIcon,
  CogIcon,
  ExchangeAltIcon,
  EyeIcon,
  FingerprintIcon,
  HistoryIcon,
  HomeIcon,
  InfoCircleIcon,
  ServerGroupIcon,
  KeyIcon,
  MonitoringIcon,
  NetworkIcon,
  OutlinedClockIcon,
  OutlinedHddIcon,
  PlugIcon,
  SecurityIcon,
  TerminalIcon,
  TopologyIcon,
  UsersIcon,
  UserCheckIcon,
} from '@patternfly/react-icons';
import { Feature } from '@app/Topology/types';
import { Permission } from '@app/Login/queries';
import { About } from '@app/About/About';
import { Instances } from '@app/Instances/Instances';
import { Console } from '@app/Console/Console';
import { Dashboard } from '@app/Monitoring/Dashboard';
import { KeyBrowser } from '@app/KeyBrowser/KeyBrowser';
import { Analysis } from '@app/Analysis/Analysis';
import { ServerAdmin } from '@app/ServerAdmin/ServerAdmin';
import { Settings } from '@app/Settings/Settings';
import { Connections } from '@app/Connections/Connections';
import { Migrations } from '@app/Migrations/Migrations';
import { Schedules } from '@app/Schedules/Schedules';
import { Approvals } from '@app/Approvals/Approvals';
import { Alerts } from '@app/Alerts/Alerts';
import { Destinations } from '@app/Backups/Destinations';
import { Tunnels } from '@app/Tunnels/Tunnels';
import { ConnectionBackups } from '@app/Backups/ConnectionBackups';
import { Overview } from '@app/Overview/Overview';
import { CommandWatch } from '@app/CommandWatch/CommandWatch';
import { PubSub } from '@app/PubSub/PubSub';
import { Access } from '@app/Access/Access';
import { AclUsers } from '@app/Security/AclUsers';
import { Audit } from '@app/Security/Audit';
import { SignInWatch } from '@app/Security/SignInWatch';
import { Topology } from '@app/Topology/Topology';

/**
 * Single source of truth for both routing and the side navigation
 * (cryostat-web's convention). A route with a `label` appears in the nav.
 */
export interface IAppRoute {
  /** Present means the route is rendered in the side nav. */
  label?: TranslationKey;
  /** Used for the document title. */
  title: TranslationKey;
  path: string;
  component: ComponentType;
  /** Drawn beside the label in the nav and in the connection card's action row. */
  icon?: ComponentType;
  /**
   * Offered as a button on the connection card rather than inside its menu.
   *
   * <p>Three of the six, because a card whose every tool is a button is a wall of buttons and
   * stops pointing anywhere. The rest stay one click further away, in the card's menu and in the
   * navigation the moment the target is open.
   */
  isPrimaryTool?: boolean;
  /** Whether the global navigation offers this route. */
  isInGlobalNav?: boolean;
  /**
   * The permission needed to see this offered.
   *
   * <p>Absent means anyone may. For a route about one target this is asked per target, which is
   * the whole point: somebody may run a console on one server and not on another, and a coarse
   * role name cannot say that. This hides the entry only; the backend is what refuses the
   * request, and a hidden link is a courtesy rather than a control.
   */
  requiresPermission?: string;
  /**
   * The capability the target has to have for this to be offered.
   *
   * <p>A different question from the permission beside it, and both are asked: a permission is
   * about the person, this is about the store. Somebody may hold `console:run` on a target whose
   * engine has no command language at all, and offering them a console there is offering a tool
   * that cannot work — the tab opens, the first request fails, and nothing on the screen explains
   * that it was never going to.
   *
   * <p>Absent means every store has it. Names come from `io.keydra.engine.Capabilities.Feature`.
   */
  requiresFeature?: string;
}

/** A route guaranteed to carry a nav label. */
export type NavigableRoute = IAppRoute & { label: TranslationKey };

/**
 * The tools that operate on one target.
 *
 * <p>They carry a `:connectionId`, so they are never in the global nav — they appear as a second
 * nav group once a connection is open, and as the action row of that connection's card. Before
 * this the only way from the key browser to the console was back out to the list and into a
 * kebab menu, which is two navigations to move between two views of the same server.
 */
export const connectionRoutes: NavigableRoute[] = [
  {
    component: KeyBrowser,
    label: 'KeyBrowser.NAV',
    title: 'KeyBrowser.TITLE',
    path: '/connections/:connectionId/keys',
    isPrimaryTool: true,
    icon: KeyIcon,
    requiresPermission: Permission.KeysRead,
  },
  {
    component: Console,
    label: 'Console.NAV',
    title: 'Console.TITLE',
    path: '/connections/:connectionId/console',
    requiresFeature: Feature.Console,
    isPrimaryTool: true,
    icon: TerminalIcon,
    requiresPermission: Permission.ConsoleRun,
  },
  {
    component: CommandWatch,
    label: 'CommandWatch.NAV',
    title: 'CommandWatch.TITLE',
    path: '/connections/:connectionId/commands',
    requiresFeature: Feature.CommandStream,
    icon: EyeIcon,
    // Every command every client sends, including the ones carrying data: somebody who may
    // read one key at a time has no business reading all of them as they go past.
    requiresPermission: Permission.CommandsWatch,
  },
  {
    component: PubSub,
    label: 'PubSub.NAV',
    title: 'PubSub.TITLE',
    path: '/connections/:connectionId/pubsub',
    requiresFeature: Feature.PubSub,
    icon: BroadcastTowerIcon,
    requiresPermission: Permission.PubSubSubscribe,
  },
  {
    component: Analysis,
    label: 'Analysis.NAV',
    title: 'Analysis.TITLE',
    path: '/connections/:connectionId/analysis',
    icon: ChartPieIcon,
    // The report is built by measuring keys, which is the statistics side of an engine. A store
    // that keeps none cannot be analysed, and the page it would draw is a spinner.
    requiresFeature: Feature.Metrics,
    requiresPermission: Permission.AnalysisRead,
  },
  {
    component: Dashboard,
    label: 'Monitoring.NAV',
    title: 'Monitoring.TITLE',
    path: '/connections/:connectionId/monitoring',
    requiresFeature: Feature.Metrics,
    isPrimaryTool: true,
    icon: MonitoringIcon,
    requiresPermission: Permission.MonitoringRead,
  },
  {
    component: Topology,
    label: 'Topology.NAV',
    title: 'Topology.TITLE',
    path: '/connections/:connectionId/topology',
    requiresFeature: Feature.Topology,
    icon: TopologyIcon,
    requiresPermission: Permission.ConnectionView,
  },
  {
    component: ConnectionBackups,
    label: 'Backups.NAV',
    title: 'Backups.CONNECTION_TITLE',
    path: '/connections/:connectionId/backups',
    icon: OutlinedHddIcon,
    // A backup is the keyspace handed over as bytes, so a store that cannot serialise a value has
    // nothing to put in one.
    requiresFeature: Feature.Transfer,
    // Taking a backup is exporting the keyspace, which is what this permission has always
    // meant. Sending the export somewhere else does not change who may read it.
    requiresPermission: Permission.TransferExport,
  },
  {
    component: ServerAdmin,
    label: 'ServerAdmin.NAV',
    title: 'ServerAdmin.TITLE',
    path: '/connections/:connectionId/server',
    icon: CogIcon,
    // The page is the server's own settings, and a store that will not be asked about them has no
    // page here rather than an empty one.
    requiresFeature: Feature.Admin,
    requiresPermission: Permission.ServerRead,
  },
  {
    component: AclUsers,
    label: 'Acl.NAV',
    title: 'Acl.TITLE',
    path: '/connections/:connectionId/acl',
    requiresFeature: Feature.AccessControl,
    icon: UsersIcon,
    requiresPermission: Permission.AclRead,
  },
];

export const routes: IAppRoute[] = [
  {
    component: Overview,
    label: 'Overview.NAV',
    title: 'Overview.TITLE',
    path: '/overview',
    isInGlobalNav: true,
    icon: HomeIcon,
  },
  {
    component: Connections,
    label: 'Connections.TITLE',
    title: 'Connections.TITLE',
    path: '/connections',
    icon: PlugIcon,
    isInGlobalNav: true,
  },
  {
    component: Migrations,
    label: 'Migrations.NAV',
    title: 'Migrations.TITLE',
    path: '/migrations',
    isInGlobalNav: true,
    icon: ExchangeAltIcon,
  },
  {
    component: Schedules,
    label: 'Schedules.NAV',
    title: 'Schedules.TITLE',
    path: '/schedules',
    isInGlobalNav: true,
    icon: OutlinedClockIcon,
    // Not gated here: the permission is about one target, and a person who may arrange
    // work on one server should find the page rather than have it hidden because they may
    // not arrange it on another. The list itself only shows targets they can see.
  },
  {
    component: Approvals,
    label: 'Approvals.NAV',
    title: 'Approvals.TITLE',
    path: '/approvals',
    isInGlobalNav: true,
    icon: UserCheckIcon,
    // Ungated for the reason the schedules are, and for one of its own: whether somebody can
    // answer a request depends on the request rather than on a permission the nav could test,
    // and hiding the page would hide it from the people waiting to hear about their own.
  },
  {
    component: Alerts,
    label: 'Alerts.NAV',
    title: 'Alerts.TITLE',
    path: '/alerts',
    isInGlobalNav: true,
    icon: BellIcon,
    // Ungated for the same reason the schedules are: a rule is about one target, and the
    // list shows only the targets the caller can see.
  },
  {
    component: Destinations,
    label: 'Backups.TITLE',
    title: 'Backups.TITLE',
    path: '/backups',
    isInGlobalNav: true,
    icon: OutlinedHddIcon,
    // Configuring where backups go is an administrator's job: a destination carries
    // credentials to somewhere outside Keydra, and somebody who may back one server up is
    // not thereby somebody who decides backups leave for a bucket of their choosing.
    requiresPermission: Permission.BackupManage,
  },
  {
    component: Tunnels,
    label: 'Tunnels.TITLE',
    title: 'Tunnels.TITLE',
    path: '/tunnels',
    isInGlobalNav: true,
    icon: NetworkIcon,
    // A jump host carries a credential that reaches a whole network, and everything Keydra
    // holds for everything behind it travels through it. Choosing which tunnel a target uses
    // is part of editing that target; describing the tunnel is an administrator's.
    requiresPermission: Permission.TunnelManage,
  },
  {
    component: Access,
    label: 'Access.NAV',
    title: 'Access.TITLE',
    path: '/access',
    icon: SecurityIcon,
    isInGlobalNav: true,
    // Reading it at all requires managing users, which is what the page is mostly for.
    requiresPermission: Permission.UsersManage,
  },
  {
    component: Audit,
    label: 'Audit.TITLE',
    title: 'Audit.TITLE',
    path: '/audit',
    icon: HistoryIcon,
    isInGlobalNav: true,
    requiresPermission: Permission.AuditRead,
  },
  {
    // Beside the audit log rather than inside it. The log records what people did once they
    // were in; this is about getting in, and the two are read for different reasons — one is
    // a record of actions, the other a comparison against a history.
    component: SignInWatch,
    label: 'SignIns.NAV',
    title: 'SignIns.WATCH_TITLE',
    path: '/sign-ins',
    icon: FingerprintIcon,
    isInGlobalNav: true,
    requiresPermission: Permission.AuditRead,
  },
  {
    component: Settings,
    label: 'Settings.NAV',
    title: 'Settings.TITLE',
    path: '/settings',
    isInGlobalNav: true,
    icon: CogIcon,
  },
  {
    // Beside About rather than inside it: About says what this build is, and this says how it is
    // doing. One is a fact about the artifact and the other is a fact about right now.
    component: Instances,
    label: 'Instances.NAV',
    title: 'Instances.TITLE',
    path: '/instances',
    icon: ServerGroupIcon,
    isInGlobalNav: true,
    requiresPermission: Permission.InstanceRead,
  },
  {
    component: About,
    label: 'About.TITLE',
    title: 'About.TITLE',
    path: '/about',
    icon: InfoCircleIcon,
    isInGlobalNav: true,
  },
];

/** Routes belonging to one nav group, narrowed to those with a label. */
/**
 * Every route the global navigation offers.
 *
 * <p>Ungrouped, because there is one set of entries and a heading over the whole navigation names
 * nothing. On the day they divide into two named sets this becomes one call per set and the layout
 * draws a NavGroup around each — which is also the only correct place for one, since NavGroup
 * supplies its own list.
 */
export const navigableRoutes = (): NavigableRoute[] =>
  routes.filter((route): route is NavigableRoute => !!route.label && route.isInGlobalNav === true);

/** Where a connection-scoped route points for one target. */
export const connectionPath = (route: IAppRoute, connectionId: number | string): string =>
  route.path.replace(':connectionId', String(connectionId));

/**
 * Where a target's own page starts.
 *
 * <p>The first of its tools rather than a landing page of its own: the browser is what someone
 * opening a server came for, and a page whose only content is links to the tabs above it is a
 * click asking to be skipped.
 */
export const connectionHome = (connectionId: number | string): string =>
  connectionPath(connectionRoutes[0], connectionId);

/**
 * The connection a path is about, or undefined for the pages that belong to no target.
 *
 * <p>Read from the location rather than from `useParams` because the layout sits above the router's
 * matched route and therefore has no params of its own.
 */
export const connectionIdOf = (pathname: string): number | undefined => {
  const id = /^\/connections\/(\d+)\//.exec(pathname)?.[1];
  return id ? Number(id) : undefined;
};
